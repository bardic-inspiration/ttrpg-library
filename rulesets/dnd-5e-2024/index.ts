// The dnd-5e-2024 ruleset module (docs/rulesets.md#the-ruleset-module).

import type { RulesetModule } from '../module.ts';
import { checkCreature, checkItem, checkSpell } from './checks.ts';
import { deriveCreature, deriveStatBlocks } from './derive.ts';
import { refLabels } from './refs.ts';
import definition from './ruleset.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { CreatureStats, ItemStats, SpellStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;

export const ruleset: RulesetModule = {
  definition,
  derive(type, stats) {
    if (type === 'creature') return { ...deriveCreature(stats as CreatureStats, tables) };
    if (type === 'spell' || type === 'item') {
      return deriveStatBlocks((stats as SpellStats | ItemStats).statBlocks, tables);
    }
    return {};
  },
  check(type, stats) {
    if (type === 'creature') return checkCreature(stats as CreatureStats, tables);
    if (type === 'item') return checkItem(stats as ItemStats);
    if (type === 'spell') return checkSpell(stats as SpellStats);
    return [];
  },
  refLabels,
};
