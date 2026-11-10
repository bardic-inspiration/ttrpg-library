// Text for a dnd-5e-2024 species (docs/rulesets.md#species): its Creature Type, Size, and Speed
// lines, and the sentence that opens its traits, from the phrase book.

import type { SpeciesStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { list, name, sayText, toPlain, withArticle, withNote } from './wording.ts';
import type { PropertyLine } from './template.ts';

/** "Medium (about 5–7 feet tall)", or two sizes joined by "or" and ", chosen when you select this species". */
export function speciesSize(s: SpeciesStats): string {
  const sizes = list(s.sizes.map(({ size, height }) => withNote(name('size', size), height)), 'or');
  return s.sizes.length > 1 ? sayText('species.sizeChoice', { sizes }) : toPlain(sizes);
}

export const speciesLines = (s: SpeciesStats): PropertyLine[] => [
  { label: 'Creature Type', value: name('creatureType', s.creatureType) },
  { label: 'Size', value: speciesSize(s) },
  { label: 'Speed', value: sayText('species.speed', { feet: String(s.speed) }) },
];

/** "As a Dragonborn, you have these special traits.", "As an Elf, …", or the species' own `intro`. */
export const speciesIntro = (species: string, s: SpeciesStats): string => s.intro ?? sayText('species.intro', { species: withArticle(species) });
