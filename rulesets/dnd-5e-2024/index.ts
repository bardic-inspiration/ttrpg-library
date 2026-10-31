// The dnd-5e-2024 ruleset module (SPEC.md §6.2).

import type { RulesetModule } from '../module.ts';
import { checkCreature, checkMagicItem, checkSpell } from './checks.ts';
import { deriveCreature } from './derive.ts';
import { refLabels } from './refs.ts';
import definition from './ruleset.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { CreatureStats, MagicItemStats, SpellStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;

export const ruleset: RulesetModule = {
  definition,
  derive(type, stats) {
    if (type === 'creature') return { ...deriveCreature(stats as CreatureStats, tables) };
    return {};
  },
  check(type, stats) {
    if (type === 'creature') return checkCreature(stats as CreatureStats, tables);
    if (type === 'magic-item') return checkMagicItem(stats as MagicItemStats);
    if (type === 'spell') return checkSpell(stats as SpellStats);
    return [];
  },
  refLabels,
};
