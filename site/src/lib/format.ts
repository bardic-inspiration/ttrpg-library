// Display formatters shared by templates and the gallery (docs/site.md#type-registry `format`).
// They only change how a stored value reads; they never compute a rules value, and never add the
// field's label, which the display adds where it needs one (docs/content-model.md#display). Enum values read
// their names from the phrase book's vocabulary (docs/site.md#wording).

import { titleCase } from '../../../lib/wording/grammar.ts';

const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

/** A challenge rating: 0.125 reads "1/8". */
export const formatCr = (cr: number): string => FRACTIONS[cr] ?? String(cr);

/** A spell level's value: 0 reads "Cantrip", 3 reads "3". The field's label supplies "Level". */
export const formatSpellLevel = (level: number): string => (level === 0 ? 'Cantrip' : String(level));

/** A slug with no vocabulary of its own, such as an equipment group's id, in title case: "hand-tools" reads "Hand Tools". */
export const formatTitle = (slug: string): string => titleCase(slug);

/** Formats one value by a registry `format` name, or as stored when there is none. */
export function formatValue(value: unknown, format?: string): string {
  if (format === 'cr' && typeof value === 'number') return formatCr(value);
  if (format === 'spell-level' && typeof value === 'number') return formatSpellLevel(value);
  if (format === 'title' && typeof value === 'string') return formatTitle(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
