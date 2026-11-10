// The dnd-5e-2024 ruleset module (docs/rulesets.md#the-ruleset-module).

import type { RulesetModule } from '../module.ts';
import type { PhraseBook } from '../../lib/wording/book.ts';
import { checkBackground, checkBackgroundLinks, checkCreature, checkFeat, checkItem, checkSpecies, checkSpell } from './checks.ts';
import { checkClass, checkClassFeature, checkClassLinks, checkSubclassLinks, deriveClass, deriveClassLinked } from './classes.ts';
import { deriveCreature, deriveStatBlocks } from './derive.ts';
import { checkBaseItem, checkEquipment, deriveEquipment } from './equipment.ts';
import { refLabels } from './refs.ts';
import definition from './ruleset.json' with { type: 'json' };
import phrasesJson from './phrases.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { BackgroundStats, ClassFeatureStats, ClassStats, CreatureStats, EquipmentStats, FeatStats, ItemStats, SpeciesStats, SpellStats, SubclassStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;
export const phrases = phrasesJson as unknown as PhraseBook;

export const ruleset: RulesetModule = {
  definition,
  derive(type, stats, rules) {
    if (type === 'creature') return { ...deriveCreature(stats as CreatureStats, tables) };
    if (type === 'equipment') return { ...deriveEquipment(stats as EquipmentStats, rules) };
    if (type === 'feat') return { repeatable: (stats as FeatStats).repeatable !== undefined };
    if (type === 'species') return { sizes: (stats as SpeciesStats).sizes.map((s) => s.size) };
    if (type === 'class') return { ...deriveClass(stats as ClassStats, tables) };
    if (type === 'spell') {
      const spell = stats as SpellStats;
      // The class keys, for the Classes filter until the filter tree reads ref labels (#235).
      return { ...deriveStatBlocks(spell.statBlocks, tables), classes: spell.classes.map((c) => c.ref.slice('class/'.length)) };
    }
    if (type === 'item') return deriveStatBlocks((stats as ItemStats).statBlocks, tables);
    return {};
  },
  check(type, stats, rules, context) {
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
    if (type === 'class') return checkClass(stats as ClassStats, context?.srd ?? false);
    if (type === 'class-feature') return checkClassFeature(stats as ClassFeatureStats);
    return [];
  },
  checkLinks(type, stats, target) {
    if (type === 'background') return checkBackgroundLinks(stats as BackgroundStats, target);
    if (type === 'class') return checkClassLinks(stats as ClassStats, target);
    if (type === 'subclass') return checkSubclassLinks(stats as SubclassStats, target);
    return [];
  },
  deriveLinked(type, key, stats, entries) {
    if (type === 'class') return { ...deriveClassLinked(key.slice('class/'.length), stats as ClassStats, entries) };
    return {};
  },
  refLabels,
  phrases,
};
