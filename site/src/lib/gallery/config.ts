// What the Library offers (docs/site.md#gallery): the filters and sorts available and the
// defaults, all read from the registry (docs/site.md#type-registry).

import type { Facet, LibraryRecord, Registry } from '../../../../scripts/build-index/index.ts';
import { phraseBook } from '../phrases.ts';
import { typeAliases } from '../redirects.ts';

export type { Facet, LibraryRecord, Registry };

/** A filterable path: a registry facet, the `ruleset`, `source`, `author`, or `type` filter, or a `tags.<key>`. */
export interface FilterDef {
  path: string;
  label: string;
  kind: 'range' | 'enum';
  format?: string;
  /** The phrase book vocabulary its values read with. */
  vocabulary?: string;
  order?: string[];
  /** Display labels for stored values, such as type ids to type labels, or a vocabulary's names. */
  labels?: Record<string, string>;
  /** Former values read as current ones, such as a renamed type's old key (docs/site.md#redirects). */
  aliases?: Record<string, string>;
  /** Its values are ref keys, read by their targets' names (in `labels`). */
  ref?: boolean;
  /** Its values are the type's groups, nested; a group matches every leaf group in it. */
  groups?: GroupInfo[];
}

/** One group a groups facet offers (docs/rulesets.md#rules-groups). */
export interface GroupInfo {
  id: string;
  /** A category reads by its `noun`, another group by its `qualifier`, else by its name: Weapon › Martial. */
  label: string;
  /** The group it nests in; a category has none. A union nests in its parent too. */
  parent?: string;
  /** The leaf groups it contains, which entries name: itself for a leaf, every leaf in it, or a union's parts'. */
  leaves: string[];
}

/** What the facets need besides the registry, from the build: ref targets' names and each grouped type's groups. */
export interface FacetData {
  /** `<type>/<id>` → name, for every value of a ref facet. */
  names: Record<string, string>;
  /** `<ruleset>/<type>` → its groups, in page order with unions last among their siblings. */
  groups: Record<string, GroupInfo[]>;
  /** Ruleset id → its publisher, the name an author of `"publisher"` reads as (docs/content-model.md#source-and-author). */
  publishers: Record<string, string>;
}

export const NO_FACET_DATA: FacetData = { names: {}, groups: {}, publishers: {} };

export interface SortKey {
  path: string;
  dir: 'asc' | 'desc';
}

export interface GalleryConfig {
  /** The `ruleset`, `source`, `author`, and `type` filters, then every facet of every type, in registry order. */
  filters: FilterDef[];
  /** Ruleset id → its publisher (FacetData). */
  publishers: Record<string, string>;
  defaultSort: SortKey;
  /** Per type, keyed `<ruleset>/<type>`: its label, card fields, and facets in registry order. */
  types: Map<string, TypeInfo>;
}

export interface TypeInfo {
  ruleset: string;
  type: string;
  label: string;
  cardFields: FilterDef[];
  facets: FilterDef[];
  /** The registry's `defaultFilters`: nodes that start open while the type is checked. */
  defaultFilters: string[];
  /** The registry's `defaultSort`, which the redirect from the type's old gallery carries. */
  defaultSort: SortKey;
}

/** The pseudo-paths every record has besides its facets (docs/site.md#gallery "Sort"). */
export const NAME = 'name';
export const CREATED = 'createdAt';
export const TYPE = 'type';
export const RULESET = 'ruleset';
export const SOURCE = 'source';
export const AUTHOR = 'author';

/** The Library sorts by name until the reader picks a sort (docs/site.md#gallery "Sort"). */
export const LIBRARY_SORT: SortKey = { path: NAME, dir: 'asc' };

export function parseSortKey(value: string | undefined): SortKey | undefined {
  const match = /^(.+):(asc|desc)$/.exec(value ?? '');
  return match ? { path: match[1] as string, dir: match[2] as 'asc' | 'desc' } : undefined;
}

/**
 * A facet as a filter. A vocabulary's names become its labels (docs/site.md#wording), and so do
 * a ref facet's target names and a groups facet's group labels.
 */
const facetDef = (facet: Facet, ruleset: string, type: string, data: FacetData): FilterDef => {
  const { groups: grouped, ...rest } = facet;
  if (grouped) {
    const groups = data.groups[`${ruleset}/${type}`] ?? [];
    return { ...rest, groups, labels: Object.fromEntries(groups.map((g) => [g.id, g.label])) };
  }
  if (facet.ref) return { ...rest, labels: data.names };
  const labels = facet.vocabulary === undefined ? undefined : phraseBook(ruleset)?.vocabulary[facet.vocabulary];
  return { ...rest, ...(labels ? { labels } : {}) };
};

/** The Library's configuration (docs/site.md#gallery): every ruleset and type in the registry. */
export function galleryConfig(registry: Registry, data: FacetData = NO_FACET_DATA): GalleryConfig {
  const types = new Map<string, TypeInfo>();
  const filters = new Map<string, FilterDef>();
  const typeLabels: Record<string, string> = {};
  const rulesetLabels: Record<string, string> = {};

  for (const [rulesetId, ruleset] of Object.entries(registry)) {
    rulesetLabels[rulesetId] = ruleset.label;
    for (const [typeId, type] of Object.entries(ruleset.types)) {
      typeLabels[typeId] = type.label;
      const facets = type.facets.map((facet) => facetDef(facet, rulesetId, typeId, data));
      const cardFields = ((type.cardFields as string[] | undefined) ?? [])
        .map((path) => facets.find((facet) => facet.path === path))
        .filter((facet): facet is FilterDef => facet !== undefined);
      types.set(`${rulesetId}/${typeId}`, {
        ruleset: rulesetId,
        type: typeId,
        label: type.label,
        cardFields,
        facets,
        defaultFilters: (type.defaultFilters as string[] | undefined) ?? [],
        defaultSort: parseSortKey(type.defaultSort as string | undefined) ?? LIBRARY_SORT,
      });
      for (const facet of facets) if (!filters.has(facet.path)) filters.set(facet.path, facet);
    }
  }

  const aliases = typeAliases(registry);
  const rulesetFilter: FilterDef = { path: RULESET, label: 'Ruleset', kind: 'enum', order: Object.keys(rulesetLabels), labels: rulesetLabels };
  const sourceFilter: FilterDef = { path: SOURCE, label: 'Source', kind: 'enum' };
  const authorFilter: FilterDef = { path: AUTHOR, label: 'Author', kind: 'enum' };
  const typeFilter: FilterDef = {
    path: TYPE,
    label: 'Type',
    kind: 'enum',
    order: Object.keys(typeLabels),
    labels: typeLabels,
    ...(Object.keys(aliases).length > 0 && { aliases }),
  };
  return {
    filters: [rulesetFilter, sourceFilter, authorFilter, typeFilter, ...filters.values()],
    defaultSort: LIBRARY_SORT,
    types,
    publishers: data.publishers,
  };
}

const TAG_KEY = /^[a-z][a-z0-9-]*$/;

/** A `tags.<key>` path for a valid tag key (docs/content-model.md#tags), or undefined. */
export const tagKey = (path: string): string | undefined => {
  const key = path.startsWith('tags.') ? path.slice('tags.'.length) : undefined;
  return key !== undefined && TAG_KEY.test(key) ? key : undefined;
};

/** The definition of a filter path: a known facet, `ruleset`, `source`, `author`, `type`, or any tag key. */
export function filterDef(config: GalleryConfig, path: string): FilterDef | undefined {
  const known = config.filters.find((f) => f.path === path);
  if (known) return known;
  const key = tagKey(path);
  return key === undefined ? undefined : { path, label: key.replace(/-/g, ' '), kind: 'enum' };
}

/**
 * The types the ruleset and type filters allow, in registry order: every type when neither is
 * active (docs/site.md#gallery "Sort").
 */
export function typesInScope(config: GalleryConfig, filters: ReadonlyMap<string, ActiveFilter> = new Map()): TypeInfo[] {
  const allowed = (path: string, value: string) => {
    const filter = filters.get(path);
    return filter?.kind !== 'enum' || filter.values.length === 0 || filter.values.includes(value);
  };
  return [...config.types.values()].filter((t) => allowed(RULESET, t.ruleset) && allowed(TYPE, t.type));
}

/** The part of an active filter `typesInScope` reads; the gallery state's filter values fit it. */
export type ActiveFilter = { kind: 'enum'; values: string[] } | { kind: 'range' };

/**
 * Sort choices: name, date added, then each facet of the types the ruleset and type filters
 * allow, in registry order (docs/site.md#gallery "Sort"). A path two types share is one choice,
 * labeled as the first of them labels it.
 */
export function sortChoices(config: GalleryConfig, filters?: ReadonlyMap<string, ActiveFilter>): { path: string; label: string }[] {
  const facets = new Map<string, string>();
  for (const type of typesInScope(config, filters)) for (const f of type.facets) if (!facets.has(f.path)) facets.set(f.path, f.label);
  return [
    { path: NAME, label: 'Name' },
    { path: CREATED, label: 'Date added' },
    ...[...facets].map(([path, label]) => ({ path, label })),
  ];
}

/** The sort to apply: the chosen one while the filters offer it, else the Library's default. */
export function validSort(config: GalleryConfig, sort: SortKey, filters?: ReadonlyMap<string, ActiveFilter>): SortKey {
  return sortChoices(config, filters).some((c) => c.path === sort.path) ? sort : config.defaultSort;
}
