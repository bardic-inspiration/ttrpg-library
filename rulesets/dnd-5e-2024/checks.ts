// Consistency checks a JSON schema can't express (docs/rulesets.md#consistency-checks). They run
// after the schema stage, so `stats` already has the shape in types.ts.

import { deriveCreature } from './derive.ts';
import { findTokens, renderToken } from './tokens.ts';
import type { Action, BackgroundStats, CreatureStats, DerivedAction, DerivedCreature, FeatStats, ItemStats, SpellStats, Tables } from './types.ts';
import { ACTION_LISTS } from './types.ts';
import type { Issue } from '../module.ts';

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
      if (token.kind === 'atk' && derived.pb + derived.abilityMods[token.ability] + token.adjust > MAX_ATTACK_BONUS) {
        warning(path, `token ${match.raw} renders an attack bonus of ${renderToken(token, derived)}, above +${MAX_ATTACK_BONUS}`);
      }
      if (token.kind === 'dc' && 8 + derived.pb + derived.abilityMods[token.ability] + token.adjust > MAX_SAVE_DC) {
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
