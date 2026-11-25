// What the Library offers (docs/site.md#gallery): the filters and sorts available and the
// defaults, all read from the registry (docs/site.md#type-registry).

import type { Facet, LibraryRecord, Registry } from '../../../../scripts/build-index/index.ts';
import { PUBLISHER } from '../../../../rulesets/module.ts';
import type { PhraseBook } from '../../../../lib/wording/book.ts';
import { phraseBook } from '../phrases.ts';
import { formerTypes } from '../redirects.ts';
import { typeKey } from '../type-key.ts';

export type { Facet, LibraryRecord, Registry };

/** A filterable path: a registry facet, or the `ruleset`, `source`, `author`, or `type` filter. */
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
  /**
   * Values that stand for others: a bare type id for that type in every ruleset, and a renamed
   * type's old key for its current one (docs/site.md#redirects). Keys and values are case-folded.
   */
  aliases?: Record<string, string[]>;
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

/** A type's key is also the type filter's value (docs/site.md#gallery). */
export { typeKey };

/** The pseudo-paths every record has besides its facets (docs/site.md#gallery "Sort"). */
export const NAME = 'name';
export const CREATED = 'createdAt';
export const TYPE = 'type';
export const RULESET = 'ruleset';
export const SOURCE = 'source';
export const AUTHOR = 'author';

/**
 * The ruleset set's filters (docs/site.md#gallery "Filters"): additive, so an entry is in the
 * results' scope when it matches any of them, and the other filters narrow that scope.
 */
export const SCOPE_PATHS: readonly string[] = [RULESET, SOURCE, AUTHOR];

export const isScopePath = (path: string): boolean => SCOPE_PATHS.includes(path);

/** The ruleset set a fresh Library starts with: the publisher's entries, the official content. */
export const defaultScope = (): Map<string, { kind: 'enum'; values: string[] }> => new Map([[AUTHOR, { kind: 'enum', values: [PUBLISHER] }]]);

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
const facetDef = (facet: Facet, ruleset: string, type: string, data: FacetData, books: PhraseBooks): FilterDef => {
  const { groups: grouped, ...rest } = facet;
  if (grouped) {
    const groups = data.groups[`${ruleset}/${type}`] ?? [];
    return { ...rest, groups, labels: Object.fromEntries(groups.map((g) => [g.id, g.label])) };
  }
  if (facet.ref) return { ...rest, labels: data.names };
  const labels = facet.vocabulary === undefined ? undefined : books(ruleset)?.vocabulary[facet.vocabulary];
  return { ...rest, ...(labels ? { labels } : {}) };
};

/** A ruleset's phrase book by its id, or undefined for a ruleset with none. */
export type PhraseBooks = (ruleset: string) => PhraseBook | undefined;

/**
 * The Library's configuration (docs/site.md#gallery): every ruleset and type in the registry. `books`
 * gives each ruleset's phrase book, the repo's own by default.
 */
export function galleryConfig(registry: Registry, data: FacetData = NO_FACET_DATA, books: PhraseBooks = phraseBook): GalleryConfig {
  const types = new Map<string, TypeInfo>();
  const filters = new Map<string, FilterDef>();
  const typeLabels: Record<string, string> = {};
  const rulesetLabels: Record<string, string> = {};

  for (const [rulesetId, ruleset] of Object.entries(registry)) {
    rulesetLabels[rulesetId] = ruleset.label;
    for (const [typeId, type] of Object.entries(ruleset.types)) {
      typeLabels[typeKey(rulesetId, typeId)] = type.label;
      const facets = type.facets.map((facet) => facetDef(facet, rulesetId, typeId, data, books));
      const cardFields = ((type.cardFields as string[] | undefined) ?? [])
        .map((path) => facets.find((facet) => facet.path === path))
        .filter((facet): facet is FilterDef => facet !== undefined);
      types.set(typeKey(rulesetId, typeId), {
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

  const aliases = typeFilterAliases(registry);
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

/**
 * The type filter's aliases: a bare type id for every ruleset's type of that id, so `f.type=spell`
 * keeps working, and a former key, bare or qualified, for the current one.
 */
function typeFilterAliases(registry: Registry): Record<string, string[]> {
  const aliases: Record<string, string[]> = {};
  const add = (from: string, to: string) => {
    const list = (aliases[from.toLowerCase()] ??= []);
    if (!list.includes(to.toLowerCase())) list.push(to.toLowerCase());
  };
  for (const [ruleset, config] of Object.entries(registry)) for (const type of Object.keys(config.types)) add(type, typeKey(ruleset, type));
  for (const { ruleset, from, to } of formerTypes(registry)) {
    add(from, typeKey(ruleset, to));
    add(typeKey(ruleset, from), typeKey(ruleset, to));
  }
  return aliases;
}

/**
 * The definition a record reads a path by: its own type's facet, so a path two types share
 * keeps each type's vocabulary, order, and groups, else the Library's filter for the path.
 */
export function recordDef(config: GalleryConfig, record: Pick<LibraryRecord, 'ruleset' | 'type'>, path: string): FilterDef | undefined {
  return config.types.get(typeKey(record.ruleset, record.type))?.facets.find((f) => f.path === path) ?? filterDef(config, path);
}

/** The definition of a filter path: a known facet, `ruleset`, `source`, `author`, or `type`; undefined for any other path. */
export function filterDef(config: GalleryConfig, path: string): FilterDef | undefined {
  return config.filters.find((f) => f.path === path);
}

/**
 * The types the ruleset set and the type filter allow, in registry order (docs/site.md#gallery
 * "Sort"). The ruleset filter limits the types to its rulesets only while no source or author is
 * checked, since those add entries from any ruleset. Every type when neither limits them.
 */
export function typesInScope(config: GalleryConfig, filters: ReadonlyMap<string, ActiveFilter> = new Map()): TypeInfo[] {
  const values = (path: string) => {
    const filter = filters.get(path);
    return filter?.kind === 'enum' ? filter.values : [];
  };
  const allowed = (path: string, value: string) => values(path).length === 0 || values(path).includes(value);
  const byRuleset = values(SOURCE).length === 0 && values(AUTHOR).length === 0;
  return [...config.types.values()].filter(
    (t) => (!byRuleset || allowed(RULESET, t.ruleset)) && allowed(TYPE, typeKey(t.ruleset, t.type).toLowerCase()),
  );
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
