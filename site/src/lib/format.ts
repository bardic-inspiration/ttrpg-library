// Display formatters shared by templates and the gallery (docs/site.md#type-registry `format`).
// They only change how a stored value reads; they never compute a rules value.

import tables from '../../../rulesets/dnd-5e-2024/tables.json' with { type: 'json' };

const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

/** A challenge rating: 0.125 reads "1/8". */
export const formatCr = (cr: number): string => FRACTIONS[cr] ?? String(cr);

/** A spell level as SRD 5.2 words it: 0 reads "Cantrip", 3 reads "Level 3". */
export const formatSpellLevel = (level: number): string => (level === 0 ? 'Cantrip' : `Level ${level}`);

/** An item rarity in title case, as SRD 5.2 prints it: `very-rare` reads "Very Rare". */
export const formatRarity = (rarity: string): string => formatTitle(rarity);

const ABILITIES: Record<string, string> = tables.abilityNames;

/** An ability key by its full name, from the ruleset's tables: `int` reads "Intelligence". */
export const formatAbility = (key: string): string => ABILITIES[key] ?? key;

/** An enum slug: `wondrous-item` reads "Wondrous Item". */
export const formatTitle = (slug: string): string =>
  slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Formats one value by a registry `format` name, or as stored when there is none. */
export function formatValue(value: unknown, format?: string): string {
  if (format === 'cr' && typeof value === 'number') return formatCr(value);
  if (format === 'spell-level' && typeof value === 'number') return formatSpellLevel(value);
  if (format === 'rarity' && typeof value === 'string') return formatRarity(value);
  if (format === 'title' && typeof value === 'string') return formatTitle(value);
  if (format === 'ability' && typeof value === 'string') return formatAbility(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
