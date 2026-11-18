// Display lines for a stat block embedded in a spell or magic item
// (docs/rulesets.md#embedded-stat-blocks, docs/site.md#templates). Its lines are authored as printed, so they display as
// written; only the ability modifiers and saves come from the ruleset module.

import type { StatBlock } from '../../../rulesets/dnd-5e-2024/types.ts';
import type { ActionBlock } from './creature.ts';
import { present } from './display.ts';
import type { PropertyLine } from './template.ts';

/** The ability table's rows, as a creature's are. */
export { abilityRows } from './creature.ts';

/** The labeled lines of `keys` that the block has, in order (docs/content-model.md#situational-fields). */
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
