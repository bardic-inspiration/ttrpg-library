// The dnd-5e-2024 ruleset module (docs/rulesets.md#the-ruleset-module).

import type { RulesetModule } from '../module.ts';
import type { PhraseBook } from '../../lib/wording/book.ts';
import { checkBackground, checkBackgroundLinks, checkCreature, checkFeat, checkItem, checkSpecies, checkSpell } from './checks.ts';
import { deriveCreature, deriveStatBlocks } from './derive.ts';
import { checkBaseItem, checkEquipment, deriveEquipment } from './equipment.ts';
import { refLabels } from './refs.ts';
import definition from './ruleset.json' with { type: 'json' };
import phrasesJson from './phrases.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { BackgroundStats, CreatureStats, EquipmentStats, FeatStats, ItemStats, SpeciesStats, SpellStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;
export const phrases = phrasesJson as unknown as PhraseBook;

export const ruleset: RulesetModule = {
  definition,
  derive(type, stats, rules) {
    if (type === 'creature') return { ...deriveCreature(stats as CreatureStats, tables) };
    if (type === 'equipment') return { ...deriveEquipment(stats as EquipmentStats, rules) };
    if (type === 'feat') return { repeatable: (stats as FeatStats).repeatable !== undefined };
    if (type === 'species') return { sizes: (stats as SpeciesStats).sizes.map((s) => s.size) };
    if (type === 'spell' || type === 'item') {
      return deriveStatBlocks((stats as SpellStats | ItemStats).statBlocks, tables);
    }
    return {};
  },
  check(type, stats, rules) {
    if (type === 'creature') return checkCreature(stats as CreatureStats, tables);
    if (type === 'item') {
      const item = stats as ItemStats;
      return [...checkItem(item), ...(item.baseItem ? checkBaseItem(item.baseItem, rules) : [])];
    }
    if (type === 'equipment') return checkEquipment(stats as EquipmentStats, rules);
    if (type === 'spell') return checkSpell(stats as SpellStats);
    if (type === 'feat') return checkFeat(stats as FeatStats);
    if (type === 'background') return checkBackground(stats as BackgroundStats);
    if (type === 'species') return checkSpecies(stats as SpeciesStats);
    return [];
  },
  checkLinks(type, stats, target) {
    if (type === 'background') return checkBackgroundLinks(stats as BackgroundStats, target);
    return [];
  },
  refLabels,
  phrases,
};
