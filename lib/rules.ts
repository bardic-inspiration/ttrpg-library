// Ruleset rules data (docs/rulesets.md#rules-data): primitives, groups, and rules pages, and where
// each primitive and group appears. Pure functions with no Node imports, so the
// validator and the site place rules the same way.

/** One SRD rule, from rulesets/<ruleset>/rules/<type>/<id>.json. */
export interface Primitive {
  type: string;
  id: string;
  name: string;
  stats: Record<string, unknown>;
}

/** One group of a rules type, from rulesets/<ruleset>/rules/<type>-groups.json. */
export interface RulesGroup {
  id: string;
  name: string;
  qualifier?: string;
  parent?: string;
  union?: string[];
  note?: string;
  text?: string;
}

/** A group with its type, as a link target. */
export type TypedGroup = RulesGroup & { type: string };

/** A section of SRD prose, with optional nested sections. */
export interface ProseSection {
  title: string;
  text?: string;
  sections?: ProseSection[];
}

export type PageBlock = (ProseSection & { kind: 'prose' }) | { kind: 'primitives'; type: string } | { kind: 'group'; group: string };

export interface RulesPage {
  id: string;
  title: string;
  blocks: PageBlock[];
}

/** A rules type in ruleset.json's `rules` list. */
export interface RulesType {
  type: string;
  /** Whether custom entries of the type (extensions) may be authored. */
  extensions: boolean;
}

/** Something that sits in a group: a primitive, or an extension entry. */
export interface Member {
  type: string;
  id: string;
  name: string;
  stats: unknown;
}

/** The Extensions page's URL segment, which no rules page may take. */
export const EXTENSIONS_PAGE = 'extensions';

export const ruleKey = (item: { type: string; id: string }): string => `${item.type}/${item.id}`;

/** The anchor of a primitive's or group's section on its page: `<type>-<id>`, so two types on a page can't collide. */
export const anchorId = (key: string): string => key.replace('/', '-');

/** A rules page's path under the site base. */
export const rulesPagePath = (ruleset: string, page: string): string => `${ruleset}/rules/${page}/`;

/** The path under the site base of a primitive or group: its page, at its anchor. */
export const rulePath = (ruleset: string, page: string, key: string): string => `${rulesPagePath(ruleset, page)}#${anchorId(key)}`;

/** The leaf group a member names, if any. */
export const memberGroup = (member: { stats: unknown }): string | undefined => {
  const group = (member.stats as { group?: unknown } | null)?.group;
  return typeof group === 'string' ? group : undefined;
};

/** One rules type's groups, with lookups. */
export class GroupTree {
  readonly byId: Map<string, RulesGroup>;

  constructor(
    readonly type: string,
    readonly groups: RulesGroup[],
  ) {
    this.byId = new Map(groups.map((g) => [g.id, g]));
  }

  /** The groups nested directly in `id` (or the categories, for undefined), in file order, unions last. */
  children(id: string | undefined): RulesGroup[] {
    const kids = this.groups.filter((g) => g.parent === id);
    return [...kids.filter((g) => !g.union), ...kids.filter((g) => g.union)];
  }

  /** `id` and every group nested in it, at any depth. */
  descendants(id: string): Set<string> {
    const out = new Set<string>([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const g of this.groups) {
        if (g.parent !== undefined && out.has(g.parent) && !out.has(g.id)) {
          out.add(g.id);
          grew = true;
        }
      }
    }
    return out;
  }

  /** A group members may name: one with no child groups and no union. */
  isLeaf(id: string): boolean {
    const group = this.byId.get(id);
    return group !== undefined && !group.union && !this.groups.some((g) => g.parent === id);
  }

  /** Whether `member` belongs to `id`: its leaf group is `id` or nested in it, or in a group `id` joins. */
  contains(id: string, member: { stats: unknown }): boolean {
    const leaf = memberGroup(member);
    if (leaf === undefined) return false;
    const group = this.byId.get(id);
    if (group?.union) return group.union.some((part) => this.contains(part, member));
    return this.descendants(id).has(leaf);
  }

  /** The members directly in a leaf group, by name. */
  membersOf<T extends Member>(id: string, members: T[]): T[] {
    return members.filter((m) => memberGroup(m) === id).sort(byName);
  }

  /** Every member of a group, at any depth or through a union, by name. */
  allMembers<T extends Member>(id: string, members: T[]): T[] {
    return members.filter((m) => this.contains(id, m)).sort(byName);
  }
}

export const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/** A ruleset's rules data, as loaded. */
export interface RulesData {
  ruleset: string;
  types: RulesType[];
  primitives: Primitive[];
  /** Groups by rules type; a type with no groups file has none. */
  groups: Map<string, GroupTree>;
  pages: RulesPage[];
}

export interface Placement {
  /** Page id by primitive or group key. */
  pages: Map<string, string>;
  /** Keys placed on more than one page, with every page that places them. */
  twice: { key: string; pages: string[] }[];
  /** Keys no page places. */
  unplaced: string[];
}

/** The keys a group block places: the group, every group nested in it, and every primitive in them. */
function groupBlockKeys(tree: GroupTree, id: string, primitives: Primitive[]): string[] {
  const groups = tree.descendants(id);
  return [
    ...[...groups].map((g) => ruleKey({ type: tree.type, id: g })),
    ...primitives.filter((p) => p.type === tree.type && groups.has(memberGroup(p) ?? '')).map(ruleKey),
  ];
}

/** The keys one block places. */
export function blockKeys(data: RulesData, block: PageBlock): string[] {
  if (block.kind === 'primitives') return data.primitives.filter((p) => p.type === block.type).map(ruleKey);
  if (block.kind === 'group') {
    const slash = block.group.indexOf('/');
    const tree = data.groups.get(block.group.slice(0, slash));
    const id = block.group.slice(slash + 1);
    return tree?.byId.has(id) ? groupBlockKeys(tree, id, data.primitives) : [];
  }
  return [];
}

/** Which page shows each primitive and group, with any placed twice or never. */
export function placeRules(data: RulesData): Placement {
  const seen = new Map<string, string[]>();
  for (const page of data.pages) {
    for (const block of page.blocks) {
      for (const key of blockKeys(data, block)) {
        const list = seen.get(key) ?? [];
        list.push(page.id);
        seen.set(key, list);
      }
    }
  }
  const all = [
    ...data.primitives.map(ruleKey),
    ...[...data.groups.values()].flatMap((tree) => tree.groups.map((g) => ruleKey({ type: tree.type, id: g.id }))),
  ];
  const pages = new Map<string, string>();
  const twice: Placement['twice'] = [];
  for (const [key, list] of seen) {
    pages.set(key, list[0]!);
    if (list.length > 1) twice.push({ key, pages: list });
  }
  return { pages, twice, unplaced: all.filter((key) => !seen.has(key)) };
}

/**
 * The page an extension is listed on: the page that shows its type's
 * primitives, or the one whose group tree holds its group.
 */
export function extensionPage(data: RulesData, extension: Member): string | undefined {
  for (const page of data.pages) {
    for (const block of page.blocks) {
      if (block.kind === 'primitives' && block.type === extension.type) return page.id;
      if (block.kind === 'group') {
        const slash = block.group.indexOf('/');
        if (block.group.slice(0, slash) !== extension.type) continue;
        const tree = data.groups.get(extension.type);
        if (tree?.contains(block.group.slice(slash + 1), extension)) return page.id;
      }
    }
  }
  return undefined;
}

/** Every group of the ruleset, with its type. */
export const typedGroups = (data: RulesData): TypedGroup[] =>
  [...data.groups.values()].flatMap((tree) => tree.groups.map((g) => ({ ...g, type: tree.type })));

/** Primitive and group key → path under the site base, for links. */
export function rulePaths(data: RulesData): Map<string, string> {
  const { pages } = placeRules(data);
  return new Map([...pages].map(([key, page]) => [key, rulePath(data.ruleset, page, key)]));
}

/** Primitive and group key → name. */
export const ruleNames = (data: RulesData): Map<string, string> =>
  new Map([
    ...data.primitives.map((p) => [ruleKey(p), p.name] as const),
    ...typedGroups(data).map((g) => [ruleKey(g), g.name] as const),
  ]);
