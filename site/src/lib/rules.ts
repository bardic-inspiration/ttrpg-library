// Rules data for the site (docs/rulesets.md#rules-data, docs/site.md#rules-pages): each ruleset's
// primitives, groups, and rules pages, read at build time. Validation has
// already run in build:index, so the data here is known good.

import { titleCase } from '../../../lib/wording/grammar.ts';
import type { RefLabels, RulesetDefinition, RulesetModule } from '../../../rulesets/module.ts';
import { GroupTree, anchorId, byName, extensionPage, ruleKey, type PageBlock, type Primitive, type RulesData, type RulesGroup, type RulesPage } from '../../../lib/rules.ts';
import type { Links } from '../../../scripts/validate/refs.ts';
import { allComponents, entryNames, linkAll, refPaths, refTargets, rulesetModule, type Entry, type LoadedEntry } from './library.ts';
import type { RefTarget } from './refs.ts';
import { sectionId, type TocItem } from './accordion.ts';

const definitions = import.meta.glob<RulesetDefinition>('../../../rulesets/*/ruleset.json', { eager: true, import: 'default' });
const ruleFiles = import.meta.glob<unknown>('../../../rulesets/*/rules/**/*.json', { eager: true, import: 'default' });

/**
 * One ruleset's rules data from its files, keyed by their path inside
 * `rules/`: `<type>/<id>.json`, `<type>-groups.json`, and `pages.json`.
 */
export function rulesData(definition: RulesetDefinition, files: Record<string, unknown>): RulesData {
  const types = definition.rules ?? [];
  const primitives: Primitive[] = [];
  const groups = new Map<string, GroupTree>();
  for (const { type } of types) {
    const groupList = files[`${type}-groups.json`] as RulesGroup[] | undefined;
    if (groupList) groups.set(type, new GroupTree(type, groupList));
    for (const [path, data] of Object.entries(files)) if (path.startsWith(`${type}/`)) primitives.push(data as Primitive);
  }
  primitives.sort((a, b) => a.name.localeCompare(b.name));
  return { ruleset: definition.id, types, primitives, groups, pages: (files['pages.json'] as RulesPage[] | undefined) ?? [] };
}

/** Every ruleset's rules data under rulesets/, for rulesets that have rules types. */
export function loadRules(): RulesData[] {
  return Object.entries(definitions)
    .filter(([, definition]) => (definition.rules ?? []).length > 0)
    .map(([path, definition]) => {
      const prefix = path.replace(/ruleset\.json$/, 'rules/');
      const files = Object.fromEntries(
        Object.entries(ruleFiles)
          .filter(([file]) => file.startsWith(prefix))
          .map(([file, data]) => [file.slice(prefix.length), data]),
      );
      return rulesData(definition, files);
    });
}

/** Everything a rules page renders from: one ruleset's data, with names, paths, and links across the library. */
export interface RulesContext {
  data: RulesData;
  names: Map<string, string>;
  paths: Map<string, string>;
  targets: Map<string, RefTarget>;
  /** Forward refs and back-refs of every primitive and group, by key. */
  links: Map<string, Links>;
  /** The ruleset's extension entries (entries of its rules types), by name. */
  extensions: LoadedEntry[];
  labelFor: (type: string, path: string) => RefLabels;
  /** A primitive's derived values, for sorting a group's members. */
  derive: (primitive: { type: string; stats: unknown }) => Record<string, unknown>;
}

/**
 * The context for one ruleset's rules pages. `rules` is every ruleset's data,
 * for names and paths; `module` defaults to the ruleset's own.
 */
export function rulesContext(
  data: RulesData,
  all: LoadedEntry[],
  rules: RulesData[],
  module: RulesetModule = rulesetModule(data.ruleset),
): RulesContext {
  const types = new Set(data.types.map((t) => t.type));
  return {
    data,
    names: entryNames(all, rules),
    paths: refPaths(rules, all),
    targets: refTargets(all, rules),
    // Components link too: a rule's back-links include the features that mention it.
    links: linkAll(
      [...all, ...allComponents(all)].map(({ entry }) => entry as Entry),
      rules,
    ),
    extensions: all.filter(({ entry }) => entry.ruleset === data.ruleset && types.has(entry.type)),
    labelFor: (type, path) => module.refLabels(type, path),
    derive: (primitive) => module.derive(primitive.type, primitive.stats, data),
  };
}

/**
 * A tag or type id as printed in brackets after a name: "area-of-effect" reads "Area of
 * Effect", "condition" reads "Condition".
 */
export const tagLabel = (id: string): string => titleCase(id);

/** A primitive that is only rules text (a weapon property), with an optional tag (a glossary term). */
export const textOnly = (primitive: Primitive): boolean =>
  typeof primitive.stats.text === 'string' && Object.keys(primitive.stats).every((k) => k === 'text' || k === 'tag');

/** A primitive's heading: its name, with a text-only primitive's tag in brackets, "Attack [Action]". */
export function primitiveTitle(primitive: Primitive): string {
  const tag = primitive.stats.tag;
  return textOnly(primitive) && typeof tag === 'string' ? `${primitive.name} [${tagLabel(tag)}]` : primitive.name;
}

/**
 * What a primitives block shows, by name: its type's primitives, and each cross-listed type's
 * primitives marked `cross`, which link to their own page instead of being shown here.
 */
export function blockPrimitives(data: RulesData, block: Extract<PageBlock, { kind: 'primitives' }>): { primitive: Primitive; cross: boolean }[] {
  const others = new Set(block.crossList ?? []);
  return data.primitives
    .filter((p) => p.type === block.type || others.has(p.type))
    .sort(byName)
    .map((primitive) => ({ primitive, cross: primitive.type !== block.type }));
}

/** The extensions listed at the bottom of one rules page. */
export const pageExtensions = (ctx: RulesContext, page: string): LoadedEntry[] =>
  ctx.extensions.filter(({ entry }) => extensionPage(ctx.data, entry) === page);

/** The anchor of a rules page's Extensions section. */
export const EXTENSIONS_SECTION = sectionId('Extensions');

/**
 * A rules page's table of contents (docs/site.md#accordion-pages), in page order: each titled
 * prose section, each primitive (not a cross-listed one, which lives on its own page), each group
 * with the groups nested in it, then Extensions when the page lists any.
 */
export function pageContents(ctx: RulesContext, page: RulesPage): TocItem[] {
  const groupItem = (tree: GroupTree, id: string): TocItem => {
    const children = tree.children(id).map((child) => groupItem(tree, child.id));
    return { id: anchorId(ruleKey({ type: tree.type, id })), label: tree.byId.get(id)!.name, ...(children.length > 0 && { children }) };
  };
  const items = page.blocks.flatMap((block): TocItem[] => {
    if (block.kind === 'prose') return block.title ? [{ id: sectionId(block.title), label: block.title }] : [];
    if (block.kind === 'primitives') {
      return blockPrimitives(ctx.data, block)
        .filter(({ cross }) => !cross)
        .map(({ primitive }) => ({ id: anchorId(ruleKey(primitive)), label: primitiveTitle(primitive) }));
    }
    const slash = block.group.indexOf('/');
    const tree = ctx.data.groups.get(block.group.slice(0, slash));
    return tree ? [groupItem(tree, block.group.slice(slash + 1))] : [];
  });
  return pageExtensions(ctx, page.id).length > 0 ? [...items, { id: EXTENSIONS_SECTION, label: 'Extensions' }] : items;
}

/**
 * Names, qualifiers, and category nouns of equipment keys, for wording an item's base item
 * (docs/rulesets.md#items): a group's noun is its category's.
 */
export function baseLookup(rules: RulesData[]): (key: string) => { name: string; qualifier?: string; noun?: string; group: boolean } | undefined {
  const entries = new Map<string, { name: string; qualifier?: string; noun?: string; group: boolean }>();
  for (const data of rules) {
    for (const p of data.primitives) entries.set(`${p.type}/${p.id}`, { name: p.name, group: false });
    for (const tree of data.groups.values()) {
      for (const g of tree.groups) {
        let root = g;
        while (root.parent !== undefined) root = tree.byId.get(root.parent) ?? root;
        entries.set(`${tree.type}/${g.id}`, {
          name: g.name,
          group: true,
          ...(g.qualifier ? { qualifier: g.qualifier } : {}),
          ...(root.noun ? { noun: root.noun } : {}),
        });
      }
    }
  }
  return (key) => entries.get(key);
}
