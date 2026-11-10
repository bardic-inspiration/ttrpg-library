// Text for the dnd-5e-2024 magic item card in SRD 5.2 form (docs/rulesets.md#items,
// docs/site.md#templates). Items have no derived values: charge costs, save DCs, and attack
// bonuses are authored, and are only formatted here. Optional fields display
// by presence alone (docs/content-model.md#situational-fields).

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { present, whenPresent } from './display.ts';
import { refOrTextName } from './refs.ts';
import { concat, countOf, joinWith, link, list, name, pluralOf, say, sayText, text, toMarkdown, toPlain, withNote, type Phrase } from './wording.ts';
import type { BaseItem, ItemSpell, ItemStats } from '../../../rulesets/dnd-5e-2024/types.ts';

/** The rarity as SRD 5.2 prints it: "Very Rare", "Rarity Varies", or each variant's rarity: "Uncommon (+1), Rare (+2), or Very Rare (+3)". */
function rarityText(s: ItemStats): Phrase {
  if (present(s.rarityVariants)) return list(s.rarityVariants.map(({ rarity, variant }) => withNote(name('rarity', rarity), variant)), 'or');
  return s.rarity === 'varies' ? say('item.rarityVaries') : text(name('rarity', s.rarity));
}

/** What wording a base item needs to know about each equipment key. */
export type BaseLookup = (key: string) => { name: string; qualifier?: string; noun?: string; group: boolean } | undefined;

/**
 * A base item's words (docs/rulesets.md#items), each target a link. `oneOf` reads its names joined
 * by "or"; `any` reads "Any", then each target's qualifier (a group's) or name, joined by "or", with
 * the category's noun after a lone qualified group ("Any Melee Weapon"); `except` adds ", Except"
 * and its names, joined by "and". A link to a group reads its qualifier as display text.
 */
export function baseItemPhrase(base: BaseItem, lookup: BaseLookup): Phrase {
  const named = (ref: string): Phrase => link(ref, lookup(ref)?.name ?? ref.slice(ref.indexOf('/') + 1));
  if (base.oneOf) return list(base.oneOf.map((r) => named(r.ref)), 'or');
  const targets = base.any.map((r) => {
    const found = lookup(r.ref);
    return { phrase: link(r.ref, found?.qualifier ?? found?.name ?? r.ref.slice(r.ref.indexOf('/') + 1)), found };
  });
  const lone = targets.length === 1 && targets[0]!.found?.group && targets[0]!.found.qualifier ? targets[0]!.found.noun : undefined;
  const any = say('item.any', { targets: concat(list(targets.map((t) => t.phrase), 'or'), lone ? ` ${lone}` : '') });
  return base.except ? say('item.except', { base: any, items: list(base.except.map((r) => named(r.ref)), 'and') }) : any;
}

const noLookup: BaseLookup = () => undefined;

/** "Wand, Uncommon (Requires Attunement by a Spellcaster)", "Weapon (Longsword), Rare", with the base item's targets as links. */
export function subtitlePhrase(s: ItemStats, lookup: BaseLookup = noLookup): Phrase {
  const attunement = s.attunement.required
    ? concat(' (', whenPresent(s.attunement.requirement, (requirement) => say('item.attunementBy', { requirement })) ?? say('item.attunement'), ')')
    : [];
  const base = s.baseItem ? concat(' (', baseItemPhrase(s.baseItem, lookup), ')') : [];
  return concat(name('itemCategory', s.category), base, ', ', rarityText(s), attunement);
}

/** The subtitle as markdown, its base item's targets as links. */
export const subtitleMarkdown = (s: ItemStats, lookup: BaseLookup = noLookup): string => toMarkdown(subtitlePhrase(s, lookup));

/** The subtitle as plain text. */
export const subtitleLine = (s: ItemStats, lookup: BaseLookup = noLookup): string => toPlain(subtitlePhrase(s, lookup));

/**
 * "7; regains 1d6 + 1 daily at dawn", or just "12" for charges that never
 * come back; `undefined` when the item has no charges.
 */
export const chargesLine = (s: ItemStats): string | undefined =>
  whenPresent(s.charges, (c) => whenPresent(c.recharge, (recharge) => sayText('item.charges', { max: String(c.max), recharge })) ?? String(c.max));


/** "1 charge", "3 charges", or a variable cost's range, "1–3 charges". */
const chargeCost = (least: number, most: number | undefined): string => (most === undefined ? countOf(least, 'charge') : `${least}–${most} ${pluralOf('charge')}`);

/** One spell the item casts: its name, then "1 charge; save DC 13; +5 to hit" for what's present. */
export function spellLine(spell: ItemSpell, names: Map<string, string>): { name: string; notes?: string } {
  const notes = [
    whenPresent(spell.chargeCost, (n) => chargeCost(n, spell.maxChargeCost)),
    whenPresent(spell.saveDc, (dc) => sayText('item.saveDc', { dc: String(dc) })),
    whenPresent(spell.attackBonus, (bonus) => sayText('item.toHit', { bonus: signed(bonus) })),
  ].filter(present);
  return { name: refOrTextName(spell.spell, names), ...(notes.length ? { notes: toPlain(joinWith(notes, '; ')) } : {}) };
}
