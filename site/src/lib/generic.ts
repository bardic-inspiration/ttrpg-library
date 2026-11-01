// `stats` as labeled lines for the generic template (SPEC.md §9.5), for a
// type with no template of its own. It formats stored values only, by
// presence alone (§5.8): an omitted key has no line, and a present one
// always does, even at 0 or false.

import type { PropertyLine } from './template.ts';

/** `castingTime` → "Casting time". */
const humanize = (key: string): string => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const isRef = (value: unknown): value is { ref: string } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { ref?: unknown }).ref === 'string' && Object.keys(value).length === 1;

/** One value as text: a ref reads as its target's name, a list joins its items. */
function text(value: unknown, names: Map<string, string>): string {
  if (isRef(value)) return names.get(value.ref) ?? value.ref;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item) => text(item, names)).join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([key, inner]) => `${humanize(key)}: ${text(inner, names)}`).join('; ');
  }
  return String(value);
}

/** Lines for `stats`: nested objects flatten into "Parent child" labels, in stored order. */
export function genericLines(stats: unknown, names: Map<string, string>, prefix = ''): PropertyLine[] {
  if (typeof stats !== 'object' || stats === null) return [];
  return Object.entries(stats).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} ${humanize(key).toLowerCase()}` : humanize(key);
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !isRef(value)) {
      return genericLines(value, names, label);
    }
    return [{ label, value: text(value, names) }];
  });
}
