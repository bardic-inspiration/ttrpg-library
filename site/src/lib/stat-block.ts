// Display lines for a stat block embedded in a spell or magic item (SPEC.md
// §6.6, §6.7, §9.5). Its lines are authored as printed, so they display as
// written; only the ability modifiers and saves come from the ruleset module.

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import type { DerivedStatBlock, StatBlock } from '../../../rulesets/dnd-5e-2024/types.ts';
import type { ActionBlock } from './creature.ts';
import { present } from './display.ts';
import type { PropertyLine } from './template.ts';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** The labeled lines of `keys` that the block has, in order (§5.8). */
const lines = (block: StatBlock, keys: [keyof StatBlock, string][]): PropertyLine[] =>
  keys.flatMap(([key, label]) => {
    const value = block[key];
    return present(value) && typeof value === 'string' ? [{ label, value }] : [];
  });

/** AC, Initiative, HP, and Speed: the lines above the ability table. */
export const coreLines = (block: StatBlock): PropertyLine[] =>
  lines(block, [
    ['ac', 'AC'],
    ['initiative', 'Initiative'],
    ['hp', 'HP'],
    ['speed', 'Speed'],
  ]);

/** The lines below the ability table. */
export const detailLines = (block: StatBlock): PropertyLine[] =>
  lines(block, [
    ['skills', 'Skills'],
    ['vulnerabilities', 'Vulnerabilities'],
    ['resistances', 'Resistances'],
    ['immunities', 'Immunities'],
    ['gear', 'Gear'],
    ['senses', 'Senses'],
    ['languages', 'Languages'],
    ['cr', 'CR'],
  ]);

/** The ability table's rows, formatted from the derived modifiers and saves. */
export const abilityRows = (block: StatBlock, derived: DerivedStatBlock) =>
  ABILITIES.map((ability) => ({
    ability: ability.toUpperCase(),
    score: block.abilities[ability],
    mod: signed(derived.abilityMods[ability]),
    save: signed(derived.saves[ability]),
  }));

/** Traits, Actions, Bonus Actions, and Reactions that the block has, each as named blocks of text. */
export const itemSections = (block: StatBlock): { title: string; items: ActionBlock[] }[] =>
  (
    [
      ['Traits', block.traits],
      ['Actions', block.actions],
      ['Bonus Actions', block.bonusActions],
      ['Reactions', block.reactions],
    ] as const
  ).flatMap(([title, list]) => (present(list) ? [{ title, items: list.map(({ name, text }) => ({ name, body: text })) }] : []));
