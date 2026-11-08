// Detail-page labels for references (docs/content-model.md#references, docs/rulesets.md#the-ruleset-module).

import type { RefLabels } from '../module.ts';

const CASTS: RefLabels = { forward: 'Casts', back: 'Cast by' };
const GEAR: RefLabels = { forward: 'Gear', back: 'Carried by' };
const IMMUNE: RefLabels = { forward: 'Immune to', back: 'Immune creatures' };
const OTHER: RefLabels = { forward: 'References', back: 'Referenced by' };

/** Spell lists are "Casts", creature gear is "Gear", condition immunities "Immune to"; any other field gets a generic label. */
export function refLabels(type: string, path: string): RefLabels {
  if (type === 'creature' && path.startsWith('stats.spellcasting.')) return CASTS;
  if (type === 'creature' && path.startsWith('stats.gear[')) return GEAR;
  if (type === 'creature' && path.startsWith('stats.immunities.conditions[')) return IMMUNE;
  if (type === 'item' && /^stats\.spells\[\d+\]\.spell$/.test(path)) return CASTS;
  return OTHER;
}
