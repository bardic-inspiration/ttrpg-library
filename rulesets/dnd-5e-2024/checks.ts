// Consistency checks a JSON schema can't express (docs/rulesets.md#consistency-checks). They run
// after the schema stage, so `stats` already has the shape in types.ts.

import { atLevel, deriveCharacter, deriveCharacterLinked, equipmentOf } from './characters.ts';
import { deriveClass, levelOf } from './classes.ts';
import { attackBonus, deriveCreature, saveDc } from './derive.ts';
import { findTokens, renderToken } from './tokens.ts';
import type {
  Ability,
  Action,
  BackgroundStats,
  CharacterStats,
  ClassFeatureStats,
  ClassStats,
  CreatureStats,
  DerivedAction,
  DerivedCreature,
  FeatStats,
  Grant,
  ItemStats,
  LinkedCharacter,
  Modifier,
  SpeciesStats,
  SpeciesTraitStats,
  SpellStats,
  SubclassStats,
  Tables,
} from './types.ts';
import equipmentGroups from './rules/equipment-groups.json' with { type: 'json' };
import { ACTION_LISTS } from './types.ts';
import type { Issue, LinkedEntry, LinkTarget, NameLookup } from '../module.ts';

const MAX_ATTACK_BONUS = 17;
const MAX_SAVE_DC = 30;

/** Literal numbers in creature prose that look derived, and the token to use instead (docs/rulesets.md#text-tokens). */
const LITERALS: { pattern: RegExp; token: string }[] = [
  { pattern: /\bDC\s*\d+/i, token: '{dc:<ability>}' },
  { pattern: /\+\s*\d+\s+to\s+hit\b/i, token: '{atk:<ability>}' },
  { pattern: /\b\d+\s*\(\s*\d+\s*d\s*\d+(\s*[-+−–]\s*\d+)?\s*\)/i, token: '{dmg:<dice>}' },
];

const PROSE_FIELDS = ['text', 'onHit', 'onFailure', 'onSuccess', 'onFailureOrSuccess'] as const;

/** Every prose field of a creature that may hold tokens, with its path. */
function proseFields(stats: CreatureStats): { path: string; text: string }[] {
  const fields: { path: string; text: string }[] = [];
  const fromAction = (action: Action, path: string) => {
    for (const field of PROSE_FIELDS) {
      const text = action[field];
      if (text !== undefined) fields.push({ path: `${path}.${field}`, text });
    }
  };
  for (const list of ACTION_LISTS) {
    (stats[list] ?? []).forEach((action, i) => fromAction(action, `stats.${list}[${i}]`));
  }
  const legendary = stats.legendaryActions;
  if (legendary?.intro !== undefined) fields.push({ path: 'stats.legendaryActions.intro', text: legendary.intro });
  legendary?.items.forEach((action, i) => fromAction(action, `stats.legendaryActions.items[${i}]`));
  if (stats.spellcasting?.note !== undefined) {
    fields.push({ path: 'stats.spellcasting.note', text: stats.spellcasting.note });
  }
  return fields;
}

/** Each action with its path and derived values. */
function actionsWithDerived(stats: CreatureStats, derived: DerivedCreature) {
  const out: { path: string; action: Action; derived: DerivedAction | undefined }[] = [];
  for (const list of ACTION_LISTS) {
    (stats[list] ?? []).forEach((action, i) =>
      out.push({ path: `stats.${list}[${i}]`, action, derived: derived[list][i] }),
    );
  }
  stats.legendaryActions?.items.forEach((action, i) =>
    out.push({ path: `stats.legendaryActions.items[${i}]`, action, derived: derived.legendaryActions.items[i] }),
  );
  return out;
}

export function checkCreature(stats: CreatureStats, tables: Tables): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warning = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  const derived = deriveCreature(stats, tables);

  for (const [mode, feet] of Object.entries(stats.speed)) {
    if (typeof feet === 'number' && feet % 5 !== 0) {
      error(`stats.speed.${mode}`, `speed ${feet} ft. is not a multiple of 5`);
    }
  }

  for (const { path, text } of proseFields(stats)) {
    for (const match of findTokens(text, tables)) {
      if (!match.token) {
        error(path, `bad token ${match.raw}: ${match.error}`);
        continue;
      }
      const { token } = match;
      if (token.kind === 'authored-dc') {
        warning(path, `token ${match.raw} is an authored DC; confirm it isn't derived (a save DC from an ability uses {dc:<ability>})`);
      }
      if ((token.kind === 'atk' || token.kind === 'dc') && token.adjust !== 0) {
        warning(path, `token ${match.raw} adjusts the formula by ${token.adjust}; confirm the deviation`);
      }
      if (token.kind === 'atk' && attackBonus(derived.pb, derived.abilityMods[token.ability], token.adjust) > MAX_ATTACK_BONUS) {
        warning(path, `token ${match.raw} renders an attack bonus of ${renderToken(token, derived)}, above +${MAX_ATTACK_BONUS}`);
      }
      if (token.kind === 'dc' && saveDc(derived.pb, derived.abilityMods[token.ability], token.adjust) > MAX_SAVE_DC) {
        warning(path, `token ${match.raw} renders ${renderToken(token, derived)}, above DC ${MAX_SAVE_DC}`);
      }
    }
    const prose = text.replace(/\{[^{}]*\}/g, ' ');
    for (const { pattern, token } of LITERALS) {
      const literal = pattern.exec(prose);
      if (literal) error(path, `"${literal[0]}" writes a derived number; use the token ${token} instead`);
    }
  }

  for (const [skill, value] of Object.entries(stats.skills ?? {})) {
    if (typeof value !== 'string') warning(`stats.skills.${skill}.adjust`, `${skill} adjusted by ${value.adjust}; confirm the deviation`);
  }
  if (stats.initiative?.adjust !== undefined) {
    warning('stats.initiative.adjust', `initiative adjusted by ${stats.initiative.adjust}; confirm the deviation`);
  }
  if (stats.spellcasting) {
    if (stats.spellcasting.adjust !== undefined) {
      warning('stats.spellcasting.adjust', `spellcasting adjusted by ${stats.spellcasting.adjust}; confirm the deviation`);
    }
    if (derived.spellcasting && derived.spellcasting.attackBonus > MAX_ATTACK_BONUS && stats.spellcasting.includeAttack) {
      warning('stats.spellcasting', `spell attack bonus +${derived.spellcasting.attackBonus} is above +${MAX_ATTACK_BONUS}`);
    }
    if (derived.spellcasting && derived.spellcasting.dc > MAX_SAVE_DC) {
      warning('stats.spellcasting', `spell save DC ${derived.spellcasting.dc} is above DC ${MAX_SAVE_DC}`);
    }
  }

  for (const { path, action, derived: d } of actionsWithDerived(stats, derived)) {
    if (action.adjust !== undefined) {
      warning(`${path}.adjust`, `${action.name} adjusted by ${action.adjust}; confirm the deviation`);
    }
    (action.damage ?? []).forEach((damage, j) => {
      if (j === 0 && damage.condition !== undefined) {
        error(`${path}.damage[0].condition`, 'a condition is allowed only on a rider (damage after the first)');
      }
      if (damage.bonus !== undefined && damage.bonus !== 0) {
        warning(`${path}.damage[${j}].bonus`, `${action.name} damage has a bonus of ${damage.bonus}; confirm the deviation`);
      }
    });
    if (d?.attackBonus !== undefined && d.attackBonus > MAX_ATTACK_BONUS) {
      warning(path, `${action.name} attack bonus +${d.attackBonus} is above +${MAX_ATTACK_BONUS}`);
    }
    if (d?.saveDc !== undefined && d.saveDc > MAX_SAVE_DC) {
      warning(path, `${action.name} save DC ${d.saveDc} is above DC ${MAX_SAVE_DC}`);
    }
  }

  return issues;
}

/** Item checks (docs/rulesets.md#consistency-checks "Item"). */
export function checkItem(stats: ItemStats): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });

  if ((stats.category === 'armor' || stats.category === 'weapon') && stats.baseItem === undefined) {
    error('stats.baseItem', `a ${stats.category} needs a baseItem: { "oneOf": [{ "ref": "equipment/longsword" }] } or { "any": [{ "ref": "equipment/medium-armor" }] }`);
  }
  if (stats.rarityVariants !== undefined && stats.rarity !== 'varies') {
    error('stats.rarityVariants', 'rarityVariants are allowed only when rarity is "varies"');
  }
  if (stats.attunement.requirement !== undefined && !stats.attunement.required) {
    error('stats.attunement.requirement', 'a requirement is allowed only when attunement.required is true');
  }
  (stats.spells ?? []).forEach((spell, i) => {
    const path = `stats.spells[${i}]`;
    if (spell.chargeCost !== undefined && stats.charges === undefined) {
      error(`${path}.chargeCost`, 'a chargeCost is allowed only when the item has charges');
    }
    if (spell.maxChargeCost !== undefined) {
      if (spell.chargeCost === undefined) error(`${path}.maxChargeCost`, 'a maxChargeCost needs a chargeCost, the least charges spent');
      else if (spell.maxChargeCost <= spell.chargeCost) {
        error(`${path}.maxChargeCost`, `maxChargeCost must be above chargeCost (${spell.chargeCost}); omit it for a fixed cost`);
      }
    }
    // The template renders these from the structured fields (docs/rulesets.md#text-tokens).
    if (spell.saveDc !== undefined) {
      const literal = new RegExp(`\\bDC\\s*${spell.saveDc}(?!\\d)`, 'i').exec(stats.effect);
      if (literal) issues.push({ level: 'warning', path: 'stats.effect', message: `"${literal[0]}" restates ${path}.saveDc; the template renders it` });
    }
    if (spell.attackBonus !== undefined) {
      const sign = spell.attackBonus < 0 ? '[-−]' : '\\+';
      const literal = new RegExp(`${sign}\\s*${Math.abs(spell.attackBonus)}(?!\\d)`).exec(stats.effect);
      if (literal) issues.push({ level: 'warning', path: 'stats.effect', message: `"${literal[0]}" restates ${path}.attackBonus; the template renders it` });
    }
  });
  return issues;
}

/** Spell checks (docs/rulesets.md#consistency-checks "Spell"). */
export function checkSpell(stats: SpellStats): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const { duration, range, castingTime } = stats;

  if (duration.concentration && duration.kind !== 'timed') {
    error('stats.duration.concentration', `concentration needs a timed duration, not "${duration.kind}"`);
  }
  if (duration.upTo && (duration.kind !== 'timed' || duration.concentration)) {
    error('stats.duration.upTo', 'upTo is for a timed duration without concentration, which already reads "up to"');
  }
  if (duration.kind === 'timed') {
    if (duration.amount === undefined) error('stats.duration', 'a timed duration needs an amount');
    if (duration.unit === undefined) error('stats.duration', 'a timed duration needs a unit');
  }
  if (range.kind === 'distance' && (range.feet === undefined) === (range.miles === undefined)) {
    error('stats.range', 'a distance range needs feet or miles, not both');
  }
  if (range.kind !== 'distance' && (range.feet !== undefined || range.miles !== undefined)) {
    error('stats.range', 'feet and miles are for a distance range');
  }
  if (stats.components.m?.consumed && stats.components.m.costGp === undefined) {
    error('stats.components.m', 'a consumed material component needs a costGp');
  }
  if (stats.higherLevels !== undefined && stats.level === 0) {
    error('stats.higherLevels', 'higherLevels is for leveled spells; a cantrip uses cantripUpgrade');
  }
  if (stats.cantripUpgrade !== undefined && stats.level > 0) {
    error('stats.cantripUpgrade', 'cantripUpgrade is for cantrips; a leveled spell uses higherLevels');
  }
  if (castingTime.unit === 'reaction' && castingTime.trigger === undefined) {
    error('stats.castingTime', 'a reaction casting time needs a trigger');
  }
  if (castingTime.unit !== 'reaction' && castingTime.unit !== 'bonus-action' && castingTime.trigger !== undefined) {
    error('stats.castingTime.trigger', 'a trigger is allowed only on a reaction or bonus action casting time');
  }
  if (stats.level === 0 && stats.ritual) {
    issues.push({ level: 'warning', path: 'stats.ritual', message: 'a cantrip is marked ritual; confirm it' });
  }
  return issues;
}

/** The SRD's feats follow these; a custom feat that doesn't needs a reason, so they warn (docs/rulesets.md#feats). */
export function checkFeat(stats: FeatStats): Issue[] {
  const issues: Issue[] = [];
  const warning = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  if (stats.category === 'origin') {
    if (stats.level !== undefined) warning('stats.level', 'an origin feat has no prerequisite, since a background grants it at level 1');
    if (stats.prerequisite !== undefined) warning('stats.prerequisite', 'an origin feat has no prerequisite, since a background grants it at level 1');
  }
  if (stats.category === 'general' && (stats.level ?? 0) < 4) warning('stats.level', 'a general feat has a prerequisite of level 4 or more');
  if (stats.category === 'epic-boon' && (stats.level ?? 0) < 19) warning('stats.level', 'an epic boon has a prerequisite of level 19 or more');
  return issues;
}

/** Every SRD background offers 50 GP as its other option (docs/rulesets.md#backgrounds). */
const BACKGROUND_GP = 50;

export function checkBackground(stats: BackgroundStats): Issue[] {
  const issues: Issue[] = [];
  const last = stats.equipment.length - 1;
  const option = stats.equipment[last];
  if (option?.items !== undefined) {
    issues.push({ level: 'error', path: `stats.equipment[${last}]`, message: 'the last option is coins only, the alternative to the package' });
  } else if (option?.gp !== BACKGROUND_GP) {
    issues.push({ level: 'warning', path: `stats.equipment[${last}].gp`, message: `the coin option is ${BACKGROUND_GP} GP in every SRD background` });
  }
  return issues;
}

/** A background grants an origin feat (docs/rulesets.md#backgrounds). */
export function checkBackgroundLinks(stats: BackgroundStats, target: (key: string) => { type: string; stats: unknown } | undefined): Issue[] {
  const feat = target(stats.feat.ref);
  if (feat?.type !== 'feat') return [];
  const category = (feat.stats as FeatStats).category;
  return category === 'origin' ? [] : [{ level: 'error', path: 'stats.feat', message: `${stats.feat.ref} is a ${category} feat; a background grants an origin feat` }];
}

/**
 * A creature spell written as text is SRD content the library lacks, so text that names a spell the
 * library has is a ref instead (docs/rulesets.md#consistency-checks).
 */
export function checkCreatureLinks(stats: CreatureStats, named: NameLookup): Issue[] {
  const spellcasting = stats.spellcasting;
  if (!spellcasting) return [];
  const lists = [
    { path: 'stats.spellcasting.atWill', spells: spellcasting.atWill ?? [] },
    ...Object.entries(spellcasting.perDay ?? {}).map(([uses, spells]) => ({ path: `stats.spellcasting.perDay.${uses}`, spells: spells ?? [] })),
  ];
  return lists.flatMap(({ path, spells }) =>
    spells.flatMap((spell, i) => {
      const key = typeof spell === 'string' ? named('spell', spell) : undefined;
      return key ? [{ level: 'error' as const, path: `${path}[${i}]`, message: `"${spell}" is ${key} in the library; write it as a ref` }] : [];
    }),
  );
}

/** A species' speed is a multiple of 5, as a creature's is (docs/rulesets.md#species). */
export function checkSpecies(stats: SpeciesStats): Issue[] {
  return stats.speed % 5 === 0 ? [] : [{ level: 'error', path: 'stats.speed', message: `speed ${stats.speed} is not a multiple of 5` }];
}

/** The lowest and highest base score point buy allows (SRD 5.2 "Character Creation"). */
const POINT_BUY_MIN = 8;
const POINT_BUY_MAX = 15;
/** The highest a placed increase takes a score, unless its feat says otherwise. */
const SCORE_MAX = 20;
/** The score a multiclass prerequisite asks of each class's primary ability. */
const MULTICLASS_MIN = 13;
/** The most magic items a character is attuned to at once. */
const ATTUNEMENT_MAX = 3;

/** A character's checks from its own stats (docs/rulesets.md#consistency-checks): point buy and class levels. */
export function checkCharacter(stats: CharacterStats, tables: Tables): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  for (const a of tables.abilities) {
    const score = stats.abilities.base[a];
    if (score < POINT_BUY_MIN || score > POINT_BUY_MAX) error(`stats.abilities.base.${a}`, `a base score is ${POINT_BUY_MIN} to ${POINT_BUY_MAX} with point buy; ${a} is ${score}`);
  }
  const { pointCost } = deriveCharacter(stats, tables);
  if (pointCost !== undefined && pointCost > tables.pointBuy.budget) error('stats.abilities.base', `the base scores cost ${pointCost} points; point buy allows ${tables.pointBuy.budget}`);
  const level = stats.classes.reduce((sum, c) => sum + c.level, 0);
  if (level > 20) error('stats.classes', `the class levels total ${level}; a character is level 1 to 20`);
  const seen = new Set<string>();
  stats.classes.forEach((c, i) => {
    if (seen.has(c.class.ref)) error(`stats.classes[${i}].class`, `${c.class.ref} is taken twice; one entry holds all its levels`);
    seen.add(c.class.ref);
  });
  return issues;
}

/** The languages every character picks beside Common at its origin, under its background (SRD 5.2 "Character Creation"). */
const ORIGIN_LANGUAGES = 2;

/** The highest spell level a class's own slots cast at its level, as a single-class caster's. */
function maxSpellLevel(stats: ClassStats, level: number, tables: Tables): number {
  const derived = deriveClass(stats, tables);
  if (derived.pactSlots) return derived.pactSlots[level - 1]!.slotLevel;
  return derived.spellSlots?.[level - 1]?.length ?? 0;
}

/**
 * Seats each item in a different seat it fits (bipartite matching by augmenting paths), for spells
 * in their classes' and feats' counts and feats in the grants that give them. Returns the items
 * left out and, for each seat, the item it holds.
 */
function seat(items: number, seats: number, fits: (item: number, seat: number) => boolean): { unseated: number[]; holder: (number | undefined)[] } {
  const holder: (number | undefined)[] = Array.from({ length: seats }, () => undefined);
  const place = (item: number, visited: Set<number>): boolean => {
    for (let k = 0; k < seats; k++) {
      if (visited.has(k) || !fits(item, k)) continue;
      visited.add(k);
      if (holder[k] === undefined || place(holder[k]!, visited)) {
        holder[k] = item;
        return true;
      }
    }
    return false;
  };
  const unseated = Array.from({ length: items }, (_, i) => i).filter((i) => !place(i, new Set()));
  return { unseated, holder };
}

/** The pick kinds a choice holds, and how a message names them. */
const PICKS = {
  skills: ['skill', 'skills'],
  expertise: ['Expertise pick', 'Expertise picks'],
  tools: ['tool', 'tools'],
  languages: ['language', 'languages'],
} as const;
type PickKind = keyof typeof PICKS;
const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a');
const counted = (n: number, [one, many]: readonly [string, string]) => `${n} ${n === 1 ? one : many}`;
const picked = (n: number) => `${n} ${n === 1 ? 'is' : 'are'} picked`;

/** A class's column value at a level, as a count: "3" is 3, and "—" is none. */
const columnCount = (stats: ClassStats, name: string, level: number): number => {
  const value = stats.columns?.find((c) => c.name === name)?.values[level - 1];
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? 0 : n;
};

/** The equipment groups, for the weapon groups a weapon sits under. */
const GROUP_PARENT = new Map((equipmentGroups as { id: string; parent?: string }[]).map((g) => [g.id, g.parent]));
const groupsOf = (group: string): string[] => {
  const all: string[] = [];
  for (let at: string | undefined = group; at !== undefined; at = GROUP_PARENT.get(at)) all.push(at);
  return all;
};

/**
 * A character's checks that read the entries it names (docs/rulesets.md#consistency-checks): its
 * background's increases, the final scores, multiclass prerequisites, subclasses, feats and the
 * grants that give them, choices and options at the counts their sources give (docs/rulesets.md#grants),
 * spells, attunement, and training with equipped gear.
 */
export function checkCharacterLinks(stats: CharacterStats, target: LinkTarget, tables: Tables): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warning = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  const statsOf = <T>(key: string, type: string): T | undefined => {
    const found = target(key);
    return found?.type === type ? (found.stats as T) : undefined;
  };
  const level = stats.classes.reduce((sum, c) => sum + c.level, 0);
  const background = statsOf<BackgroundStats>(stats.background.ref, 'background');
  const species = statsOf<SpeciesStats>(stats.species.ref, 'species');
  const classes = stats.classes.map((c) => ({
    ...c,
    stats: statsOf<ClassStats>(c.class.ref, 'class'),
    subclassStats: c.subclass ? statsOf<SubclassStats>(c.subclass.ref, 'subclass') : undefined,
  }));
  const traits = (species?.traits ?? []).map((t) => ({ ref: t.ref, stats: statsOf<SpeciesTraitStats>(t.ref, 'species-trait') }));
  const feats = stats.feats ?? [];
  const featStats = feats.map((f) => statsOf<FeatStats>(f.ref, 'feat'));

  /** Each class's and subclass's features, with their levels up to the class's level; a feature with none isn't had. */
  const featuresOf = (c: (typeof classes)[number]) =>
    [...(c.stats?.features ?? []), ...(c.subclass && c.subclassStats?.class.ref === c.class.ref ? c.subclassStats.features : [])].flatMap(({ ref }) => {
      const feature = statsOf<ClassFeatureStats>(ref, 'class-feature');
      const levels = (feature?.levels ?? []).map(levelOf).filter((l) => l <= c.level);
      return feature && levels.length > 0 ? [{ ref, levels, grants: feature.grants ?? [] }] : [];
    });
  const classFeatures = classes.map((c) => ({ class: c, features: featuresOf(c) }));

  // The background's increases: +2 and +1, or +1 to each of three, among its three abilities.
  const increases = Object.entries(stats.abilities.background) as [Ability, number][];
  const pattern = increases.map(([, by]) => by).sort().join(',');
  if (pattern !== '1,2' && pattern !== '1,1,1') error('stats.abilities.background', 'the background gives +2 and +1, or +1 to each of three abilities');
  if (background) {
    for (const [a] of increases) if (!background.abilities.includes(a)) error(`stats.abilities.background.${a}`, `${stats.background.ref} increases ${background.abilities.join(', ')}, not ${a}`);
  }

  // No placed increase takes a score above 20, or above its feat's own maximum.
  const scores = { ...stats.abilities.base };
  for (const [a, by] of increases) scores[a] += by;
  for (const [a, score] of Object.entries(scores)) if (score > SCORE_MAX) error(`stats.abilities.background.${a}`, `${a} is ${score} after the background; a score can't go above ${SCORE_MAX}`);
  feats.forEach((f, i) => {
    const feat = featStats[i];
    const placed = Object.entries(f.abilities ?? {}) as [Ability, number][];
    const bonus = feat?.modifiers?.find((m): m is Extract<Modifier, { kind: 'ability-bonus' }> => m.kind === 'ability-bonus' && m.total !== undefined);
    const max = bonus?.max ?? SCORE_MAX;
    for (const [a, by] of placed) {
      scores[a] += by;
      if (scores[a] > max) error(`stats.feats[${i}].abilities.${a}`, `${f.ref} takes ${a} to ${scores[a]}; it can't go above ${max}`);
    }
    if (bonus) {
      const total = placed.reduce((t, [, by]) => t + by, 0);
      if (total !== bonus.total) error(`stats.feats[${i}].abilities`, `${f.ref} places ${bonus.total} points of increases; these total ${total}`);
      for (const [a] of placed) if (bonus.from && !bonus.from.includes(a)) error(`stats.feats[${i}].abilities.${a}`, `${f.ref} increases ${bonus.from.join(', ')}, not ${a}`);
    } else if (feat?.modifiers?.some((m) => m.kind === 'ability-bonus') && placed.length > 0) {
      error(`stats.feats[${i}].abilities`, `${f.ref}'s increases are fixed; it places none`);
    }
  });

  // What the character derives from the entries, for the checks that read final scores, proficiencies,
  // spellcasting, and equipment. A target that failed its schema has its own error, so these checks wait for it.
  const resolve = (key: string): LinkedEntry | undefined => {
    const found = target(key);
    return found && { type: found.type, id: key.slice(key.indexOf('/') + 1), name: key, stats: found.stats };
  };
  const library = { entries: [], resolve };
  let derived: LinkedCharacter | undefined;
  try {
    derived = deriveCharacterLinked(stats, library, tables);
  } catch {
    derived = undefined;
  }

  // Multiclass prerequisites: each class's primary ability at 13 or more, the starting class's included.
  if (derived && classes.length > 1) {
    classes.forEach((c, i) => {
      if (!c.stats) return;
      const { abilities, join } = c.stats.primaryAbility;
      const meets = (a: Ability) => derived.scores[a] >= MULTICLASS_MIN;
      const met = join === 'and' ? abilities.every(meets) : abilities.some(meets);
      if (!met) {
        const needs = abilities.join(join === 'and' ? ' and ' : ' or ');
        error(`stats.classes[${i}].class`, `multiclassing with ${c.class.ref} needs ${needs} ${MULTICLASS_MIN} or more; the final scores are ${abilities.map((a) => `${a} ${derived.scores[a]}`).join(', ')}`);
      }
    });
  }

  // A subclass belongs to its class, and is present exactly from the class's first subclass level.
  classes.forEach((c, i) => {
    if (!c.stats) return;
    const at = c.stats.subclassLevels[0];
    if (c.subclass) {
      if (c.subclassStats && c.subclassStats.class.ref !== c.class.ref) error(`stats.classes[${i}].subclass`, `${c.subclass.ref} is a subclass of ${c.subclassStats.class.ref}, not ${c.class.ref}`);
      if (at === undefined || c.level < at) error(`stats.classes[${i}].subclass`, `${c.class.ref} gains its subclass at level ${at ?? '—'}; this is level ${c.level}`);
    } else if (at !== undefined && c.level >= at) {
      error(`stats.classes[${i}]`, `${c.class.ref} has its subclass from level ${at}; name it`);
    }
  });

  // Feats: the background's origin feat, once; from the species or a class, one per feat grant of a
  // trait or of a feature at that class level, of a category it allows; each feat's level and ability
  // prerequisite; only a repeatable feat twice.
  const fromBackground = feats.filter((f) => f.source.ref === stats.background.ref);
  if (background && (fromBackground.length !== 1 || fromBackground[0]!.ref !== background.feat.ref)) {
    error('stats.feats', `${stats.background.ref} grants one feat, ${background.feat.ref}`);
  }
  const classLevels = new Map(stats.classes.map((c) => [c.class.ref, c.level]));
  /** The feats taken from a species or class that names a real source, to seat in its grants. */
  const granted: number[] = [];
  feats.forEach((f, i) => {
    const feat = featStats[i];
    const { ref, level: at } = f.source;
    if (ref.startsWith('background/') && ref !== stats.background.ref) error(`stats.feats[${i}].source`, `${ref} isn't the character's background`);
    if (ref.startsWith('species/')) {
      if (ref !== stats.species.ref) error(`stats.feats[${i}].source`, `${ref} isn't the character's species`);
      else if (feat) granted.push(i);
    }
    if (ref.startsWith('class/')) {
      const has = classLevels.get(ref);
      if (has === undefined) error(`stats.feats[${i}].source`, `${ref} isn't one of the character's classes`);
      else if (at !== undefined && at > has) error(`stats.feats[${i}].source.level`, `${ref} is level ${has}; it hasn't reached level ${at}`);
      else if (feat) granted.push(i);
    }
    if (feat?.level !== undefined && feat.level > level) error(`stats.feats[${i}]`, `${f.ref} needs level ${feat.level}; the character is level ${level}`);
    if (feat && feat.repeatable === undefined && feats.findIndex((g) => g.ref === f.ref) < i) error(`stats.feats[${i}]`, `${f.ref} isn't repeatable; it's taken once`);
    if (feat?.requires && derived) {
      const { abilities, min, join } = feat.requires;
      const meets = (a: Ability) => derived.scores[a] >= min;
      if (!(join === 'and' ? abilities.every(meets) : abilities.some(meets))) {
        const needs = abilities.join(join === 'and' ? ' and ' : ' or ');
        error(`stats.feats[${i}]`, `${f.ref} needs ${needs} ${min} or more; the final scores are ${abilities.map((a) => `${a} ${derived.scores[a]}`).join(', ')}`);
      }
    }
  });
  const featSeats = [
    ...traits.flatMap((t) =>
      (t.stats?.grants ?? []).flatMap((g) => (g.kind === 'feat' ? [{ source: stats.species.ref, level: undefined as number | undefined, from: t.ref, categories: g.categories }] : [])),
    ),
    ...classFeatures.flatMap(({ class: c, features }) =>
      features.flatMap((feature) =>
        feature.grants.flatMap((g) => (g.kind === 'feat' ? feature.levels.map((l) => ({ source: c.class.ref, level: l as number | undefined, from: feature.ref, categories: g.categories })) : [])),
      ),
    ),
  ];
  const featSeating = seat(granted.length, featSeats.length, (item, k) => {
    const f = feats[granted[item]!]!;
    const s = featSeats[k]!;
    return s.source === f.source.ref && s.level === f.source.level && s.categories.includes(featStats[granted[item]!]!.category);
  });
  for (const item of featSeating.unseated) {
    const i = granted[item]!;
    const f = feats[i]!;
    const where = f.source.level === undefined ? `${f.source.ref}'s traits` : `${f.source.ref} level ${f.source.level}`;
    error(`stats.feats[${i}]`, `no feature of ${where} grants ${article(featStats[i]!.category)} ${featStats[i]!.category} feat that isn't already taken`);
  }
  featSeating.holder.forEach((held, k) => {
    if (held !== undefined) return;
    const s = featSeats[k]!;
    error('stats.feats', `${s.from} grants a feat${s.level === undefined ? '' : ` at ${s.source} level ${s.level}`} (${s.categories.join(', ')}); take one`);
  });

  // Choices: each under a source the character has, filling exactly the picks it gives.
  const has = new Set<string>([
    stats.species.ref,
    stats.background.ref,
    ...traits.map((t) => t.ref),
    ...stats.classes.flatMap((c) => [c.class.ref, ...(c.subclass ? [c.subclass.ref] : [])]),
    ...classFeatures.flatMap(({ features }) => features.map((f) => f.ref)),
    ...feats.map((f) => f.ref),
  ]);
  const choices = stats.choices ?? [];
  choices.forEach((c, i) => {
    if (!has.has(c.source.ref)) error(`stats.choices[${i}].source`, `${c.source.ref} isn't something the character has`);
  });
  // What each source gives to pick: the starting class its skills and its `start` grants; a later
  // class its `multiclass` grants; the background its tool, when it offers a choice, and the origin
  // languages; a trait, a feat each time it's taken, and a feature at each of its levels, their grants.
  const offers = new Map<string, Grant[]>();
  const offer = (source: string, grants: Grant[]) => offers.set(source, [...(offers.get(source) ?? []), ...grants]);
  classes.forEach((c, i) => {
    if (!c.stats) return;
    if (i === 0) offer(c.class.ref, [{ kind: 'skills', count: c.stats.skills.choose, ...(c.stats.skills.from && { from: c.stats.skills.from }) }, ...(c.stats.grants?.start ?? [])]);
    else offer(c.class.ref, c.stats.grants?.multiclass ?? []);
  });
  if (background) offer(stats.background.ref, [...(background.tool.choose ? [{ kind: 'tools' as const, count: 1, from: [{ ref: background.tool.ref }] }] : []), { kind: 'languages', count: ORIGIN_LANGUAGES }]);
  for (const t of traits) offer(t.ref, t.stats?.grants ?? []);
  feats.forEach((f, i) => offer(f.ref, featStats[i]?.grants ?? []));
  for (const { features } of classFeatures) for (const f of features) for (const _ of f.levels) offer(f.ref, f.grants);
  const sources = [...new Set([...offers.keys(), ...choices.map((c) => c.source.ref)])].filter((s) => has.has(s));
  for (const source of sources) {
    const grants = offers.get(source) ?? [];
    const groups = choices.filter((c) => c.source.ref === source);
    const chosen = {
      skills: groups.flatMap((c) => c.skills ?? []),
      expertise: groups.flatMap((c) => c.expertise ?? []),
      tools: groups.flatMap((c) => c.tools ?? []),
      languages: groups.flatMap((c) => c.languages ?? []),
    };
    const picks = (kind: PickKind): unknown[] => chosen[kind];
    const count = (kind: PickKind) => grants.reduce((n, g) => n + (g.kind === kind && 'count' in g ? g.count : 0), 0);
    const pooled = grants.some((g) => g.kind === 'skills' && g.withTools);
    for (const kind of Object.keys(PICKS) as PickKind[]) {
      if (pooled && kind === 'tools') continue;
      const n = picks(kind).length + (pooled && kind === 'skills' ? picks('tools').length : 0);
      const allowed = count(kind) + (pooled && kind === 'skills' ? count('tools') : 0);
      const noun = pooled && kind === 'skills' ? (['skill or tool', 'skills or tools'] as const) : PICKS[kind];
      if (n !== allowed) error('stats.choices', `${source} gives ${counted(allowed, noun)}; ${picked(n)}`);
    }
    // Picks from the lists the grants name, when every grant of the kind names one.
    const listed = (kind: 'skills' | 'expertise' | 'tools') => {
      const of = grants.filter((g): g is Extract<Grant, { kind: typeof kind }> => g.kind === kind);
      if (of.length === 0 || of.some((g) => g.from === undefined)) return undefined;
      return new Set(of.flatMap((g) => (g.from ?? []).map((x) => (typeof x === 'string' ? x : x.ref))));
    };
    for (const kind of ['skills', 'expertise'] as const) {
      const from = listed(kind);
      if (from) for (const skill of chosen[kind]) if (!from.has(skill)) error('stats.choices', `${skill} isn't one of the ${PICKS[kind][1]} ${source} offers`);
    }
    const tools = listed('tools');
    if (tools && !pooled) for (const tool of chosen.tools) if (!tools.has(tool.ref)) error('stats.choices', `${tool.ref} isn't one of the tools ${source} offers`);
  }
  const skillPicks = [...(background?.skills ?? []), ...choices.flatMap((c) => c.skills ?? [])];
  skillPicks.forEach((skill, i) => {
    if (skillPicks.indexOf(skill) < i) error('stats.choices', `${skill} is proficient twice; a source that would repeat a proficiency gives another skill`);
  });
  const expertise = choices.flatMap((c) => c.expertise ?? []);
  expertise.forEach((skill, i) => {
    if (expertise.indexOf(skill) < i) error('stats.choices', `Expertise in ${skill} is picked twice`);
    if (derived && !derived.proficiencies.skills.some((s) => s.skill === skill)) error('stats.choices', `Expertise in ${skill} needs proficiency in it`);
  });

  // Options: each from an option list of one of the character's classes, and each list filled to the
  // count its features' grants give at the class's level.
  const lists = new Set(classes.flatMap((c) => (c.stats?.optionLists ?? []).flatMap((l) => l.options.map((o) => o.ref))));
  const options = stats.options ?? [];
  options.forEach((o, i) => {
    if (!lists.has(o.ref)) error(`stats.options[${i}]`, `${o.ref} isn't on an option list of the character's classes`);
  });
  for (const { class: c, features } of classFeatures) {
    for (const list of c.stats?.optionLists ?? []) {
      const allowed = features.reduce((n, f) => {
        for (const g of f.grants) {
          if (g.kind !== 'options' || g.list !== list.name) continue;
          n += g.column !== undefined ? columnCount(c.stats!, g.column, c.level) : (atLevel(g.byLevel ?? {}, c.level) ?? 0);
        }
        return n;
      }, 0);
      const taken = options.filter((o) => list.options.some((l) => l.ref === o.ref)).length;
      if (taken !== allowed) error('stats.options', `${c.class.ref} ${c.level} gives ${allowed} of its ${list.name}; ${taken} ${taken === 1 ? 'is' : 'are'} taken`);
    }
  }

  // Spells: each the character's from an always-prepared list it has, or seated in a casting class's
  // cantrips or prepared spells (on its list, at a level its slots cast) or a feat's spell picks.
  const prepared = new Set<string>();
  const alwaysPrepared = (grants: Grant[], at: number) => {
    for (const g of grants) if (g.kind === 'spells' && g.byLevel) for (const [key, refs] of Object.entries(g.byLevel)) if (Number(key) <= at) for (const r of refs) prepared.add(r.ref);
  };
  for (const { class: c, features } of classFeatures) for (const f of features) alwaysPrepared(f.grants, c.level);
  for (const t of traits) alwaysPrepared(t.stats?.grants ?? [], level);
  feats.forEach((f, i) => alwaysPrepared(featStats[i]?.grants ?? [], f.source.level === undefined ? level : (classLevels.get(f.source.ref) ?? level)));
  const onList = (spell: SpellStats, spellRef: string, classRef: string) =>
    spell.classes.some((k) => k.ref === classRef) || (statsOf<ClassStats>(classRef, 'class')?.spells ?? []).some((k) => k.ref === spellRef);
  type SpellSeat = { list: string; cantrip: boolean; maxLevel: number; exact?: number };
  const spellSeats: SpellSeat[] = [
    ...classes.flatMap((c) => {
      const casting = c.stats?.spellcasting;
      if (!casting) return [];
      const maxLevel = maxSpellLevel(c.stats!, c.level, tables);
      return [
        ...Array.from({ length: casting.cantrips?.[c.level - 1] ?? 0 }, () => ({ list: c.class.ref, cantrip: true, maxLevel: 0 })),
        ...Array.from({ length: casting.prepared[c.level - 1]! }, () => ({ list: c.class.ref, cantrip: false, maxLevel })),
      ];
    }),
    ...feats.flatMap((f, i) =>
      (featStats[i]?.grants ?? []).flatMap((g) => {
        if (g.kind !== 'spells' || g.byLevel) return [];
        const list = f.note === undefined ? undefined : `class/${f.note.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (list === undefined || !statsOf<ClassStats>(list, 'class')) {
          error(`stats.feats[${i}].note`, `${f.ref} gives spells from the class list its note names; ${f.note === undefined ? 'it has no note' : `"${f.note}" names no class`}`);
          return [];
        }
        if (g.from && !g.from.some((k) => k.ref === list)) {
          error(`stats.feats[${i}].note`, `${f.ref} gives spells from the ${g.from.map((k) => k.ref).join(', ')} list; the note names ${list}`);
          return [];
        }
        return [
          ...Array.from({ length: g.cantrips ?? 0 }, () => ({ list, cantrip: true, maxLevel: 0 })),
          ...Array.from({ length: g.level1 ?? 0 }, () => ({ list, cantrip: false, maxLevel: 1, exact: 1 })),
        ];
      }),
    ),
  ];
  const fitsSeat = (spell: SpellStats, ref: string, s: SpellSeat) =>
    s.cantrip === (spell.level === 0) && spell.level <= s.maxLevel && (s.exact === undefined || spell.level === s.exact) && onList(spell, ref, s.list);
  const toSeat = (stats.spells ?? []).flatMap((s, index) => {
    if (prepared.has(s.ref)) return [];
    const spell = statsOf<SpellStats>(s.ref, 'spell');
    if (!spell) return [];
    if (!spellSeats.some((k) => fitsSeat(spell, s.ref, k))) {
      error(`stats.spells[${index}]`, `${s.ref} (level ${spell.level}) isn't on the spell list of a class whose slots cast it, or one a feat gives it from`);
      return [];
    }
    return [{ index, ref: s.ref, spell }];
  });
  for (const item of seat(toSeat.length, spellSeats.length, (i, k) => fitsSeat(toSeat[i]!.spell, toSeat[i]!.ref, spellSeats[k]!)).unseated) {
    const { index, ref, spell } = toSeat[item]!;
    error(`stats.spells[${index}]`, `${ref} is past the ${spell.level === 0 ? 'cantrips' : 'prepared spells'} its classes and feats allow at their levels`);
  }

  // Attunement: at most three items, and only one that requires it.
  const equipped = stats.equipped ?? [];
  const attuned = equipped.filter((e) => e.attuned);
  if (attuned.length > ATTUNEMENT_MAX) error('stats.equipped', `${attuned.length} items are attuned; a character attunes to ${ATTUNEMENT_MAX} at most`);
  equipped.forEach((e, i) => {
    if (!e.attuned) return;
    const item = e.ref.startsWith('item/') ? statsOf<ItemStats>(e.ref, 'item') : undefined;
    if (e.ref.startsWith('equipment/') || (item && !item.attunement.required)) error(`stats.equipped[${i}].attuned`, `${e.ref} doesn't require attunement`);
  });

  // Training: equipped armor and weapons the starting class's training, or a later class's, covers.
  // A class without `training` leaves the character's unknown, so the warning waits for every class's.
  if (derived && classes.every((c) => c.stats?.training)) {
    const training = classes.map((c, i) => (i === 0 ? c.stats!.training!.start : c.stats!.training!.multiclass)).filter((t) => t !== undefined);
    const armor = new Set(training.flatMap((t) => t.armor ?? []));
    const weapons = training.flatMap((t) => t.weapons ?? []);
    equipped.forEach((e, i) => {
      const gear = equipmentOf(library, e);
      if (!gear) return;
      if (gear.stats.armor && !armor.has(gear.stats.group as never)) warning(`stats.equipped[${i}]`, `the character has no training with ${gear.key} (${gear.stats.group})`);
      if (gear.stats.weapon) {
        const groups = groupsOf(gear.stats.group);
        const properties = (gear.stats.weapon.properties ?? []).map((p) => p.ref);
        const proficient = weapons.some((w) => groups.includes(w.group) && (!w.properties || w.properties.some((p) => properties.includes(p.ref))));
        if (!proficient) warning(`stats.equipped[${i}]`, `the character has no proficiency with ${gear.key} (${gear.stats.group})`);
      }
    });
  }

  return issues;
}
