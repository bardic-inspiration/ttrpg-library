// `stats` as labeled lines for the generic template (docs/site.md#templates), for a
// type with no template of its own, and for a primitive's section on its rules page. It formats stored values only, by
// presence alone (docs/content-model.md#situational-fields): an omitted key has no line, and a present one
// always does, even at 0 or false.

import { isRef } from '../../../scripts/validate/refs.ts';
import { escapeMarkdown } from './markdown.ts';
import { refOrTextName } from './refs.ts';
import type { PropertyLine } from './template.ts';

/** `castingTime` → "Casting time". */
const humanize = (key: string): string => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};


/**
 * One value as markdown: text is escaped, and a ref is a `{ref:…}` token, so it
 * renders as its target's name linked to its page or rules anchor, with its
 * note in parentheses. A list joins its items.
 */
function text(value: unknown, names: Map<string, string>): string {
  if (isRef(value)) {
    if (!names.has(value.ref)) return escapeMarkdown(refOrTextName(value, names));
    return value.note === undefined ? `{ref:${value.ref}}` : `{ref:${value.ref}} (${escapeMarkdown(value.note)})`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item) => text(item, names)).join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([key, inner]) => `${humanize(key)}: ${text(inner, names)}`).join('; ');
  }
  return escapeMarkdown(String(value));
}

/**
 * Lines for `stats`: nested objects flatten into "Parent child" labels, in
 * stored order. Each value is markdown, so refs render as links. `skip` leaves
 * out top-level keys a page already shows, such as a primitive's group.
 */
export function genericLines(stats: unknown, names: Map<string, string>, prefix = '', skip: string[] = []): PropertyLine[] {
  if (typeof stats !== 'object' || stats === null) return [];
  return Object.entries(stats).flatMap(([key, value]) => {
    if (!prefix && skip.includes(key)) return [];
    const label = prefix ? `${prefix} ${humanize(key).toLowerCase()}` : humanize(key);
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !isRef(value)) {
      return genericLines(value, names, label);
    }
    return [{ label, value: text(value, names), markdown: true }];
  });
}
