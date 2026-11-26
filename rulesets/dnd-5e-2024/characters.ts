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
  FeatStats,
  Grant,
  ItemModifier,
  ItemStats,
  LinkedCharacter,
  Modifier,
  ModifierWeapon,
  ModifierWhile,
  Proficiency,
  SpeciesStats,
  SpeciesTraitStats,
  SpellStats,
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
export function equipmentOf(library: LinkedLibrary, equipped: { ref: string; base?: { ref: string } }): { key: string; stats: EquipmentStats } | undefined {
  if (equipped.ref.startsWith('equipment/')) return { key: equipped.ref, stats: need<EquipmentStats>(library, equipped.ref).stats };
  const item = need<ItemStats>(library, equipped.ref).stats;
  const key = equipped.base?.ref ?? (item.baseItem?.oneOf?.length === 1 ? item.baseItem.oneOf[0]!.ref : undefined);
  return key === undefined ? undefined : { key, stats: need<EquipmentStats>(library, key).stats };
}

const hasProperty = (stats: EquipmentStats, property: string): boolean =>
  (stats.weapon?.properties ?? []).some((p) => p.ref === `weapon-property/${property}`);

/** The option a character's `choices` name under an entry, if any (docs/rulesets.md#grants). */
export const optionOf = (stats: CharacterStats, ref: string): string | undefined => (stats.choices ?? []).find((c) => c.source.ref === ref && c.option !== undefined)?.option;

/**
 * An entry's grants as a character takes them (docs/rulesets.md#grants): a choice's named option's
 * grants in its place, and a feat grant's `or` in place of the feat when the option names it.
 */
export function chosenGrants(grants: Grant[], option: string | undefined): Grant[] {
  return grants.flatMap((g) => {
    if (g.kind === 'choice') return g.options.find((o) => o.name === option)?.grants ?? [];
    if (g.kind === 'feat' && g.or) return g.or.name === option ? (g.or.grants ?? []) : [{ kind: 'feat', categories: g.categories }];
    return [g];
  });
}

/** The modifiers the option a character names of an entry's choice, or of its feat grant's `or`, adds. */
function chosenModifiers(grants: Grant[], option: string | undefined): Modifier[] {
  if (option === undefined) return [];
  return grants.flatMap((g) => {
    const taken = g.kind === 'choice' ? g.options.find((o) => o.name === option) : g.kind === 'feat' && g.or?.name === option ? g.or : undefined;
    return taken?.modifiers ?? [];
  });
}

/** One modifier, with the entry that declares it and the level of the class it belongs to, if any. */
interface Collected {
  modifier: Modifier;
  source: string;
  classLevel?: number;
}

/** One equipped item's modifier, with the index of its `equipped` entry and the variant it names. */
interface ItemEffect {
  modifier: ItemModifier;
  index: number;
  variant?: string;
}

/**
 * The modifiers of the equipped items (docs/rulesets.md#item-modifiers): each item's, when it's
 * attuned or doesn't require attunement.
 */
function itemEffects(library: LinkedLibrary, stats: CharacterStats): ItemEffect[] {
  return (stats.equipped ?? []).flatMap((e, index) => {
    if (!e.ref.startsWith('item/')) return [];
    const item = need<ItemStats>(library, e.ref).stats;
    if (item.attunement.required && !e.attuned) return [];
    return (item.modifiers ?? []).map((modifier) => ({ modifier, index, ...(e.variant !== undefined && { variant: e.variant }) }));
  });
}

/** An item modifier's value: its number, or the one for the variant equipped (none for another). */
const itemValue = ({ modifier, variant }: ItemEffect): number =>
  modifier.byVariant ? (variant === undefined ? 0 : (modifier.byVariant[variant] ?? 0)) : (modifier.value ?? 0);

/** The value a `byLevel` table gives at a level: the one from the highest key at or below it. */
export function atLevel<T>(table: Record<string, T>, level: number): T | undefined {
  const key = Object.keys(table)
    .map(Number)
    .filter((k) => k <= level)
    .sort((a, b) => b - a)[0];
  return key === undefined ? undefined : table[String(key)];
}

/** The larger of two dice by average roll, the first on a tie. */
const largerDie = (a: string, b: string): string => {
  const total = (dice: string) => {
    const [count, sides] = dice.split('d').map(Number);
    return count! * (sides! + 1);
  };
  return total(b) > total(a) ? b : a;
};

/**
 * What a character derives from the entries it names (docs/rulesets.md#characters): its final
 * scores, saves, skills, Passive Perception, Hit Points, Initiative, Speed, Armor Class, attacks,
 * spellcasting and slots, and its features and proficiencies by source, each with the modifiers of
 * the features, feats, and traits it has (docs/rulesets.md#modifiers) and of its equipped items
 * (docs/rulesets.md#item-modifiers).
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
  const levelOfClass = new Map(classes.map((c) => [c.class.ref, c.level]));

  // Features: each class's and subclass's up to the class's level, then the species' traits.
  const upTo = (refs: { ref: string }[], at: number) =>
    refs.flatMap(({ ref }) => {
      const first = levelOf(need<ClassFeatureStats>(library, ref).stats.levels[0]!);
      return first <= at ? [{ ref, level: first }] : [];
    });
  const features = [
    ...classes.flatMap((c) => [
      { source: c.class.ref, classLevel: c.level, features: upTo(c.stats.features, c.level) },
      ...(c.subclass && c.subclassStats ? [{ source: c.subclass.ref, classLevel: c.level, features: upTo(c.subclassStats.features, c.level) }] : []),
    ]),
    { source: stats.species.ref, classLevel: undefined, features: species.stats.traits.map(({ ref }) => ({ ref })) },
  ];

  // Modifiers: from the features above, the species' traits, and the feats.
  const feats = (stats.feats ?? []).map((f) => ({ ...f, stats: need<FeatStats>(library, f.ref).stats }));
  const collected: Collected[] = [
    ...features.flatMap((group) =>
      group.features.flatMap(({ ref }) => {
        const entry = need<ClassFeatureStats | SpeciesTraitStats>(library, ref).stats;
        return [...(entry.modifiers ?? []), ...chosenModifiers(entry.grants ?? [], optionOf(stats, ref))].map((modifier) => ({ modifier, source: ref, classLevel: group.classLevel }));
      }),
    ),
    ...feats.flatMap((f) =>
      [...(f.stats.modifiers ?? []), ...chosenModifiers(f.stats.grants ?? [], optionOf(stats, f.ref))].map((modifier) => ({
        modifier,
        source: f.ref,
        classLevel: f.source.level === undefined ? undefined : levelOfClass.get(f.source.ref),
      })),
    ),
  ];
  const ofKind = <K extends Modifier['kind']>(kind: K) => collected.filter((c): c is Collected & { modifier: Extract<Modifier, { kind: K }> } => c.modifier.kind === kind);
  const items = itemEffects(library, stats);
  const ofItemKind = <K extends ItemModifier['kind']>(kind: K) =>
    items.filter((c): c is ItemEffect & { modifier: Extract<ItemModifier, { kind: K }> } => c.modifier.kind === kind);

  // Scores: the base, the background's increases, each feat's placed increases up to its maximum,
  // then fixed increases (Primal Champion) up to theirs.
  const scores = { ...stats.abilities.base };
  const raise = (ability: Ability, by: number, max = Infinity) => {
    scores[ability] = Math.max(scores[ability], Math.min(max, scores[ability] + by));
  };
  for (const [ability, by] of Object.entries(stats.abilities.background) as [Ability, number][]) raise(ability, by);
  for (const f of feats) {
    const max = f.stats.modifiers?.find((m): m is Extract<Modifier, { kind: 'ability-bonus' }> => m.kind === 'ability-bonus' && m.total !== undefined)?.max;
    for (const [ability, by] of Object.entries(f.abilities ?? {}) as [Ability, number][]) raise(ability, by, max);
  }
  for (const { modifier } of ofKind('ability-bonus')) for (const ability of modifier.abilities ?? []) raise(ability, modifier.value ?? 0, modifier.max);
  // Then each item that sets a score, unless the score is already higher.
  for (const effect of ofItemKind('ability-set')) scores[effect.modifier.ability] = Math.max(scores[effect.modifier.ability], itemValue(effect));
  const mods = Object.fromEntries(tables.abilities.map((a) => [a, abilityMod(scores[a])])) as Record<Ability, number>;

  // What's equipped, for Armor Class, attacks, and each modifier's `while`.
  const tree = library.rules?.groups.get('equipment');
  const gear = (stats.equipped ?? []).flatMap((e, index) => {
    const equipment = equipmentOf(library, e);
    return equipment ? [{ ref: e.ref, index, ...equipment, category: categoryOf(tree, equipment.stats.group) }] : [];
  });
  const armor = gear.find((g) => g.stats.armor && g.stats.group !== 'shields');
  const shield = gear.find((g) => g.stats.armor && g.stats.group === 'shields');
  const weapons = gear.filter((g) => g.stats.weapon);
  const condition: Record<ModifierWhile, boolean> = {
    unarmored: !armor,
    armored: armor !== undefined,
    'no-heavy-armor': armor?.stats.group !== 'heavy-armor',
    'no-shield': !shield,
  };
  const holds = (m: { while?: ModifierWhile[] }) => (m.while ?? []).every((w) => condition[w]);
  const valueOf = (c: Collected & { modifier: { value?: number | string; byLevel?: Record<string, number>; min?: number } }): number => {
    const m = c.modifier;
    const raw = m.byLevel ? (atLevel(m.byLevel, c.classLevel ?? level) ?? 0) : m.value === 'proficiency' ? pb : typeof m.value === 'string' ? mods[m.value as Ability] : (m.value ?? 0);
    return Math.max(raw, m.min ?? -Infinity);
  };
  const sumItems = (list: (ItemEffect & { modifier: { while?: ModifierWhile[] } })[]) =>
    list.filter((c) => holds(c.modifier)).reduce((total, c) => total + itemValue(c), 0);
  const sum = (list: (Collected & { modifier: { while?: ModifierWhile[]; value?: number | string; byLevel?: Record<string, number>; min?: number } })[]) =>
    list.filter((c) => holds(c.modifier)).reduce((total, c) => total + valueOf(c), 0);

  const savingThrows = new Set<Ability>(starting.stats.savingThrows);
  for (const { modifier } of ofKind('save-proficiency')) for (const a of modifier.abilities === 'all' ? tables.abilities : modifier.abilities) savingThrows.add(a);
  const saveBonus = sum(ofKind('save-bonus')) + sumItems(ofItemKind('save-bonus'));
  const checkBonus = sumItems(ofItemKind('check-bonus'));
  const saves = Object.fromEntries(tables.abilities.map((a) => [a, mods[a] + (savingThrows.has(a) ? pb : 0) + saveBonus])) as Record<Ability, number>;

  // Skills: the background's two, each pick, and each skill a modifier names, with Expertise doubling
  // the bonus; a skill floor adds half the proficiency bonus to the rest.
  const chosen = stats.choices ?? [];
  const named = ofKind('skill-proficiency');
  const skillSources = [
    ...background.stats.skills.map((skill) => ({ skill, source: stats.background.ref })),
    ...chosen.flatMap((c) => (c.skills ?? []).map((skill) => ({ skill, source: c.source.ref }))),
    ...named.filter((c) => !c.modifier.expertise).flatMap((c) => c.modifier.skills.map((skill) => ({ skill, source: c.source }))),
  ];
  const expertise = [
    ...chosen.flatMap((c) => (c.expertise ?? []).map((skill) => ({ skill, source: c.source.ref }))),
    ...named.filter((c) => c.modifier.expertise).flatMap((c) => c.modifier.skills.map((skill) => ({ skill, source: c.source }))),
  ];
  const proficient = new Set(skillSources.map((s) => s.skill));
  const expert = new Set(expertise.map((s) => s.skill));
  const floor = ofKind('skill-floor').length > 0 ? Math.floor(pb / 2) : 0;
  const skills = Object.fromEntries(
    Object.entries(tables.skills).map(([skill, ability]) => {
      const proficiency: Proficiency | undefined = expert.has(skill) ? 'expertise' : proficient.has(skill) ? 'proficient' : undefined;
      const bonus = mods[ability] + (proficiency === 'expertise' ? 2 * pb : proficiency ? pb : floor) + checkBonus;
      return [skill, proficiency ? { bonus, proficiency } : { bonus }];
    }),
  );

  // Hit Points: the starting class's die at its maximum for level 1, then the fixed value per level,
  // plus Constitution and any per-level bonus for each level, or each level of the feature's class.
  const dice = classes.flatMap((c) => Array.from({ length: c.level }, () => dieSize(c.stats.hitDie)));
  const perLevel = ofKind('hp-per-level')
    .filter((c) => holds(c.modifier))
    .reduce((total, c) => total + valueOf(c) * (c.modifier.per === 'class' ? (c.classLevel ?? level) : level), 0);
  const hp = dice.reduce((total, die, i) => total + (i === 0 ? die : fixedHp(die)), 0) + mods.con * level + perLevel;

  // Armor Class: the highest formula that applies (the equipped armor's with its Dexterity rule, or
  // 10 + Dexterity, or a modifier's), then the shield and each bonus.
  const dexToAc = (a: NonNullable<EquipmentStats['armor']>) => (a.dex ? Math.min(mods.dex, a.dexMax ?? Infinity) : 0);
  const formulas = [
    armor ? armor.stats.armor!.ac + dexToAc(armor.stats.armor!) : 10 + mods.dex,
    ...ofKind('ac-formula').filter((c) => holds(c.modifier)).map((c) => c.modifier.base + (c.modifier.abilities ?? []).reduce((t, a) => t + mods[a], 0)),
  ];
  const ac = {
    value: Math.max(...formulas) + (shield?.stats.armor!.ac ?? 0) + sum(ofKind('ac-bonus')) + sumItems(ofItemKind('ac-bonus')),
    ...(armor && { armor: armor.ref }),
    ...(shield && { shield: shield.ref }),
  };

  // Attacks: Strength for a melee weapon, Dexterity for a ranged one, the higher for Finesse or
  // where a modifier allows another ability, then the bonuses and dice of the modifiers that apply.
  const isA = (g: (typeof gear)[number], filter: ModifierWeapon, twoHanded: boolean): boolean => {
    const ranged = tree?.contains('ranged-weapons', { stats: g.stats }) ?? false;
    const melee = tree?.contains('melee-weapons', { stats: g.stats }) ?? false;
    if (filter === 'ranged') return ranged;
    if (filter === 'melee') return melee;
    if (filter === 'one-handed-melee') return melee && !twoHanded && !hasProperty(g.stats, 'two-handed') && weapons.length === 1;
    return g.stats.group === 'simple-melee-weapons' || (g.stats.group === 'martial-melee-weapons' && hasProperty(g.stats, 'light'));
  };
  const attacks = weapons.map((g): CharacterAttack => {
    const weapon = g.stats.weapon!;
    const ranged = tree?.contains('ranged-weapons', { stats: g.stats }) ?? false;
    const applies = (c: { modifier: { weapon: ModifierWeapon; while?: ModifierWhile[] } }, twoHanded = false) => isA(g, c.modifier.weapon, twoHanded) && holds(c.modifier);
    // An item's bonus with no `weapon` is the weapon item's own.
    const itemBonus = (kind: 'attack-bonus' | 'damage-bonus', twoHanded = false) =>
      ofItemKind(kind)
        .filter((c) => (c.modifier.weapon === undefined ? c.index === g.index : isA(g, c.modifier.weapon, twoHanded)) && holds(c.modifier))
        .reduce((t, c) => t + itemValue(c), 0);
    const candidates: Ability[] = [
      ...(hasProperty(g.stats, 'finesse') ? (['str', 'dex'] as Ability[]) : [(ranged ? 'dex' : 'str') as Ability]),
      ...ofKind('attack-ability').filter((c) => applies(c)).flatMap((c) => c.modifier.abilities),
    ];
    const ability = candidates.reduce((best, a) => (mods[a] > mods[best] ? a : best), candidates[0]!);
    const damageBonus = (twoHanded: boolean) =>
      ofKind('damage-bonus').filter((c) => applies(c, twoHanded)).reduce((t, c) => t + valueOf(c), 0) + itemBonus('damage-bonus', twoHanded);
    const modifier = mods[ability] + damageBonus(false);
    const dieFor = (base: string, twoHanded: boolean) =>
      ofKind('damage-die')
        .filter((c) => applies(c, twoHanded))
        .map((c) => c.modifier.die ?? atLevel(c.modifier.byLevel!, c.classLevel ?? level))
        .reduce<string>((d, other) => (other === undefined ? d : largerDie(d, other)), base);
    const { flat, type } = weapon.damage;
    const dice = weapon.damage.dice === undefined ? undefined : dieFor(weapon.damage.dice, false);
    const versatileModifier = mods[ability] + damageBonus(true);
    const versatileDice = weapon.versatile && dieFor(weapon.versatile, true);
    return {
      ref: g.ref,
      weapon: g.key,
      ability,
      attackBonus: attackBonus(pb, mods[ability]) + ofKind('attack-bonus').filter((c) => applies(c)).reduce((t, c) => t + valueOf(c), 0) + itemBonus('attack-bonus'),
      damage: {
        ...(dice !== undefined ? { dice } : { flat }),
        modifier,
        type,
        display: dice !== undefined ? withModifier(dice, modifier) : String(Math.max(1, flat! + modifier)),
      },
      ...(versatileDice && { versatile: { dice: versatileDice, display: withModifier(versatileDice, versatileModifier) } }),
      ...(weapon.range && { range: weapon.range }),
      properties: weapon.properties ?? [],
      mastery: weapon.mastery,
    };
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
    casters.filter((c) => c.stats.spellcasting!.progression === 'full').reduce((total, c) => total + c.level, 0) +
    casters.filter((c) => c.stats.spellcasting!.progression === 'half').reduce((total, c) => total + Math.ceil(c.level / 2), 0);
  const pact = casters.find((c) => c.stats.spellcasting!.progression === 'pact');
  const spellLevels = (stats.spells ?? []).map(({ ref }) => ({ ref, level: need<SpellStats>(library, ref).stats.level }));
  const spells = [...new Set(spellLevels.map((s) => s.level))]
    .sort((a, b) => a - b)
    .map((at) => ({ level: at, spells: spellLevels.filter((s) => s.level === at).map((s) => s.ref) }));

  const speed = species.stats.speed + sum(ofKind('speed-bonus'));
  const modes = [...new Set(ofKind('speed-mode').filter((c) => holds(c.modifier)).flatMap((c) => c.modifier.modes))];

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
      ...ofKind('tool-proficiency').flatMap((c) => c.modifier.tools.map((t) => ({ source: c.source, ref: t.ref, ...(t.note && { note: t.note }) }))),
    ],
    languages: [
      ...chosen.flatMap((c) => (c.languages ?? []).map((language) => ({ source: c.source.ref, language }))),
      ...ofKind('language').flatMap((c) => c.modifier.languages.map((language) => ({ source: c.source, language }))),
    ],
  };

  return {
    scores,
    abilityMods: mods,
    saves,
    skills,
    passivePerception: 10 + skills.perception!.bonus,
    hp,
    initiative: mods.dex + sum(ofKind('initiative-bonus')) + checkBonus,
    speed,
    ...(modes.length > 0 && { speeds: Object.fromEntries(modes.map((m) => [m, speed])) }),
    ac,
    attacks,
    spellcasting,
    ...(casterLevel > 0 && { spellSlots: [...tables.multiclassSpellSlots[Math.min(casterLevel, 20) - 1]!] }),
    ...(pact && { pactSlots: { ...tables.pactMagic[pact.level - 1]! } }),
    spells,
    features: features.map(({ source, features: list }) => ({ source, features: list })),
    proficiencies,
  };
}
