// Consistency checks a JSON schema can't express (SPEC.md §6.8). They run
// after the schema stage, so `stats` already has the shape in types.ts.

import { deriveCreature } from './derive.ts';
import { findTokens, renderToken } from './tokens.ts';
import type { Action, CreatureStats, DerivedAction, DerivedCreature, Tables } from './types.ts';
import { ACTION_LISTS } from './types.ts';
import type { Issue } from '../module.ts';

const MAX_ATTACK_BONUS = 17;
const MAX_SAVE_DC = 30;

/** Literal numbers in creature prose that look derived, and the token to use instead (§6.4). */
const LITERALS: { pattern: RegExp; token: string }[] = [
  { pattern: /\bDC\s*\d+/i, token: '{dc:<ability>}' },
  { pattern: /\+\s*\d+\s+to\s+hit\b/i, token: '{atk:<ability>}' },
  { pattern: /\b\d+\s*\(\s*\d+\s*d\s*\d+(\s*[-+−–]\s*\d+)?\s*\)/i, token: '{dmg:<dice>}' },
];

const PROSE_FIELDS = ['text', 'onHit', 'onFailure', 'onSuccess'] as const;

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
