// Text for a dnd-5e-2024 species (docs/rulesets.md#species): its Creature Type, Size, and Speed
// lines, and the sentence that opens its traits, as SRD 5.2 prints them.

import type { SpeciesStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { formatTitle } from './format.ts';
import type { PropertyLine } from './template.ts';

/** "Medium (about 5–7 feet tall)", or two sizes joined by "or" and ", chosen when you select this species". */
export function speciesSize(s: SpeciesStats): string {
  const sizes = s.sizes.map(({ size, height }) => `${formatTitle(size)} (${height})`).join(' or ');
  return s.sizes.length > 1 ? `${sizes}, chosen when you select this species` : sizes;
}

export const speciesLines = (s: SpeciesStats): PropertyLine[] => [
  { label: 'Creature Type', value: formatTitle(s.creatureType) },
  { label: 'Size', value: speciesSize(s) },
  { label: 'Speed', value: `${s.speed} feet` },
];

/** "As a Dragonborn, you have these special traits.", "As an Elf, …", or the species' own `intro`. */
export const speciesIntro = (name: string, s: SpeciesStats): string =>
  s.intro ?? `As ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}, you have these special traits.`;
