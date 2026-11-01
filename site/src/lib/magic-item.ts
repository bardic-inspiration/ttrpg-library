// Text for the dnd-5e-2024 magic item card in SRD 5.2 form (SPEC.md §6.6,
// §9.5). Items have no derived values: charge costs, save DCs, and attack
// bonuses are authored, and are only formatted here. Optional fields display
// by presence alone (SPEC.md §5.8).

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { present, whenPresent } from './display.ts';
import { formatRarity } from './format.ts';
import type { MagicItemSpell, MagicItemStats, RefOrText } from '../../../rulesets/dnd-5e-2024/types.ts';

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string): string => s.split(/[\s-]+/).map(capitalize).join(' ');

/** "Wand, Uncommon (Requires Attunement by a Spellcaster)", "Weapon (Longsword), Rare". */
export function subtitleLine(s: MagicItemStats): string {
  const category = titleCase(s.category) + (whenPresent(s.baseItem, (base) => ` (${base})`) ?? '');
  const rarity = s.rarity === 'varies' ? 'Rarity Varies' : formatRarity(s.rarity);
  const attunement = s.attunement.required
    ? ` (Requires Attunement${whenPresent(s.attunement.requirement, (r) => ` ${r}`) ?? ''})`
    : '';
  return `${category}, ${rarity}${attunement}`;
}

/** "7; regains 1d6 + 1 daily at dawn", or `undefined` when the item has no charges. */
export const chargesLine = (s: MagicItemStats): string | undefined =>
  whenPresent(s.charges, (c) => `${c.max}; regains ${c.recharge}`);

const refOrText = (value: RefOrText, names: Map<string, string>): string =>
  typeof value === 'string' ? value : (names.get(value.ref) ?? value.ref);

/** One spell the item casts: its name, then "1 charge; save DC 13; +5 to hit" for what's present. */
export function spellLine(spell: MagicItemSpell, names: Map<string, string>): { name: string; notes?: string } {
  const notes = [
    whenPresent(spell.chargeCost, (n) => `${n} charge${n === 1 ? '' : 's'}`),
    whenPresent(spell.saveDc, (dc) => `save DC ${dc}`),
    whenPresent(spell.attackBonus, (bonus) => `${signed(bonus)} to hit`),
  ].filter(present);
  return { name: refOrText(spell.spell, names), ...(notes.length ? { notes: notes.join('; ') } : {}) };
}
