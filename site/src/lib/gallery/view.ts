// Filtering, search, sort, and value counts (docs/site.md#gallery). Pure functions
// over library.json records, so the island stays a thin view.

import { NAME, isScopePath, recordDef, typeKey, type FilterDef, type GalleryConfig, type LibraryRecord, type SortKey } from './config.ts';
import { isActive, type FilterValue, type GalleryState } from './state.ts';
import { displayValue, enumValues, numberAt, valueAt } from './values.ts';

/**
 * A filter as matched: its values, and for a groups facet the leaf groups each type's groups
 * stand for, by `<ruleset>/<type>`, since a path two types share keeps each type's groups.
 */
export type MatchedValue = FilterValue | { kind: 'enum'; values: string[]; byType: Map<string, string[]> };

/** Whether one record passes one filter. A record missing the value never matches. */
export function matches(record: LibraryRecord, path: string, value: MatchedValue): boolean {
  if (value.kind === 'range') {
    const n = numberAt(record, path);
    return n !== undefined && (value.min === undefined || n >= value.min) && (value.max === undefined || n <= value.max);
  }
  const keys = new Set(enumValues(valueAt(record, path)).map((v) => v.key));
  const values = ('byType' in value && value.byType.get(typeKey(record.ruleset, record.type))) || value.values;
  return values.some((v) => keys.has(v));
}

/**
 * The filters as matched: a group of a groups facet stands for every leaf group in it
 * (docs/rulesets.md#rules-groups), since entries name only their leaf, and each type reads
 * the group by its own groups.
 */
export function matchedFilters(config: GalleryConfig, filters: Map<string, FilterValue>): Map<string, MatchedValue> {
  const out = new Map<string, MatchedValue>();
  for (const [path, value] of filters) {
    const grouped = [...config.types.values()].flatMap((info) => {
      const groups = info.facets.find((f) => f.path === path)?.groups;
      return groups ? [{ key: typeKey(info.ruleset, info.type), groups }] : [];
    });
    if (grouped.length === 0 || value.kind !== 'enum') {
      out.set(path, value);
      continue;
    }
    const byType = new Map(
      grouped.map(({ key, groups }) => {
        const leaves = new Map(groups.map((g) => [g.id.toLowerCase(), g.leaves.map((l) => l.toLowerCase())]));
        return [key, [...new Set(value.values.flatMap((v) => leaves.get(v) ?? [v]))]];
      }),
    );
    out.set(path, { kind: 'enum', values: value.values, byType });
  }
  return out;
}

/**
 * Records passing the filters (docs/site.md#gallery "Filters"): in the ruleset set's scope, matching
 * any of its filters, then every other active filter (AND across filters, OR within one). Skipping
 * one path skips that filter; skipping one of the ruleset set's skips the whole set, so a ruleset,
 * source, or author counts what checking it adds.
 */
export function applyFilters(records: LibraryRecord[], filters: Map<string, MatchedValue>, except?: string): LibraryRecord[] {
  const active = [...filters].filter(([path, value]) => path !== except && isActive(value));
  const scope = active.filter(([path]) => isScopePath(path));
  const narrowing = active.filter(([path]) => !isScopePath(path));
  const inScope = (record: LibraryRecord) =>
    (except !== undefined && isScopePath(except)) || scope.some(([path, value]) => matches(record, path, value));
  return records.filter((record) => inScope(record) && narrowing.every(([path, value]) => matches(record, path, value)));
}

/** Text folded for matching: lowercase, with accents stripped, so "é" matches "e". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Records whose name contains the query (docs/site.md#gallery "Search"), ignoring case and
 * accents. A blank query leaves the records as they are.
 */
export function searchNames(records: LibraryRecord[], q: string): LibraryRecord[] {
  const query = fold(q.trim());
  return query === '' ? records : records.filter((record) => fold(record.name).includes(query));
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

const compareCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The last tie-break: ruleset, type, then id, which together are unique, so order never depends on input order. */
const compareIdentity = (a: LibraryRecord, b: LibraryRecord) =>
  compareCode(a.ruleset, b.ruleset) || compareCode(a.type, b.type) || compareCode(a.id, b.id);

/**
 * The value a record sorts by: the first item of an array, an ordered enum by its declared
 * position, a ref by its target's name.
 */
function sortValue(record: LibraryRecord, key: SortKey, def: FilterDef | undefined): string | number | boolean | undefined {
  let value = valueAt(record, key.path);
  if (Array.isArray(value)) value = value[0];
  if (typeof value === 'string' && def?.ref) return displayValue(def, value);
  if (typeof value === 'string' && def?.order) {
    const i = def.order.indexOf(value);
    return i === -1 ? def.order.length : i;
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
}

/** Sorts by one key; entries missing the value go last in either direction, ties by name, then ruleset, type, and id. */
export function sortRecords(records: LibraryRecord[], key: SortKey, config: GalleryConfig): LibraryRecord[] {
  const sign = key.dir === 'asc' ? 1 : -1;
  const keyed = records.map((record) => ({ record, value: sortValue(record, key, recordDef(config, record, key.path)) }));
  return keyed
    .sort((a, b) => {
      if (a.value === undefined || b.value === undefined) {
        if (a.value !== b.value) return a.value === undefined ? 1 : -1;
      } else if (a.value !== b.value) {
        const order =
          typeof a.value === 'string' && typeof b.value === 'string'
            ? compareText(a.value, b.value)
            : Number(a.value) - Number(b.value);
        if (order !== 0) return sign * order;
      }
      return (key.path === NAME ? 0 : compareText(a.record.name, b.record.name)) || compareIdentity(a.record, b.record);
    })
    .map(({ record }) => record);
}

export interface Chip {
  key: string;
  /** The stored form, shown as stored (docs/site.md#gallery "Filters"). */
  stored: string | number | boolean;
  count: number;
}

/**
 * The values of an enum filter: every value present in `scoped`, plus any selected value,
 * each with how many of `others` it matches. `others` has the search and every other filter
 * applied, so a value's count is what selecting it adds. Ordered enums keep their order; a
 * ref reads by its target's name, so it sorts by that name.
 */
export function chips(def: FilterDef, scoped: LibraryRecord[], others: LibraryRecord[], active?: FilterValue): Chip[] {
  const stored = new Map<string, string | number | boolean>();
  for (const record of scoped) for (const v of enumValues(valueAt(record, def.path))) if (!stored.has(v.key)) stored.set(v.key, v.stored);
  // A selected value no record has (from a stale link) stays visible, so it can be cleared.
  if (active?.kind === 'enum') for (const key of active.values) if (!stored.has(key)) stored.set(key, key);
  const counts = new Map<string, number>();
  for (const record of others) for (const key of new Set(enumValues(valueAt(record, def.path)).map((v) => v.key))) counts.set(key, (counts.get(key) ?? 0) + 1);
  const rank = (chip: Chip) => (def.order ? def.order.findIndex((o) => o.toLowerCase() === chip.key) : -1);
  const text = (chip: Chip) => (def.ref ? displayValue(def, chip.stored) : String(chip.stored));
  return [...stored]
    .map(([key, value]) => ({ key, stored: value, count: counts.get(key) ?? 0 }))
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return (ra === -1 ? Infinity : ra) - (rb === -1 ? Infinity : rb);
      if (typeof a.stored === 'number' && typeof b.stored === 'number') return a.stored - b.stored;
      return compareText(text(a), text(b));
    });
}

/** The lowest and highest value of a range filter among the records. */
export function bounds(path: string, scoped: LibraryRecord[]): { min: number; max: number } | undefined {
  const values = scoped.map((r) => numberAt(r, path)).filter((n): n is number => n !== undefined);
  return values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : undefined;
}

/** Whether any record has a value at this path. */
export const hasValues = (path: string, records: LibraryRecord[]): boolean =>
  records.some((r) => enumValues(valueAt(r, path)).length > 0);

export interface GalleryView {
  results: LibraryRecord[];
}

/** The records to show for a state: filtered, searched by name, and in the active sort. */
export function computeView(records: LibraryRecord[], config: GalleryConfig, state: GalleryState): GalleryView {
  const filtered = applyFilters(records, matchedFilters(config, state.filters));
  return { results: sortRecords(searchNames(filtered, state.q), state.sort, config) };
}

/** Records passing the search and every filter except one, for that filter's value counts. */
export function withoutFilter(config: GalleryConfig, records: LibraryRecord[], state: GalleryState, path: string): LibraryRecord[] {
  return searchNames(applyFilters(records, matchedFilters(config, state.filters), path), state.q);
}
