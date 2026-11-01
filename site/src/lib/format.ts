// Display formatters shared by templates and the gallery (SPEC.md §7 `format`).
// They only change how a stored value reads; they never compute a rules value.

const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

/** A challenge rating: 0.125 reads "1/8". */
export const formatCr = (cr: number): string => FRACTIONS[cr] ?? String(cr);

const ORDINAL: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const plural = new Intl.PluralRules('en', { type: 'ordinal' });

/** A spell level: 0 reads "Cantrip", 3 reads "3rd level". */
export const formatSpellLevel = (level: number): string =>
  level === 0 ? 'Cantrip' : `${level}${ORDINAL[plural.select(level)] ?? 'th'} level`;

/** An item rarity: `very-rare` reads "Very rare". */
export const formatRarity = (rarity: string): string => {
  const words = rarity.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Formats one value by a registry `format` name, or as stored when there is none. */
export function formatValue(value: unknown, format?: string): string {
  if (format === 'cr' && typeof value === 'number') return formatCr(value);
  if (format === 'spell-level' && typeof value === 'number') return formatSpellLevel(value);
  if (format === 'rarity' && typeof value === 'string') return formatRarity(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
