// Filtering, search, sort, and value counts (docs/site.md#gallery). Pure functions
// over library.json records, so the island stays a thin view.

import MiniSearch from 'minisearch';
import { NAME, filterDef, tagKey, type FilterDef, type GalleryConfig, type LibraryRecord, type SortKey } from './config.ts';
import { isActive, type FilterValue, type GalleryState } from './state.ts';
import { displayValue, enumValues, numberAt, valueAt } from './values.ts';

/** Whether one record passes one filter. A record missing the value never matches. */
export function matches(record: LibraryRecord, path: string, value: FilterValue): boolean {
  if (value.kind === 'range') {
    const n = numberAt(record, path);
    return n !== undefined && (value.min === undefined || n >= value.min) && (value.max === undefined || n <= value.max);
  }
  const keys = new Set(enumValues(valueAt(record, path)).map((v) => v.key));
  return value.values.some((v) => keys.has(v));
}

/**
 * The filters as matched: a group of a groups facet stands for every leaf group in it
 * (docs/rulesets.md#rules-groups), since entries name only their leaf.
 */
export function matchedFilters(config: GalleryConfig, filters: Map<string, FilterValue>): Map<string, FilterValue> {
  const out = new Map<string, FilterValue>();
  for (const [path, value] of filters) {
    const groups = filterDef(config, path)?.groups;
    if (!groups || value.kind !== 'enum') {
      out.set(path, value);
      continue;
    }
    const leaves = new Map(groups.map((g) => [g.id.toLowerCase(), g.leaves.map((l) => l.toLowerCase())]));
    out.set(path, { kind: 'enum', values: [...new Set(value.values.flatMap((v) => leaves.get(v) ?? [v]))] });
  }
  return out;
}

/** Records passing every active filter (AND across filters, OR within one), optionally skipping one path. */
export const applyFilters = (records: LibraryRecord[], filters: Map<string, FilterValue>, except?: string): LibraryRecord[] =>
  records.filter((record) => [...filters].every(([path, value]) => path === except || !isActive(value) || matches(record, path, value)));

/** The search index (docs/site.md#gallery): name ×3, summary ×2, tag values ×1.5, search text ×1, with prefix and light fuzzy matching. */
export function searchIndex(records: LibraryRecord[]): MiniSearch<LibraryRecord> {
  const index = new MiniSearch<LibraryRecord>({
    idField: 'url',
    fields: ['name', 'summary', 'tags', 'search'],
    extractField: (record, field) =>
      field === 'tags'
        ? Object.values(record.tags).flatMap((v) => (Array.isArray(v) ? v : [v])).map(String).join(' ')
        : String((record as unknown as Record<string, unknown>)[field] ?? ''),
    searchOptions: { boost: { name: 3, summary: 2, tags: 1.5, search: 1 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(records);
  return index;
}

/** Records matching a query, best first. An empty query returns undefined: no search. */
export function search(index: MiniSearch<LibraryRecord>, q: string): string[] | undefined {
  return q.trim() === '' ? undefined : index.search(q.trim()).map((result) => String(result.id));
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
  const def = filterDef(config, key.path);
  const sign = key.dir === 'asc' ? 1 : -1;
  const keyed = records.map((record) => ({ record, value: sortValue(record, key, def) }));
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
  /** The stored form, shown as stored (docs/content-model.md#tags). */
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
  /** Whether results are in relevance order (a query is present) rather than the active sort. */
  byRelevance: boolean;
}

/** The records to show for a state: filters, then search; ordered by relevance or the sort. */
export function computeView(
  records: LibraryRecord[],
  config: GalleryConfig,
  state: GalleryState,
  index: MiniSearch<LibraryRecord>,
): GalleryView {
  const filtered = applyFilters(records, matchedFilters(config, state.filters));
  const hits = search(index, state.q);
  if (hits === undefined) return { results: sortRecords(filtered, state.sort, config), byRelevance: false };
  const byUrl = new Map(filtered.map((r) => [r.url, r]));
  return { results: hits.map((id) => byUrl.get(id)).filter((r): r is LibraryRecord => r !== undefined), byRelevance: true };
}

/** Records passing the search and every filter except one, for that filter's value counts. */
export function withoutFilter(
  config: GalleryConfig,
  records: LibraryRecord[],
  state: GalleryState,
  index: MiniSearch<LibraryRecord>,
  path: string,
): LibraryRecord[] {
  const filtered = applyFilters(records, matchedFilters(config, state.filters), path);
  const hits = search(index, state.q);
  if (hits === undefined) return filtered;
  const ids = new Set(hits);
  return filtered.filter((r) => ids.has(r.url));
}

export { tagKey };
