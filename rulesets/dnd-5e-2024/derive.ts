// Derived values for dnd-5e-2024 (SPEC.md §6.1, §6.2). Pure functions of the
// stored inputs and the rules tables; nothing here is ever written to an entry.

import type {
  Ability,
  Action,
  ChallengeRatingRow,
  CreatureStats,
  Damage,
  DerivedAction,
  DerivedCreature,
  DerivedDamage,
  Proficiency,
  Tables,
} from './types.ts';
import { ACTION_LISTS } from './types.ts';

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

const proficiencyMultiplier = (proficiency: Proficiency | undefined): number =>
  proficiency === 'expertise' ? 2 : proficiency === 'proficient' ? 1 : 0;

/** `+2`, `+0`, `-1`. */
export const signed = (n: number): string => (n < 0 ? `-${-n}` : `+${n}`);

/** `1d8 + 2`, `1d8 - 1`, or `1d8` when the modifier is 0. */
const withModifier = (base: string, modifier: number): string =>
  modifier === 0 ? base : `${base} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}`;

export function crRow(cr: number, tables: Tables): { row: ChallengeRatingRow; next: ChallengeRatingRow | undefined } {
  const index = tables.challengeRatings.findIndex((row) => row.cr === cr);
  const row = tables.challengeRatings[index];
  if (!row) throw new Error(`CR ${cr} is not in the CR table`);
  return { row, next: tables.challengeRatings[index + 1] };
}

/** Floor of the average roll of dice such as `3d6`, before any modifier. */
export function diceAverage(dice: string): number {
  const match = /^(\d+)d(\d+)$/.exec(dice);
  if (!match) throw new Error(`Malformed dice "${dice}"`);
  const [count, sides] = [Number(match[1]), Number(match[2])];
  return Math.floor((count * (sides + 1)) / 2);
}

/** Average and display of one damage roll (SPEC.md §6.2). */
export function deriveDamage(
  dice: string,
  ability: Ability | undefined,
  bonus: number,
  mods: Record<Ability, number>,
): DerivedDamage {
  const modifier = (ability ? mods[ability] : 0) + bonus;
  const average = diceAverage(dice) + modifier;
  return { modifier, average, display: `${average} (${withModifier(dice, modifier)})` };
}

function deriveAction(action: Action, pb: number, mods: Record<Ability, number>): DerivedAction {
  const derived: DerivedAction = {
    damage: (action.damage ?? []).map((d: Damage) => deriveDamage(d.dice, d.ability, d.bonus ?? 0, mods)),
  };
  if (action.ability && action.kind !== 'other') {
    const base = pb + mods[action.ability] + (action.adjust ?? 0);
    if (action.kind === 'save') derived.saveDc = 8 + base;
    else derived.attackBonus = base;
  }
  return derived;
}

const allActions = (stats: CreatureStats): Action[] => [
  ...ACTION_LISTS.flatMap((list) => stats[list] ?? []),
  ...(stats.legendaryActions?.items ?? []),
];

/**
 * The XP of a CR 0 creature is 0 or 10 (Appendix A): 10 when any of its
 * traits or actions deals damage, else 0.
 */
function xpFor(row: ChallengeRatingRow, stats: CreatureStats): number {
  if (row.xpWithDamage !== undefined && allActions(stats).some((a) => (a.damage ?? []).length > 0)) {
    return row.xpWithDamage;
  }
  return row.xp;
}

export function deriveCreature(stats: CreatureStats, tables: Tables): DerivedCreature {
  const mods = Object.fromEntries(
    tables.abilities.map((ability) => [ability, abilityMod(stats.abilities[ability])]),
  ) as Record<Ability, number>;
  const { row, next } = crRow(stats.cr, tables);
  const pb = row.pb;

  const initiativeBonus =
    mods.dex + pb * proficiencyMultiplier(stats.initiative?.proficiency) + (stats.initiative?.adjust ?? 0);

  const firstSize = stats.size[0];
  if (!firstSize) throw new Error('size is empty');
  const die = tables.sizes[firstSize].hitDie;
  const hpModifier = stats.hitDice * mods.con;
  const hp = {
    die,
    modifier: hpModifier,
    formula: withModifier(`${stats.hitDice}d${die}`, hpModifier),
    average: Math.max(1, Math.floor((stats.hitDice * (die + 1)) / 2) + hpModifier),
  };

  const saveProficiencies = new Set(stats.saveProficiencies ?? []);
  const saves = Object.fromEntries(
    tables.abilities.map((ability) => [ability, mods[ability] + (saveProficiencies.has(ability) ? pb : 0)]),
  ) as Record<Ability, number>;

  const skills: Record<string, number> = {};
  for (const [skill, proficiency] of Object.entries(stats.skills ?? {})) {
    const ability = tables.skills[skill];
    if (!ability) throw new Error(`Unknown skill "${skill}"`);
    skills[skill] = mods[ability] + pb * proficiencyMultiplier(proficiency);
  }

  const derived: DerivedCreature = {
    abilityMods: mods,
    pb,
    xp: xpFor(row, stats),
    initiative: { bonus: initiativeBonus, score: 10 + initiativeBonus },
    hp,
    saves,
    skills,
    passivePerception: 10 + (skills.perception ?? mods.wis),
    traits: (stats.traits ?? []).map((a) => deriveAction(a, pb, mods)),
    actions: stats.actions.map((a) => deriveAction(a, pb, mods)),
    bonusActions: (stats.bonusActions ?? []).map((a) => deriveAction(a, pb, mods)),
    reactions: (stats.reactions ?? []).map((a) => deriveAction(a, pb, mods)),
    legendaryActions: { items: (stats.legendaryActions?.items ?? []).map((a) => deriveAction(a, pb, mods)) },
  };
  if (stats.lair && next) derived.xpInLair = next.xp;
  if (stats.spellcasting) {
    const base = pb + mods[stats.spellcasting.ability] + (stats.spellcasting.adjust ?? 0);
    derived.spellcasting = { dc: 8 + base, attackBonus: base };
  }
  return derived;
}
