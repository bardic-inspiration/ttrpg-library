// What the filter tree reads from the build besides library.json (docs/site.md#gallery "Filters"):
// the names a ref facet's values read by, and the groups a groups facet nests its values in.

import type { GroupTree, RulesData, RulesGroup } from '../../../../lib/rules.ts';
import type { FacetData, GroupInfo, Registry } from './config.ts';

interface Source {
  entry: { ruleset: string; type: string; stats: unknown };
  derived: Record<string, unknown>;
}

/** The value at a dotted facet path such as `stats.class`, read from `stats` and the derived values. */
function at(source: Source, path: string): unknown {
  let current: unknown = { stats: source.entry.stats, derived: source.derived };
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const refsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(refsIn);
  const ref = typeof value === 'object' && value !== null ? (value as { ref?: unknown }).ref : undefined;
  return typeof ref === 'string' ? [ref] : [];
};

/** A group's label in the tree: a category by its noun ("Weapon"), another group by its qualifier ("Martial"), else its name. */
const groupLabel = (group: RulesGroup): string => (group.parent === undefined ? group.noun : group.qualifier) ?? group.name;

/** A type's groups in page order, each before the groups nested in it, with the leaf groups each contains. */
export function groupInfo(tree: GroupTree): GroupInfo[] {
  const leaves = (group: RulesGroup): string[] =>
    group.union
      ? group.union.flatMap((part) => {
          const inner = tree.byId.get(part);
          return inner ? leaves(inner) : [];
        })
      : [...tree.descendants(group.id)].filter((id) => tree.isLeaf(id));
  const out: GroupInfo[] = [];
  const walk = (parent: string | undefined) => {
    for (const group of tree.children(parent)) {
      out.push({ id: group.id, label: groupLabel(group), ...(group.parent !== undefined && { parent: group.parent }), leaves: leaves(group) });
      if (!group.union) walk(group.id);
    }
  };
  walk(undefined);
  return out;
}

/**
 * The facet data for the gallery: the name of every ref a ref facet holds in `entries`, and the
 * groups of every type with a groups facet.
 */
export function facetData(registry: Registry, entries: Source[], names: Map<string, string>, rules: RulesData[]): FacetData {
  const out: FacetData = { names: {}, groups: {} };
  for (const source of entries) {
    const facets = registry[source.entry.ruleset]?.types[source.entry.type]?.facets ?? [];
    for (const facet of facets.filter((f) => f.ref)) {
      for (const key of refsIn(at(source, facet.path))) {
        const name = names.get(key);
        if (name !== undefined) out.names[key] = name;
      }
    }
  }
  for (const [ruleset, { types }] of Object.entries(registry)) {
    for (const [type, config] of Object.entries(types)) {
      if (!config.facets.some((f) => f.groups)) continue;
      const tree = rules.find((data) => data.ruleset === ruleset)?.groups.get(type);
      if (tree) out.groups[`${ruleset}/${type}`] = groupInfo(tree);
    }
  }
  out.names = Object.fromEntries(Object.entries(out.names).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return out;
}
