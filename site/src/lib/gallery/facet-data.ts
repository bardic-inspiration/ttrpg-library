// What the filter tree reads from the build besides library.json (docs/site.md#gallery "Filters"):
// the names a ref facet's values read by, the groups a groups facet nests its values in, each
// ruleset's publisher, whom an author of "publisher" reads as, and the facets that read as chips.

import registryJson from '@library/config/types.json' with { type: 'json' };
import type { GroupTree, RulesData, RulesGroup } from '../../../../lib/rules.ts';
import { entryNames, loadEntries, type LoadedEntry } from '../library.ts';
import { loadRules, rulesetPublishers } from '../rules.ts';
import { isChip, type Schema } from '../../../../scripts/build-index/schema-walk.ts';
import type { FacetData, GroupInfo, Registry } from './config.ts';

/** Every ruleset's schema files, by ruleset id and then file name, such as `common.schema.json`. */
export type RulesetSchemas = Record<string, Map<string, Schema>>;

const schemaFiles = import.meta.glob<Schema>('@library/rulesets/*/schemas/*.schema.json', { eager: true, import: 'default' });

/** The library's schema files, read at build time. */
export function loadSchemas(): RulesetSchemas {
  const out: RulesetSchemas = {};
  for (const [path, schema] of Object.entries(schemaFiles)) {
    const match = /rulesets\/([^/]+)\/schemas\/([^/]+)$/.exec(path);
    if (match) (out[match[1] as string] ??= new Map()).set(match[2] as string, schema);
  }
  return out;
}

/** Per type, its `stats.*` facets whose schema declares `"display": "chip"` (docs/content-model.md#display). */
export function chipFacets(registry: Registry, schemas: RulesetSchemas): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [ruleset, { types }] of Object.entries(registry)) {
    const files = schemas[ruleset];
    for (const [type, config] of Object.entries(types)) {
      const root = files?.get(`${type}.schema.json`);
      if (!files || !root) continue;
      const paths = config.facets
        .map((f) => f.path)
        .filter((path) => path.startsWith('stats.') && isChip(path.slice('stats.'.length), { root, files }));
      if (paths.length > 0) out[`${ruleset}/${type}`] = paths;
    }
  }
  return out;
}

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
 * The facet data for the gallery: the name of every ref a ref facet holds in `entries`, the
 * groups of every type with a groups facet, each ruleset's publisher, and the chip facets.
 */
export function facetData(
  registry: Registry,
  entries: Source[],
  names: Map<string, string>,
  rules: RulesData[],
  publishers: Record<string, string> = rulesetPublishers(),
  schemas: RulesetSchemas = loadSchemas(),
): FacetData {
  const out: FacetData = { names: {}, groups: {}, publishers, chips: chipFacets(registry, schemas) };
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

/**
 * The whole library's facet data, at build time: what the Library's island and the print view,
 * which reads a gallery query (docs/export.md#print), are given. Pass the rules and entries a page
 * has already loaded.
 */
export const libraryFacetData = (rules: RulesData[] = loadRules(), all: LoadedEntry[] = loadEntries(rules)): FacetData =>
  facetData(registryJson as unknown as Registry, all, entryNames(all, rules), rules);
