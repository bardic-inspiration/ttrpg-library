// What a gallery route offers (SPEC.md §9.2, §9.3): its records, the filters
// and sorts available, and the defaults, all read from the registry (§7).

import type { Facet, LibraryRecord, Registry, TypeConfig } from '../../../../scripts/build-index/index.ts';

export type { Facet, LibraryRecord, Registry };

/** A filterable path: a registry facet, the `type` filter, or a `tags.<key>`. */
export interface FilterDef {
  path: string;
  label: string;
  kind: 'range' | 'enum';
  format?: string;
  order?: string[];
  /** Display labels for stored values, such as type ids to type labels. */
  labels?: Record<string, string>;
}

export interface SortKey {
  path: string;
  dir: 'asc' | 'desc';
}

/** A gallery route: `/`, `/<ruleset>/`, or `/<ruleset>/<type>/`. */
export interface GalleryScope {
  ruleset?: string;
  type?: string;
}

export interface GalleryConfig {
  scope: GalleryScope;
  /** The `type` filter (all-types routes) and every facet of every type in scope, in registry order. */
  filters: FilterDef[];
  defaultSort: SortKey;
  /** Filters shown expanded before any is chosen. */
  defaultFilters: string[];
  /** Per type, keyed `<ruleset>/<type>`: its label, card fields, and facet definitions. */
  types: Map<string, { label: string; cardFields: FilterDef[] }>;
}

/** The pseudo-paths every record has besides its facets (§9.3 "Sort"). */
export const NAME = 'name';
export const CREATED = 'createdAt';
export const TYPE = 'type';

/**
 * Every route without a single type lists the latest additions first and
 * offers a type filter (§9.2).
 */
const ALL_TYPES_SORT: SortKey = { path: CREATED, dir: 'desc' };

export function parseSortKey(value: string | undefined): SortKey | undefined {
  const match = /^(.+):(asc|desc)$/.exec(value ?? '');
  return match ? { path: match[1] as string, dir: match[2] as 'asc' | 'desc' } : undefined;
}

const facetDef = (facet: Facet): FilterDef => ({ ...facet });

/** The configuration for one gallery route. */
export function galleryConfig(registry: Registry, scope: GalleryScope): GalleryConfig {
  const types = new Map<string, { label: string; cardFields: FilterDef[] }>();
  const filters = new Map<string, FilterDef>();
  const typeLabels: Record<string, string> = {};
  let single: TypeConfig | undefined;

  for (const [rulesetId, ruleset] of Object.entries(registry)) {
    if (scope.ruleset && scope.ruleset !== rulesetId) continue;
    for (const [typeId, type] of Object.entries(ruleset.types)) {
      if (scope.type && scope.type !== typeId) continue;
      if (scope.type) single = type;
      typeLabels[typeId] = type.label;
      const cardFields = ((type.cardFields as string[] | undefined) ?? [])
        .map((path) => type.facets.find((facet) => facet.path === path))
        .filter((facet): facet is Facet => facet !== undefined)
        .map(facetDef);
      types.set(`${rulesetId}/${typeId}`, { label: type.label, cardFields });
      for (const facet of type.facets) if (!filters.has(facet.path)) filters.set(facet.path, facetDef(facet));
    }
  }

  if (single) {
    return {
      scope,
      filters: [...filters.values()],
      defaultSort: parseSortKey(single.defaultSort as string | undefined) ?? { path: NAME, dir: 'asc' },
      defaultFilters: (single.defaultFilters as string[] | undefined) ?? [],
      types,
    };
  }
  const typeFilter: FilterDef = { path: TYPE, label: 'Type', kind: 'enum', order: Object.keys(typeLabels), labels: typeLabels };
  return {
    scope,
    filters: [typeFilter, ...filters.values()],
    defaultSort: ALL_TYPES_SORT,
    defaultFilters: [TYPE],
    types,
  };
}

/** The records a route shows before any filter. */
export const inScope = (records: LibraryRecord[], scope: GalleryScope): LibraryRecord[] =>
  records.filter((r) => (!scope.ruleset || r.ruleset === scope.ruleset) && (!scope.type || r.type === scope.type));

const TAG_KEY = /^[a-z][a-z0-9-]*$/;

/** A `tags.<key>` path for a valid tag key (§5.3), or undefined. */
export const tagKey = (path: string): string | undefined => {
  const key = path.startsWith('tags.') ? path.slice('tags.'.length) : undefined;
  return key !== undefined && TAG_KEY.test(key) ? key : undefined;
};

/** The definition of a filter path on this route: a known facet, `type`, or any tag key. */
export function filterDef(config: GalleryConfig, path: string): FilterDef | undefined {
  const known = config.filters.find((f) => f.path === path);
  if (known) return known;
  const key = tagKey(path);
  return key === undefined ? undefined : { path, label: key.replace(/-/g, ' '), kind: 'enum' };
}

/** Sort choices: name, date added, then every facet on the route (§9.3). */
export function sortChoices(config: GalleryConfig): { path: string; label: string }[] {
  return [
    { path: NAME, label: 'Name' },
    { path: CREATED, label: 'Date added' },
    ...config.filters.filter((f) => f.path !== TYPE).map((f) => ({ path: f.path, label: f.label })),
  ];
}
