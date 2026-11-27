// Encounter checks a JSON schema can't express (docs/rulesets.md#encounters, docs/rulesets.md#consistency-checks).

import type { Issue } from '../module.ts';
import type { EncounterStats } from './types.ts';

const DICE = /^([1-9]\d*)d(\d+)([+-][1-9]\d*)?$/;

/** The least and most a dice expression rolls: "1d6+2" is 3 to 8. */
export function diceSpan(dice: string): { min: number; max: number } | undefined {
  const match = DICE.exec(dice);
  if (!match) return undefined;
  const [count, faces, modifier] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  return { min: count + modifier, max: count * faces + modifier };
}

/** A spawn table row's range, "1-2" or "6", as its least and most results. */
function rangeSpan(range: string): { min: number; max: number } {
  const [min, max = min] = range.split('-').map(Number) as [number, number?];
  return { min, max };
}

/**
 * Exactly one part is a roster or a spawn table. In a spawn table each difficulty is a row at most
 * once, a dice count never rolls below 1, and with a `roll` every row has a `range`, the ranges
 * covering each result of the roll once (without one, no row has a range). In a loot part each
 * difficulty is a row at most once. An environment multiplier is never 1, which changes nothing.
 */
export function checkEncounter(stats: EncounterStats): Issue[] {
  const issues: Issue[] = [];
  if (stats.environment?.multiplier === 1) {
    issues.push({ level: 'error', path: 'stats.environment.multiplier', message: 'a multiplier of 1 changes nothing; leave out `environment` for an E of 1' });
  }
  const creatures = stats.parts.flatMap((part, i) => (part.part === 'roster' || part.part === 'spawn-table' ? [{ part, i }] : []));
  if (creatures.length === 0) {
    issues.push({ level: 'error', path: 'stats.parts', message: 'an encounter has exactly one roster or spawn-table part; it has none' });
  }
  for (const { part, i } of creatures.slice(1)) {
    issues.push({ level: 'error', path: `stats.parts[${i}]`, message: `an encounter has exactly one roster or spawn-table part; parts[${creatures[0]!.i}] is its ${creatures[0]!.part.part}` });
  }
  stats.parts.forEach((part, i) => {
    const at = `stats.parts[${i}]`;
    if (part.part === 'spawn-table' || part.part === 'loot') issues.push(...uniqueDifficulties(part.rows, at));
    if (part.part !== 'spawn-table') return;
    part.rows.forEach((row, r) =>
      row.creatures.forEach((creature, c) => {
        const span = typeof creature.count === 'string' ? diceSpan(creature.count) : undefined;
        if (span && span.min < 1) {
          issues.push({ level: 'error', path: `${at}.rows[${r}].creatures[${c}].count`, message: `"${creature.count}" can roll ${span.min}; a count is 1 or more` });
        }
      }),
    );
    issues.push(...checkRanges(part.roll, part.rows, at));
  });
  return issues;
}

function uniqueDifficulties(rows: { difficulty: string }[], at: string): Issue[] {
  const seen = new Set<string>();
  return rows.flatMap((row, r) => {
    if (seen.has(row.difficulty)) return [{ level: 'error' as const, path: `${at}.rows[${r}].difficulty`, message: `"${row.difficulty}" is already a row; each difficulty is a row at most once` }];
    seen.add(row.difficulty);
    return [];
  });
}

/** With a roll, every row has a range, and the ranges cover each result of the roll once; without one, no row has a range. */
function checkRanges(roll: string | undefined, rows: { range?: string }[], at: string): Issue[] {
  if (roll === undefined) {
    return rows.flatMap((row, r) => (row.range === undefined ? [] : [{ level: 'error' as const, path: `${at}.rows[${r}].range`, message: 'a row has a range only when its table has a `roll`' }]));
  }
  const issues: Issue[] = [];
  const die = diceSpan(roll)!;
  const covered = new Map<number, number>();
  rows.forEach((row, r) => {
    const path = `${at}.rows[${r}].range`;
    if (row.range === undefined) {
      issues.push({ level: 'error', path: `${at}.rows[${r}]`, message: `a row of a table with a roll (${roll}) needs a range on it` });
      return;
    }
    const { min, max } = rangeSpan(row.range);
    if (min > max) {
      issues.push({ level: 'error', path, message: `"${row.range}" runs backward; write the lower result first` });
      return;
    }
    if (min < die.min || max > die.max) {
      issues.push({ level: 'error', path, message: `"${row.range}" is outside ${roll}'s results, ${die.min} to ${die.max}` });
      return;
    }
    for (let n = min; n <= max; n++) {
      if (covered.has(n)) issues.push({ level: 'error', path, message: `${n} is already rows[${covered.get(n)}]'s; each result chooses one row` });
      else covered.set(n, r);
    }
  });
  if (issues.length > 0) return issues;
  const missing: number[] = [];
  for (let n = die.min; n <= die.max; n++) if (!covered.has(n)) missing.push(n);
  if (missing.length > 0) issues.push({ level: 'error', path: `${at}.rows`, message: `no row's range covers ${missing.join(', ')} on ${roll}; every result chooses a row` });
  return issues;
}
