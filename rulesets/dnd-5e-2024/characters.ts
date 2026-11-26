// Characters for dnd-5e-2024 (docs/rulesets.md#characters): what a build derives from its own stats,
// and what it derives from the entries its refs name, which the build resolves before deriving.

import type { LinkedEntry, LinkedLibrary } from '../module.ts';
import { levelOf } from './classes.ts';
import { abilityMod, attackBonus, saveDc, withModifier } from './derive.ts';
import { categoryOf } from './equipment.ts';
import type {
  Ability,
  BackgroundStats,
  CharacterAttack,
  CharacterProficiencies,
  CharacterSpellcasting,
  CharacterStats,
  ClassFeatureStats,
  ClassStats,
  DerivedCharacter,
  EquipmentStats,
  ItemStats,
  LinkedCharacter,
  Proficiency,
  SpeciesStats,
  SubclassStats,
  Tables,
} from './types.ts';

const totalLevel = (stats: CharacterStats): number => stats.classes.reduce((sum, c) => sum + c.level, 0);

/** The proficiency bonus at a total level, from the Character Advancement table. */
const proficiencyAt = (level: number, tables: Tables): number => tables.proficiencyBonusByLevel[Math.min(Math.max(level, 1), 20) - 1]!;

/** The total level, its proficiency bonus, and the point-buy cost of the base scores. */
export function deriveCharacter(stats: CharacterStats, tables: Tables): DerivedCharacter {
  const level = totalLevel(stats);
  const costs = tables.abilities.map((a) => tables.pointBuy.costs[String(stats.abilities.base[a])]);
  const pointCost = costs.every((c) => c !== undefined) ? costs.reduce((sum, c) => sum + c, 0) : undefined;
  return { level, proficiencyBonus: proficiencyAt(level, tables), ...(pointCost !== undefined && { pointCost }) };
}

/** The entry a ref names, which validation has resolved; a missing one is a bug in the caller. */
function need<T>(library: LinkedLibrary, key: string): LinkedEntry & { stats: T } {
  const found = library.resolve(key);
  if (!found) throw new Error(`character: ${key} doesn't resolve`);
  return found as LinkedEntry & { stats: T };
}

/** The fixed Hit Points per level after the first: half the die, plus 1 (SRD 5.2 "Character Creation"). */
const fixedHp = (die: number): number => die / 2 + 1;
const dieSize = (die: ClassStats['hitDie']): number => Number(die.slice(1));

/** Equipment an equipped entry is: itself, or an item's one base item or its named `base`. */
function equipmentOf(library: LinkedLibrary, equipped: { ref: string; base?: { ref: string } }): { key: string; stats: EquipmentStats } | undefined {
  if (equipped.ref.startsWith('equipment/')) return { key: equipped.ref, stats: need<EquipmentStats>(library, equipped.ref).stats };
  const item = need<ItemStats>(library, equipped.ref).stats;
  const key = equipped.base?.ref ?? (item.baseItem?.oneOf?.length === 1 ? item.baseItem.oneOf[0]!.ref : undefined);
  return key === undefined ? undefined : { key, stats: need<EquipmentStats>(library, key).stats };
}

const hasProperty = (stats: EquipmentStats, property: string): boolean =>
  (stats.weapon?.properties ?? []).some((p) => p.ref === `weapon-property/${property}`);

/**
 * What a character derives from the entries it names (docs/rulesets.md#characters): its final
 * scores, saves, skills, Passive Perception, Hit Points, Initiative, Speed, Armor Class, attacks,
 * spellcasting and slots, and its features and proficiencies by source.
 */
export function deriveCharacterLinked(stats: CharacterStats, library: LinkedLibrary, tables: Tables): LinkedCharacter {
  const level = totalLevel(stats);
  const pb = proficiencyAt(level, tables);
  const species = need<SpeciesStats>(library, stats.species.ref);
  const background = need<BackgroundStats>(library, stats.background.ref);
  const classes = stats.classes.map((c) => ({
    ...c,
    stats: need<ClassStats>(library, c.class.ref).stats,
    subclassStats: c.subclass ? need<SubclassStats>(library, c.subclass.ref).stats : undefined,
  }));
  const starting = classes[0]!;

  // Scores: the base, the background's increases, and the increases each feat places.
  const scores = { ...stats.abilities.base };
  for (const increases of [stats.abilities.background, ...(stats.feats ?? []).map((f) => f.abilities ?? {})]) {
    for (const [ability, by] of Object.entries(increases) as [Ability, number][]) scores[ability] += by;
  }
  const mods = Object.fromEntries(tables.abilities.map((a) => [a, abilityMod(scores[a])])) as Record<Ability, number>;

  const savingThrows = new Set(starting.stats.savingThrows);
  const saves = Object.fromEntries(tables.abilities.map((a) => [a, mods[a] + (savingThrows.has(a) ? pb : 0)])) as Record<Ability, number>;

  // Skills: the background's two, then each pick, with Expertise doubling the bonus.
  const chosen = stats.choices ?? [];
  const skillSources = [
    ...background.stats.skills.map((skill) => ({ skill, source: stats.background.ref })),
    ...chosen.flatMap((c) => (c.skills ?? []).map((skill) => ({ skill, source: c.source.ref }))),
  ];
  const expertise = chosen.flatMap((c) => (c.expertise ?? []).map((skill) => ({ skill, source: c.source.ref })));
  const proficient = new Set(skillSources.map((s) => s.skill));
  const expert = new Set(expertise.map((s) => s.skill));
  const skills = Object.fromEntries(
    Object.entries(tables.skills).map(([skill, ability]) => {
      const proficiency: Proficiency | undefined = expert.has(skill) ? 'expertise' : proficient.has(skill) ? 'proficient' : undefined;
      const bonus = mods[ability] + (proficiency === 'expertise' ? 2 * pb : proficiency ? pb : 0);
      return [skill, proficiency ? { bonus, proficiency } : { bonus }];
    }),
  );

  // Hit Points: the starting class's die at its maximum for level 1, then the fixed value per level.
  const dice = classes.flatMap((c) => Array.from({ length: c.level }, () => dieSize(c.stats.hitDie)));
  const hp = dice.reduce((sum, die, i) => sum + (i === 0 ? die : fixedHp(die)), 0) + mods.con * level;

  // Armor Class: the equipped armor's formula with its Dexterity rule, or 10 + Dexterity, then a shield.
  const tree = library.rules?.groups.get('equipment');
  const gear = (stats.equipped ?? []).flatMap((e) => {
    const equipment = equipmentOf(library, e);
    return equipment ? [{ ref: e.ref, ...equipment, category: categoryOf(tree, equipment.stats.group) }] : [];
  });
  const armor = gear.find((g) => g.stats.armor && g.stats.group !== 'shields');
  const shield = gear.find((g) => g.stats.armor && g.stats.group === 'shields');
  const dexToAc = (a: NonNullable<EquipmentStats['armor']>) => (a.dex ? Math.min(mods.dex, a.dexMax ?? Infinity) : 0);
  const ac = {
    value: (armor ? armor.stats.armor!.ac + dexToAc(armor.stats.armor!) : 10 + mods.dex) + (shield?.stats.armor!.ac ?? 0),
    ...(armor && { armor: armor.ref }),
    ...(shield && { shield: shield.ref }),
  };

  // Attacks: Strength for a melee weapon, Dexterity for a ranged one, the higher for Finesse.
  const attacks = gear.flatMap((g): CharacterAttack[] => {
    const weapon = g.stats.weapon;
    if (!weapon) return [];
    const ranged = tree?.contains('ranged-weapons', { stats: g.stats }) ?? false;
    const ability: Ability = hasProperty(g.stats, 'finesse') ? (mods.dex > mods.str ? 'dex' : 'str') : ranged ? 'dex' : 'str';
    const modifier = mods[ability];
    const { dice, flat, type } = weapon.damage;
    return [
      {
        ref: g.ref,
        weapon: g.key,
        ability,
        attackBonus: attackBonus(pb, modifier),
        damage: {
          ...(dice !== undefined ? { dice } : { flat }),
          modifier,
          type,
          display: dice !== undefined ? withModifier(dice, modifier) : String(Math.max(1, flat! + modifier)),
        },
        ...(weapon.versatile && { versatile: { dice: weapon.versatile, display: withModifier(weapon.versatile, modifier) } }),
        ...(weapon.range && { range: weapon.range }),
        properties: weapon.properties ?? [],
        mastery: weapon.mastery,
      },
    ];
  });

  // Spellcasting: each casting class's DC and attack; slots from the Multiclass Spellcaster table at
  // the full caster levels plus half the half caster levels, rounded up, and Pact Magic apart.
  const casters = classes.filter((c) => c.stats.spellcasting);
  const spellcasting = casters.map((c): CharacterSpellcasting => {
    const casting = c.stats.spellcasting!;
    return {
      class: c.class.ref,
      ability: casting.ability,
      saveDc: saveDc(pb, mods[casting.ability]),
      attackBonus: attackBonus(pb, mods[casting.ability]),
      cantrips: casting.cantrips?.[c.level - 1] ?? 0,
      prepared: casting.prepared[c.level - 1]!,
    };
  });
  const casterLevel =
    casters.filter((c) => c.stats.spellcasting!.progression === 'full').reduce((sum, c) => sum + c.level, 0) +
    casters.filter((c) => c.stats.spellcasting!.progression === 'half').reduce((sum, c) => sum + Math.ceil(c.level / 2), 0);
  const pact = casters.find((c) => c.stats.spellcasting!.progression === 'pact');

  // Features: each class's and subclass's up to the class's level, then the species' traits.
  const upTo = (refs: { ref: string }[], at: number) =>
    refs.flatMap(({ ref }) => {
      const first = levelOf(need<ClassFeatureStats>(library, ref).stats.levels[0]!);
      return first <= at ? [{ ref, level: first }] : [];
    });
  const features = [
    ...classes.flatMap((c) => [
      { source: c.class.ref, features: upTo(c.stats.features, c.level) },
      ...(c.subclass && c.subclassStats ? [{ source: c.subclass.ref, features: upTo(c.subclassStats.features, c.level) }] : []),
    ]),
    { source: stats.species.ref, features: species.stats.traits.map(({ ref }) => ({ ref })) },
  ];

  const backgroundTool = background.stats.tool.choose ? [] : [{ source: stats.background.ref, ref: background.stats.tool.ref }];
  const proficiencies: CharacterProficiencies = {
    saves: { source: starting.class.ref, abilities: starting.stats.savingThrows },
    skills: skillSources,
    expertise,
    training: classes.map((c, i) =>
      i === 0
        ? { source: c.class.ref, weapons: c.stats.weapons, armor: c.stats.armor, ...(c.stats.tools && { tools: c.stats.tools }) }
        : { source: c.class.ref, multiclass: c.stats.multiclass },
    ),
    tools: [
      ...backgroundTool,
      ...chosen.flatMap((c) => (c.tools ?? []).map((t) => ({ source: c.source.ref, ref: t.ref, ...(t.note && { note: t.note }) }))),
    ],
    languages: chosen.flatMap((c) => (c.languages ?? []).map((language) => ({ source: c.source.ref, language }))),
  };

  return {
    scores,
    abilityMods: mods,
    saves,
    skills,
    passivePerception: 10 + skills.perception!.bonus,
    hp,
    initiative: mods.dex,
    speed: species.stats.speed,
    ac,
    attacks,
    spellcasting,
    ...(casterLevel > 0 && { spellSlots: [...tables.multiclassSpellSlots[Math.min(casterLevel, 20) - 1]!] }),
    ...(pact && { pactSlots: { ...tables.pactMagic[pact.level - 1]! } }),
    features,
    proficiencies,
  };
}
