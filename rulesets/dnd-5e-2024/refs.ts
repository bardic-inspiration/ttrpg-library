// Detail-page labels for references (docs/content-model.md#references, docs/rulesets.md#the-ruleset-module).

import type { RefLabels } from '../module.ts';

const CASTS: RefLabels = { forward: 'Casts', back: 'Cast by' };
const GEAR: RefLabels = { forward: 'Gear', back: 'Carried by' };
const IMMUNE: RefLabels = { forward: 'Immune to', back: 'Immune creatures' };
const BASE: RefLabels = { forward: 'Base item', back: 'Base of' };
const PROPERTIES: RefLabels = { forward: 'Properties', back: 'Weapons' };
const MASTERY: RefLabels = { forward: 'Mastery', back: 'Weapons' };
const GRANTS: RefLabels = { forward: 'Grants', back: 'Granted by' };
const TOOL: RefLabels = { forward: 'Tool proficiency', back: 'Backgrounds' };
const STARTING: RefLabels = { forward: 'Starting equipment', back: 'Starting equipment of' };
const OTHER: RefLabels = { forward: 'References', back: 'Referenced by' };

/**
 * Spell lists are "Casts", creature gear is "Gear", condition immunities "Immune to", an item's base
 * "Base item", a weapon's properties and mastery "Properties" and "Mastery", a background's feat "Grants", its tool
 * "Tool proficiency", and its equipment "Starting equipment"; any other field gets a generic label.
 */
export function refLabels(type: string, path: string): RefLabels {
  if (type === 'creature' && path.startsWith('stats.spellcasting.')) return CASTS;
  if (type === 'creature' && path.startsWith('stats.gear[')) return GEAR;
  if (type === 'creature' && path.startsWith('stats.immunities.conditions[')) return IMMUNE;
  if (type === 'item' && /^stats\.spells\[\d+\]\.spell$/.test(path)) return CASTS;
  if (type === 'item' && path.startsWith('stats.baseItem.')) return BASE;
  if (type === 'equipment' && path.startsWith('stats.weapon.properties[')) return PROPERTIES;
  if (type === 'equipment' && path === 'stats.weapon.mastery') return MASTERY;
  if (type === 'background' && path === 'stats.feat') return GRANTS;
  if (type === 'background' && path === 'stats.tool') return TOOL;
  if (type === 'background' && /^stats\.equipment\[\d+\]\.items\[\d+\]$/.test(path)) return STARTING;
  return OTHER;
}
