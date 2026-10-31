// Detail-page labels for references (SPEC.md §5.7, §6.2).

import type { RefLabels } from '../module.ts';

const CASTS: RefLabels = { forward: 'Casts', back: 'Cast by' };
const GEAR: RefLabels = { forward: 'Gear', back: 'Carried by' };
const OTHER: RefLabels = { forward: 'References', back: 'Referenced by' };

/** Spell lists are "Casts", creature gear is "Gear"; any other `RefOrText` field gets a generic label. */
export function refLabels(type: string, path: string): RefLabels {
  if (type === 'creature' && path.startsWith('stats.spellcasting.')) return CASTS;
  if (type === 'creature' && path.startsWith('stats.gear[')) return GEAR;
  if (type === 'magic-item' && /^stats\.spells\[\d+\]\.spell$/.test(path)) return CASTS;
  return OTHER;
}
