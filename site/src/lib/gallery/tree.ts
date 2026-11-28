// The filter tree (docs/site.md#gallery "Filters"): Sources, with Official and the homebrew
// sources and authors, then Types, with each type's field, any subfield, and value, built from its
// registry facets.
// Pure, so the island only renders it.

import { PUBLISHER, isOfficial } from '../../../../rulesets/module.ts';
import { label } from '../../../../lib/wording/grammar.ts';
import { AUTHOR, SOURCE, TYPE, filterDef, type FilterDef, type GalleryConfig, type LibraryRecord, type TypeInfo, typeKey } from './config.ts';
import { isActive, type FilterValue, type GalleryState } from './state.ts';
import { displayValue, enumValues, valueAt } from './values.ts';
import { bounds, chips, hasValues, withoutFilter } from './view.ts';

/** One checkable value: a facet's value, a type, or a group with the groups nested in it. */
export interface ValueNode {
  key: string;
  label: string;
  count: number;
  selected: boolean;
  /** Open by default: a value with a selected value inside it. */
  open: boolean;
  children: ValueNode[];
}

export type TreeNode =
  /**
   * A checkable value that may hold filters: a type, checked as the type filter and holding its
   * facets, or Official, checked as the author filter's `"publisher"` and holding none. `path` is
   * the filter its checkbox sets.
   */
  | { kind: 'type'; id: string; path: typeof TYPE | typeof AUTHOR; value: ValueNode; open: boolean; children: TreeNode[] }
  /** A field two or more facets sit in, such as Immunities, or the Sources, Homebrew, or Types node. */
  | { kind: 'field'; id: string; label: string; open: boolean; children: TreeNode[] }
  | { kind: 'enum'; id: string; def: FilterDef; open: boolean; values: ValueNode[] }
  | { kind: 'range'; id: string; def: FilterDef; open: boolean; bounds: { min: number; max: number } | undefined };

/** What the tree reads besides the config: the Library's records and the state. */
interface Context {
  config: GalleryConfig;
  state: GalleryState;
  records: LibraryRecord[];
  /** Records passing the search and every filter but one path's, by path. */
  others: (path: string) => LibraryRecord[];
  /** How many types list a facet at a path. */
  owners: (path: string) => number;
}

const ofType = (records: LibraryRecord[], info: TypeInfo) => records.filter((r) => r.ruleset === info.ruleset && r.type === info.type);

const selectedValues = (value: FilterValue | undefined): string[] => (value?.kind === 'enum' ? value.values : []);

/** A groups facet's values: the groups with a member here (or selected), nested as the groups file nests them. */
function groupValues(def: FilterDef, scoped: LibraryRecord[], others: LibraryRecord[], active: FilterValue | undefined): ValueNode[] {
  const groups = def.groups ?? [];
  const selected = selectedValues(active);
  const leafOf = (records: LibraryRecord[]) => records.flatMap((r) => enumValues(valueAt(r, def.path)).map((v) => v.key));
  const present = new Set(leafOf(scoped));
  const counted = leafOf(others);
  const build = (parent: string | undefined): ValueNode[] =>
    groups
      .filter((g) => g.parent === parent)
      .flatMap((g) => {
        const key = g.id.toLowerCase();
        const leaves = new Set(g.leaves.map((l) => l.toLowerCase()));
        const children = build(g.id);
        if (!selected.includes(key) && ![...leaves].some((l) => present.has(l))) return [];
        return [
          {
            key,
            label: g.label,
            count: counted.filter((leaf) => leaves.has(leaf)).length,
            selected: selected.includes(key),
            open: children.some((c) => c.selected || c.open),
            children,
          },
        ];
      });
  return build(undefined);
}

const keysAt = (path: string, records: LibraryRecord[]) => new Set(records.flatMap((r) => enumValues(valueAt(r, path)).map((v) => v.key)));

/** Whether a value, or a group nested in it, is selected. */
const holdsSelected = (values: ValueNode[]): boolean => values.some((v) => v.selected || holdsSelected(v.children));

/**
 * One facet's node, or none when no record of the type has a value for it and it isn't active.
 * On a path two types share, an enum filter shows checked, and opens the node, only under the
 * types whose entries have a selected value, or under each when none has it (a stale link). A
 * shared range opens only under a checked type, or under each when no type is checked: `claims`.
 */
function facetNode(ctx: Context, def: FilterDef, records: LibraryRecord[], idPrefix: string, open: boolean, claims = true): TreeNode | undefined {
  const active = ctx.state.filters.get(def.path);
  if (!isActive(active) && !hasValues(def.path, records)) return undefined;
  const id = `${idPrefix}${def.path}`;
  if (def.kind === 'range') {
    const opens = isActive(active) && (claims || ctx.owners(def.path) < 2);
    return { kind: 'range', id, def, open: open || opens, bounds: bounds(def.path, records) };
  }
  const scopeOf = (list: LibraryRecord[]) => {
    const types = new Set(records.map((r) => `${r.ruleset}/${r.type}`));
    return list.filter((r) => types.has(`${r.ruleset}/${r.type}`));
  };
  const others = scopeOf(ctx.others(def.path));
  let own = active;
  if (!def.groups && active?.kind === 'enum') {
    const here = keysAt(def.path, records);
    const anywhere = keysAt(def.path, ctx.records);
    own = { kind: 'enum', values: active.values.filter((key) => here.has(key) || !anywhere.has(key)) };
  }
  const values = def.groups
    ? groupValues(def, records, others, active)
    : chips(def, records, others, own).map((chip) => ({
        key: chip.key,
        label: displayValue(def, chip.stored),
        count: chip.count,
        selected: selectedValues(own).includes(chip.key),
        open: false,
        children: [],
      }));
  return { kind: 'enum', id, def, open: open || holdsSelected(values), values };
}

const isOpen = (nodes: TreeNode[]) => nodes.some((n) => n.open);

/** A value's node id inside its facet's (or its parent group's) node. */
export const valueId = (parent: string, key: string) => `${parent}-${key}`;

/**
 * The ids of the nodes that start open, values' groups included. The island reads them once, when
 * the tree first shows; after that only a node's own disclosure opens or closes it.
 */
export function openAtStart(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  const values = (parent: string, list: ValueNode[]) => {
    for (const v of list) {
      const id = valueId(parent, v.key);
      if (v.open && v.children.length > 0) ids.add(id);
      values(id, v.children);
    }
  };
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.open) ids.add(n.id);
      if (n.kind === 'type' || n.kind === 'field') walk(n.children);
      if (n.kind === 'enum') values(n.id, n.values);
    }
  };
  walk(nodes);
  return ids;
}

/**
 * Nests facets by their paths below `stats` or `derived`: facets that share a field, such as
 * `stats.immunities.damage` and `stats.immunities.conditions`, sit in a node named for it
 * (Immunities). A field only one facet sits in adds no node, so `stats.ac.value` reads as AC.
 */
function nest(
  ctx: Context,
  facets: FilterDef[],
  depth: number,
  records: LibraryRecord[],
  idPrefix: string,
  defaults: Set<string>,
  claims: boolean,
): TreeNode[] {
  const segments = (def: FilterDef) => def.path.split('.');
  const fieldOf = (def: FilterDef) => {
    const parts = segments(def);
    return parts.length - 1 > depth + 1 ? parts.slice(0, depth + 2).join('.') : undefined;
  };
  const sizes = new Map<string, number>();
  for (const def of facets) {
    const field = fieldOf(def);
    if (field) sizes.set(field, (sizes.get(field) ?? 0) + 1);
  }
  const out: TreeNode[] = [];
  const done = new Set<string>();
  for (const def of facets) {
    const field = fieldOf(def);
    if (field && (sizes.get(field) ?? 0) > 1) {
      if (done.has(field)) continue;
      done.add(field);
      const inside = facets.filter((f) => fieldOf(f) === field);
      const children = nest(ctx, inside, depth + 1, records, idPrefix, defaults, claims);
      if (children.length === 0) continue;
      out.push({ kind: 'field', id: `${idPrefix}${field}`, label: label(field.split('.').at(-1) ?? field), open: isOpen(children), children });
      continue;
    }
    const node = facetNode(ctx, def, records, idPrefix, defaults.has(def.path), claims);
    if (node) out.push(node);
  }
  return out;
}

/** The labels of the tree's sections and of the homebrew group in Sources. */
export const SOURCES_LABEL = 'Sources';
export const OFFICIAL_LABEL = 'Official';
export const HOMEBREW_LABEL = 'Homebrew';
export const TYPES_LABEL = 'Types';

/**
 * The Sources node, first and open at the start. Official is a checkbox for the author filter's
 * `"publisher"`, the ruleset's own material (docs/content-model.md#source-and-author), shown always
 * since a fresh Library checks it. Homebrew holds the Source and Author filters over the other
 * entries. Like Official, they add entries, so each counts what checking it adds.
 */
function sourcesNode(ctx: Context): TreeNode {
  const authors = selectedValues(ctx.state.filters.get(AUTHOR));
  const official: TreeNode = {
    kind: 'type',
    id: 'sources/official',
    path: AUTHOR,
    value: {
      key: PUBLISHER,
      label: OFFICIAL_LABEL,
      count: ctx.others(AUTHOR).filter(isOfficial).length,
      selected: authors.includes(PUBLISHER),
      open: false,
      children: [],
    },
    open: false,
    children: [],
  };
  const homebrew = ctx.records.filter((r) => !isOfficial(r));
  const filters = [filterDef(ctx.config, SOURCE), filterDef(ctx.config, AUTHOR)]
    .filter((d): d is FilterDef => d !== undefined)
    .map((d) => facetNode(ctx, d, homebrew, 'sources/homebrew:', false))
    .filter((node): node is TreeNode => node !== undefined)
    .map((node) => (node.kind === 'enum' && node.def.path === AUTHOR ? { ...node, values: node.values.filter((v) => v.key !== PUBLISHER) } : node))
    .filter((node) => node.kind !== 'enum' || node.values.length > 0);
  const children: TreeNode[] = [official];
  if (filters.length > 0) children.push({ kind: 'field', id: 'sources/homebrew', label: HOMEBREW_LABEL, open: isOpen(filters), children: filters });
  return { kind: 'field', id: 'sources', label: SOURCES_LABEL, open: true, children };
}

/**
 * The Library's filter tree (docs/site.md#gallery "Filters"): Sources, then Types, holding each
 * type, a value of the type filter holding its own facets. Each type lists only its own records'
 * values, with counts of its own records, though a path two types share is one filter. A type
 * counts its entries among the results. Both sections, and a checked type's registry default
 * filters, start open, and so does every node with an active filter of its own in it.
 */
export function filterTree(config: GalleryConfig, state: GalleryState, records: LibraryRecord[]): TreeNode[] {
  const cache = new Map<string, LibraryRecord[]>();
  const others = (path: string) => {
    let hit = cache.get(path);
    if (!hit) cache.set(path, (hit = withoutFilter(config, records, state, path)));
    return hit;
  };
  const owners = (path: string) => [...config.types.values()].filter((info) => info.facets.some((f) => f.path === path)).length;
  const ctx: Context = { config, state, records, others, owners };
  const selected = selectedValues(state.filters.get(TYPE));
  // A type counts its entries among the results, so checking one type leaves the rest at 0.
  const shown = others('');
  const types: TreeNode[] = [];
  for (const info of config.types.values()) {
    const own = ofType(records, info);
    const key = typeKey(info.ruleset, info.type).toLowerCase();
    if (own.length === 0 && !selected.includes(key)) continue;
    const defaults = new Set(selected.includes(key) ? info.defaultFilters : []);
    const claims = selected.length === 0 || selected.includes(key);
    const children = nest(ctx, info.facets, 0, own, `${info.ruleset}/${info.type}:`, defaults, claims);
    types.push({
      kind: 'type',
      id: `${info.ruleset}/${info.type}`,
      path: TYPE,
      value: {
        key,
        label: info.label,
        count: ofType(shown, info).length,
        selected: selected.includes(key),
        open: false,
        children: [],
      },
      open: isOpen(children),
      children,
    });
  }
  const nodes: TreeNode[] = [sourcesNode(ctx)];
  if (types.length > 0) nodes.push({ kind: 'field', id: 'types', label: TYPES_LABEL, open: true, children: types });
  return nodes;
}
