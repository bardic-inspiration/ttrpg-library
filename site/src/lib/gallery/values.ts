// Reading a filter or sort path off a library.json record (docs/site.md#index-build, docs/site.md#gallery).

import { formatValue } from '../format.ts';
import { AUTHOR, CREATED, NAME, RULESET, SOURCE, TYPE, typeKey, type FilterDef, type LibraryRecord } from './config.ts';

/** The raw value at a path: `name`, `createdAt`, `type` (as `<ruleset>/<type>`), `ruleset`, `source`, `author`, or a facet. */
export function valueAt(record: LibraryRecord, path: string): unknown {
  if (path === NAME) return record.name;
  if (path === CREATED) return record.createdAt;
  if (path === TYPE) return typeKey(record.ruleset, record.type);
  if (path === RULESET) return record.ruleset;
  if (path === SOURCE) return record.source;
  if (path === AUTHOR) return record.author;
  return record.facets[path];
}

/**
 * The values an enum filter matches on, as case-folded keys mapped to the
 * stored form for display (docs/site.md#gallery "Filters": comparisons ignore case, display keeps it).
 * Arrays give one value per item; booleans and numbers read as text.
 */
export function enumValues(value: unknown): { key: string; stored: string | number | boolean }[] {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return items
    .filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
    .map((item) => ({ key: String(item).toLowerCase(), stored: item }));
}

/** A span: a range facet's value stored as a minimum and a maximum (docs/site.md#type-registry). */
export interface Span {
  min: number;
  max: number;
}

/** Whether a stored value is a span, `{ min, max }`. */
export const isSpan = (value: unknown): value is Span =>
  typeof value === 'object' && value !== null && typeof (value as Span).min === 'number' && typeof (value as Span).max === 'number';

/** A range filter's value as a span: a number spans itself. Undefined when the record has none. */
export const spanAt = (record: LibraryRecord, path: string): Span | undefined => {
  const value = valueAt(record, path);
  if (typeof value === 'number') return { min: value, max: value };
  return isSpan(value) ? { min: value.min, max: value.max } : undefined;
};

/** How one stored value of a filter reads: a span as its bounds, "75–675", or one number when they're equal. */
export const displayValue = (def: FilterDef, stored: unknown): string => {
  if (isSpan(stored)) {
    const [min, max] = [formatValue(stored.min, def.format), formatValue(stored.max, def.format)];
    return min === max ? min : `${min}–${max}`;
  }
  return (typeof stored === 'string' && def.labels?.[stored]) || formatValue(stored, def.format);
};

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
