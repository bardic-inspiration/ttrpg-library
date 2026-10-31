// The dnd-5e-2024 ruleset module (SPEC.md §6.2).

import type { RulesetModule } from '../module.ts';
import { checkCreature } from './checks.ts';
import { deriveCreature } from './derive.ts';
import definition from './ruleset.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { CreatureStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;

export const ruleset: RulesetModule = {
  definition,
  derive(type, stats) {
    if (type === 'creature') return { ...deriveCreature(stats as CreatureStats, tables) };
    return {};
  },
  check(type, stats) {
    if (type === 'creature') return checkCreature(stats as CreatureStats, tables);
    return [];
  },
};
