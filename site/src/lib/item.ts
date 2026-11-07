// Text for the dnd-5e-2024 magic item card in SRD 5.2 form (docs/rulesets.md#items,
// docs/site.md#templates). Items have no derived values: charge costs, save DCs, and attack
// bonuses are authored, and are only formatted here. Optional fields display
// by presence alone (docs/content-model.md#situational-fields).

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { present, whenPresent } from './display.ts';
import { formatRarity } from './format.ts';
import { refOrTextName } from './refs.ts';
import type { ItemSpell, ItemStats } from '../../../rulesets/dnd-5e-2024/types.ts';

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string): string => s.split(/[\s-]+/).map(capitalize).join(' ');

/** "Uncommon (+1), Rare (+2), or Very Rare (+3)": each variant's rarity, as an English list joined by "or". */
function variantRarities(variants: NonNullable<ItemStats['rarityVariants']>): string {
  const items = variants.map(({ rarity, variant }) => `${formatRarity(rarity)} (${variant})`);
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
}

/** The rarity as SRD 5.2 prints it: "Very Rare", "Rarity Varies", or each variant's rarity. */
function rarityText(s: ItemStats): string {
  if (present(s.rarityVariants)) return variantRarities(s.rarityVariants);
  return s.rarity === 'varies' ? 'Rarity Varies' : formatRarity(s.rarity);
}

/** "Wand, Uncommon (Requires Attunement by a Spellcaster)", "Weapon (Longsword), Rare". */
export function subtitleLine(s: ItemStats): string {
  const category = titleCase(s.category) + (whenPresent(s.baseItem, (base) => ` (${base})`) ?? '');
  const rarity = rarityText(s);
  const attunement = s.attunement.required
    ? ` (Requires Attunement${whenPresent(s.attunement.requirement, (r) => ` ${r}`) ?? ''})`
    : '';
  return `${category}, ${rarity}${attunement}`;
}

/**
 * "7; regains 1d6 + 1 daily at dawn", or just "12" for charges that never
 * come back; `undefined` when the item has no charges.
 */
export const chargesLine = (s: ItemStats): string | undefined =>
  whenPresent(s.charges, (c) => `${c.max}${whenPresent(c.recharge, (r) => `; regains ${r}`) ?? ''}`);


/** "1 charge", "3 charges", or a variable cost's range, "1–3 charges". */
const chargeCost = (least: number, most: number | undefined): string =>
  most === undefined ? `${least} charge${least === 1 ? '' : 's'}` : `${least}–${most} charges`;

/** One spell the item casts: its name, then "1 charge; save DC 13; +5 to hit" for what's present. */
export function spellLine(spell: ItemSpell, names: Map<string, string>): { name: string; notes?: string } {
  const notes = [
    whenPresent(spell.chargeCost, (n) => chargeCost(n, spell.maxChargeCost)),
    whenPresent(spell.saveDc, (dc) => `save DC ${dc}`),
    whenPresent(spell.attackBonus, (bonus) => `${signed(bonus)} to hit`),
  ].filter(present);
  return { name: refOrTextName(spell.spell, names), ...(notes.length ? { notes: notes.join('; ') } : {}) };
}
