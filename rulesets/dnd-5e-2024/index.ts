// The dnd-5e-2024 ruleset module (docs/rulesets.md#the-ruleset-module).

import type { RulesetModule } from '../module.ts';
import type { PhraseBook } from '../../lib/wording/book.ts';
import { checkBackground, checkBackgroundLinks, checkCharacter, checkCharacterLinks, checkCreature, checkCreatureLinks, checkFeat, checkItem, checkSpecies, checkSpell } from './checks.ts';
import { checkClass, checkClassFeature, checkClassLinks, checkSubclassLinks, deriveClass, deriveClassLinked } from './classes.ts';
import { deriveCharacter, deriveCharacterLinked } from './characters.ts';
import { checkMap, checkMapLinks } from './maps.ts';
import { checkEncounter, deriveEncounterLinked } from './encounters.ts';
import { checkModule, checkModuleLinks, deriveModuleLinked } from './modules.ts';
import { deriveCreature, deriveStatBlocks } from './derive.ts';
import { checkBaseItem, checkEquipment, deriveEquipment } from './equipment.ts';
import { refLabels } from './refs.ts';
import { renderTokens } from './tokens.ts';
import definition from './ruleset.json' with { type: 'json' };
import phrasesJson from './phrases.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { BackgroundStats, CharacterStats, ClassFeatureStats, ClassStats, CreatureStats, DerivedCreature, EncounterStats, EquipmentStats, FeatStats, ItemStats, MapStats, ModuleStats, SpeciesStats, SpellStats, SubclassStats, Tables } from './types.ts';

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
    if (type === 'character') return { ...deriveCharacter(stats as CharacterStats, tables) };
    if (type === 'spell') return deriveStatBlocks((stats as SpellStats).statBlocks, tables);
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
    if (type === 'class') return checkClass(stats as ClassStats, context?.official ?? false);
    if (type === 'class-feature') return checkClassFeature(stats as ClassFeatureStats);
    if (type === 'character') return checkCharacter(stats as CharacterStats, tables);
    if (type === 'map') return checkMap(stats as MapStats);
    if (type === 'encounter') return checkEncounter(stats as EncounterStats);
    if (type === 'module') return checkModule(stats as ModuleStats);
    return [];
  },
  checkLinks(type, stats, target, named, key) {
    if (type === 'creature') return checkCreatureLinks(stats as CreatureStats, named);
    if (type === 'background') return checkBackgroundLinks(stats as BackgroundStats, target);
    if (type === 'class') return checkClassLinks(stats as ClassStats, target);
    if (type === 'subclass') return checkSubclassLinks(stats as SubclassStats, target);
    if (type === 'character') return checkCharacterLinks(stats as CharacterStats, target, tables);
    if (type === 'map') return checkMapLinks(key, stats as MapStats, target);
    if (type === 'module') return checkModuleLinks(key, stats as ModuleStats, target);
    return [];
  },
  deriveLinked(type, key, stats, library) {
    if (type === 'class') return { ...deriveClassLinked(key.slice('class/'.length), stats as ClassStats, library) };
    if (type === 'character') return { ...deriveCharacterLinked(stats as CharacterStats, library, tables) };
    if (type === 'encounter') return { ...deriveEncounterLinked(stats as EncounterStats, library, tables) };
    if (type === 'module') return { ...deriveModuleLinked(stats as ModuleStats, library) };
    return {};
  },
  renderTokens(type, text, derived) {
    return type === 'creature' ? renderTokens(text, derived as unknown as DerivedCreature, tables) : text;
  },
  refLabels,
  phrases,
};
