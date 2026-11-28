// Gallery view state and its query string (docs/site.md#gallery "URL state"):
// `?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8`.

import { RULESET, defaultScope, filterDef, isScopePath, parseSortKey, sortChoices, type GalleryConfig, type SortKey } from './config.ts';
import { parseNumber } from './values.ts';

export type FilterValue = { kind: 'enum'; values: string[] } | { kind: 'range'; min?: number; max?: number };

export interface GalleryState {
  q: string;
  sort: SortKey;
  /**
   * Active filters by path, in the order they were added. Enum values are case-folded keys. The
   * ruleset set's filters (`SCOPE_PATHS`) are among them; with none of them, the scope is empty.
   */
  filters: Map<string, FilterValue>;
}

/** A fresh Library: no query, the default sort, and the default ruleset set. */
export const initialState = (config: GalleryConfig): GalleryState => ({ q: '', sort: config.defaultSort, filters: new Map(defaultScope()) });

const sameValues = (a: FilterValue | undefined, b: FilterValue | undefined): boolean =>
  a?.kind === 'enum' && b?.kind === 'enum' ? a.values.length === b.values.length && a.values.every((v) => b.values.includes(v)) : a === b;

/** Whether the ruleset set is the default one (docs/site.md#gallery "Filters"). */
export function isDefaultScope(filters: ReadonlyMap<string, FilterValue>): boolean {
  const fallback = defaultScope();
  const active = [...filters].filter(([path, value]) => isScopePath(path) && isActive(value));
  return active.length === fallback.size && active.every(([path, value]) => sameValues(value, fallback.get(path)));
}

/** Whether a filter value narrows anything; empty ones are dropped. */
export const isActive = (value: FilterValue | undefined): value is FilterValue =>
  value !== undefined && (value.kind === 'enum' ? value.values.length > 0 : value.min !== undefined || value.max !== undefined);

const decode = (text: string): string | undefined => {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return undefined;
  }
};

/** `min..max`, either side optional. */
function parseRange(raw: string): FilterValue | undefined {
  const parts = raw.split('..');
  if (parts.length !== 2) return undefined;
  const [min, max] = parts.map((part) => (part === '' ? undefined : parseNumber(decode(part) ?? 'x')));
  if ((parts[0] !== '' && min === undefined) || (parts[1] !== '' && max === undefined)) return undefined;
  const value: FilterValue = { kind: 'range', ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
  return isActive(value) ? value : undefined;
}

/**
 * Reads a query string into gallery state. Unknown parameters, sorts the
 * filters don't offer (docs/site.md#gallery "Sort"), filters on paths the
 * Library doesn't have, and malformed values are ignored. The last sort offered
 * wins. A query naming any of the ruleset set's filters sets the whole set, so
 * `f.ruleset=` with no value empties it; otherwise the set is the default.
 */
export function parseQuery(search: string, config: GalleryConfig): GalleryState {
  const state = initialState(config);
  const sorts: SortKey[] = [];
  let scoped = false;
  for (const pair of search.replace(/^\?/, '').split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    const key = decode(eq === -1 ? pair : pair.slice(0, eq));
    const raw = eq === -1 ? '' : pair.slice(eq + 1);
    if (key === 'q') state.q = decode(raw) ?? '';
    else if (key === 'sort') {
      const sort = parseSortKey(decode(raw));
      if (sort) sorts.push(sort);
    } else if (key?.startsWith('f.')) {
      const def = filterDef(config, key.slice(2));
      if (!def) continue;
      if (isScopePath(def.path) && !scoped) {
        scoped = true;
        for (const path of defaultScope().keys()) state.filters.delete(path);
      }
      const value: FilterValue | undefined =
        def.kind === 'range'
          ? parseRange(raw)
          : {
              kind: 'enum',
              values: [
                ...new Set(
                  raw
                    .split(',')
                    .map(decode)
                    .filter((v): v is string => !!v)
                    .map((v) => v.toLowerCase())
                    .flatMap((v) => def.aliases?.[v] ?? [v]),
                ),
              ],
            };
      if (isActive(value)) state.filters.set(def.path, value);
    }
  }
  const sortable = new Set(sortChoices(config, state.filters).map((c) => c.path));
  state.sort = sorts.findLast((sort) => sortable.has(sort.path)) ?? state.sort;
  return state;
}

/**
 * RFC 3986 encoding, so `,` and `.` stay free to separate values and range bounds. A `/`, which a
 * query may hold as is, stays literal, so `f.type=dnd-5e-2024/spell` reads as written.
 */
const encode = (text: string): string =>
  encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, '/');

/**
 * Writes gallery state as a query string (with a leading `?`, or `''` for the
 * default view). Filters follow the Library's filter order, so
 * one view always has one URL. The default sort and the default ruleset set are
 * left out; an empty ruleset set is `f.ruleset=`.
 */
export function toQuery(state: GalleryState, config: GalleryConfig): string {
  const parts: string[] = [];
  if (state.q.trim() !== '') parts.push(`q=${encode(state.q.trim())}`);
  const { sort } = state;
  if (sort.path !== config.defaultSort.path || sort.dir !== config.defaultSort.dir) parts.push(`sort=${encode(sort.path)}:${sort.dir}`);
  const order = config.filters.map((f) => f.path);
  const rank = (path: string) => (order.includes(path) ? order.indexOf(path) : order.length);
  const paths = [...state.filters.keys()].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const scopeDefault = isDefaultScope(state.filters);
  if (![...state.filters].some(([path, value]) => isScopePath(path) && isActive(value))) parts.push(`f.${RULESET}=`);
  for (const path of paths) {
    const value = state.filters.get(path);
    if (!isActive(value) || (scopeDefault && isScopePath(path))) continue;
    const text =
      value.kind === 'enum'
        ? value.values.map(encode).join(',')
        : `${value.min === undefined ? '' : value.min}..${value.max === undefined ? '' : value.max}`;
    parts.push(`f.${encode(path)}=${text}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
