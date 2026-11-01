// Gallery view state and its query string (SPEC.md §9.3 "URL state"):
// `?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8`.

import { filterDef, parseSortKey, sortChoices, type GalleryConfig, type SortKey } from './config.ts';
import { parseNumber } from './values.ts';

export type FilterValue = { kind: 'enum'; values: string[] } | { kind: 'range'; min?: number; max?: number };

export interface GalleryState {
  q: string;
  sort: SortKey;
  /** Active filters by path, in the order they were added. Enum values are case-folded keys. */
  filters: Map<string, FilterValue>;
}

export const initialState = (config: GalleryConfig): GalleryState => ({ q: '', sort: config.defaultSort, filters: new Map() });

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
 * Reads a query string into gallery state. Unknown parameters, unknown sort
 * paths, filters on paths the route doesn't have, and malformed values are
 * ignored.
 */
export function parseQuery(search: string, config: GalleryConfig): GalleryState {
  const state = initialState(config);
  const sortable = new Set(sortChoices(config).map((c) => c.path));
  for (const pair of search.replace(/^\?/, '').split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    const key = decode(eq === -1 ? pair : pair.slice(0, eq));
    const raw = eq === -1 ? '' : pair.slice(eq + 1);
    if (key === 'q') state.q = decode(raw) ?? '';
    else if (key === 'sort') {
      const sort = parseSortKey(decode(raw));
      if (sort && sortable.has(sort.path)) state.sort = sort;
    } else if (key?.startsWith('f.')) {
      const def = filterDef(config, key.slice(2));
      if (!def) continue;
      const value: FilterValue | undefined =
        def.kind === 'range'
          ? parseRange(raw)
          : {
              kind: 'enum',
              values: [...new Set(raw.split(',').map(decode).filter((v): v is string => !!v).map((v) => v.toLowerCase()))],
            };
      if (isActive(value)) state.filters.set(def.path, value);
    }
  }
  return state;
}

/** RFC 3986 encoding, so `,` and `.` stay free to separate values and range bounds. */
const encode = (text: string): string =>
  encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Writes gallery state as a query string (with a leading `?`, or `''` for the
 * default view). Filters follow the route's filter order, then tags by key, so
 * one view always has one URL. The default sort is left out.
 */
export function toQuery(state: GalleryState, config: GalleryConfig): string {
  const parts: string[] = [];
  if (state.q.trim() !== '') parts.push(`q=${encode(state.q.trim())}`);
  const { sort } = state;
  if (sort.path !== config.defaultSort.path || sort.dir !== config.defaultSort.dir) parts.push(`sort=${encode(sort.path)}:${sort.dir}`);
  const order = config.filters.map((f) => f.path);
  const rank = (path: string) => (order.includes(path) ? order.indexOf(path) : order.length);
  const paths = [...state.filters.keys()].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const path of paths) {
    const value = state.filters.get(path);
    if (!isActive(value)) continue;
    const text =
      value.kind === 'enum'
        ? value.values.map(encode).join(',')
        : `${value.min === undefined ? '' : value.min}..${value.max === undefined ? '' : value.max}`;
    parts.push(`f.${encode(path)}=${text}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
