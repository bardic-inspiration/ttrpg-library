// Reading a filter or sort path off a library.json record (SPEC.md §9.1, §9.3).

import { formatValue } from '../format.ts';
import { CREATED, NAME, TYPE, tagKey, type FilterDef, type LibraryRecord } from './config.ts';

/** The raw value at a path: `name`, `createdAt`, `type`, a facet, or `tags.<key>`. */
export function valueAt(record: LibraryRecord, path: string): unknown {
  if (path === NAME) return record.name;
  if (path === CREATED) return record.createdAt;
  if (path === TYPE) return record.type;
  const key = tagKey(path);
  if (key !== undefined) return record.tags[key];
  return record.facets[path];
}

/**
 * The values an enum filter matches on, as case-folded keys mapped to the
 * stored form for display (§5.3: comparisons ignore case, display keeps it).
 * Arrays give one value per item; booleans and numbers read as text.
 */
export function enumValues(value: unknown): { key: string; stored: string | number | boolean }[] {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return items
    .filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
    .map((item) => ({ key: String(item).toLowerCase(), stored: item }));
}

/** A range filter's number, or undefined when the record has none. */
export const numberAt = (record: LibraryRecord, path: string): number | undefined => {
  const value = valueAt(record, path);
  return typeof value === 'number' ? value : undefined;
};

/** How one stored value of a filter reads. */
export const displayValue = (def: FilterDef, stored: unknown): string =>
  (typeof stored === 'string' && def.labels?.[stored]) || formatValue(stored, def.format);

/**
 * Parses a range bound typed by a reader or read from the URL. Fractions such
 * as `1/8` are accepted, since CR is written that way.
 */
export function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? undefined : Number(fraction[1]) / denominator;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
