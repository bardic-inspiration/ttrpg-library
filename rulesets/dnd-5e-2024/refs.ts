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
const SPELLS: RefLabels = { forward: 'Spells', back: 'Classes' };
const CLASSES: RefLabels = { forward: 'Classes', back: 'Spells' };
const SUBCLASS: RefLabels = { forward: 'Subclass of', back: 'Subclasses' };
const OTHER: RefLabels = { forward: 'References', back: 'Referenced by' };

/**
 * Spell lists are "Casts", creature gear is "Gear", condition immunities "Immune to", an item's base
 * "Base item", a weapon's properties and mastery "Properties" and "Mastery", a background's feat "Grants", its tool
 * "Tool proficiency", and its equipment "Starting equipment", as a class's is; a class's own spells
 * are "Spells", as a spell's classes are "Classes", and a subclass's class "Subclass of"; any other field gets a generic label.
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
  if (type === 'class' && /^stats\.equipment\[\d+\]\.items\[\d+\]$/.test(path)) return STARTING;
  if (type === 'class' && path.startsWith('stats.spells[')) return SPELLS;
  if (type === 'subclass' && path === 'stats.class') return SUBCLASS;
  if (type === 'spell' && path.startsWith('stats.classes[')) return CLASSES;
  return OTHER;
}
