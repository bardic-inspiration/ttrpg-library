// Encounter checks a JSON schema can't express (docs/rulesets.md#encounters, docs/rulesets.md#consistency-checks).
// The kit parts' shapes are the schema's (docs/content-model.md#arrangements); refs, zones included,
// resolve by the ref check (docs/content-model.md#references). Difficulty (docs/rulesets.md#encounter-difficulty)
// is derived here: the encounter's XP from its creatures; a party's budgets are `difficulty.ts`'s.

import { Lexer } from 'marked';
import type { Issue, LinkedLibrary } from '../module.ts';
import { deriveCreature } from './derive.ts';
import { DIFFICULTIES } from './difficulty.ts';
import type { CreatureStats, DerivedEncounter, Difficulty, EncounterStats, SpawnRow, Tables, XpSpan } from './types.ts';

export { DIFFICULTIES, difficultyOf, partyBudget } from './difficulty.ts';

/** The lowest a dice count can roll: one per die, plus its modifier. */
export function lowestCount(count: number | string): number {
  if (typeof count === 'number') return count;
  const match = /^(\d+)d\d+([+-]\d+)?$/.exec(count);
  return match ? Number(match[1]) + Number(match[2] ?? 0) : Number.NaN;
}

/** A count's lowest, average, and highest roll; a fixed count is all three. */
export function countSpan(count: number | string): XpSpan {
  if (typeof count === 'number') return { min: count, average: count, max: count };
  const match = /^(\d+)d(\d+)([+-]\d+)?$/.exec(count);
  if (!match) throw new Error(`encounter: ${count} isn't a dice count`);
  const dice = Number(match[1]);
  const faces = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  return { min: dice + modifier, average: (dice * (faces + 1)) / 2 + modifier, max: dice * faces + modifier };
}

/** f(Roster) × E: each creature's XP by its CR times its count, summed, times the multiplier, as a span. */
function rosterXp(lines: { ref: string; count: number | string }[], multiplier: number, xpOf: (ref: string) => number): XpSpan {
  const sum = { min: 0, average: 0, max: 0 };
  for (const line of lines) {
    const xp = xpOf(line.ref);
    const span = countSpan(line.count);
    sum.min += xp * span.min;
    sum.average += xp * span.average;
    sum.max += xp * span.max;
  }
  return { min: sum.min * multiplier, average: sum.average * multiplier, max: sum.max * multiplier };
}

/**
 * The encounter's side of difficulty: E, and f(Roster) × E for its roster, or for each spawn table row
 * with the span of the rows. A creature's XP is the one its own derivation gives for its CR.
 */
export function deriveEncounterLinked(stats: EncounterStats, library: LinkedLibrary, tables: Tables): DerivedEncounter {
  const multiplier = stats.environment?.multiplier ?? 1;
  const xpOf = (ref: string) => {
    const found = library.resolve(ref);
    if (!found) throw new Error(`encounter: ${ref} doesn't resolve`);
    return deriveCreature(found.stats as CreatureStats, tables).xp;
  };
  const arranged = stats.parts.find((p) => p.part === 'roster' || p.part === 'spawn-table');
  if (arranged?.part === 'roster') {
    const { min, max } = rosterXp(arranged.creatures, multiplier, xpOf);
    return { multiplier, xp: { min, max } };
  }
  const rows: Partial<Record<Difficulty, XpSpan>> = {};
  if (arranged?.part === 'spawn-table') {
    for (const d of DIFFICULTIES) {
      const row = arranged.rows[d];
      if (row) rows[d] = rosterXp(row.creatures, multiplier, xpOf);
    }
  }
  const spans = Object.values(rows);
  const xp = spans.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...spans.map((s) => s.min)), max: Math.max(...spans.map((s) => s.max)) };
  return { multiplier, xp, rows };
}

/** An encounter has one roster or spawn table, a spawn table's ranges fit its roll, dice counts roll at least 1, a table part holds one table, and E isn't 1 (a warning otherwise). */
export function checkEncounter(stats: EncounterStats): Issue[] {
  const issues: Issue[] = [];
  const arranged = stats.parts.flatMap((p, i) => (p.part === 'roster' || p.part === 'spawn-table' ? [i] : []));
  if (arranged.length !== 1) {
    const found = arranged.length === 0 ? 'none' : `${arranged.length}, at ${arranged.map((i) => `stats.parts[${i}]`).join(', ')}`;
    issues.push({ level: 'error', path: 'stats.parts', message: `an encounter has exactly one roster or spawn-table part; found ${found}` });
  }
  if (stats.environment) {
    const { multiplier } = stats.environment;
    if (multiplier === 1) {
      issues.push({ level: 'error', path: 'stats.environment.multiplier', message: 'a multiplier of 1 changes nothing; leave `environment` out' });
    } else {
      issues.push({ level: 'warning', path: 'stats.environment.multiplier', message: `the environment multiplies the encounter's XP by ${multiplier}; confirm the deviation` });
    }
  }
  stats.parts.forEach((part, i) => {
    const at = `stats.parts[${i}]`;
    if (part.part === 'spawn-table') issues.push(...checkSpawnTable(at, part.roll, part.rows));
    if (part.part === 'table' && !isOneTable(part.text)) {
      issues.push({ level: 'error', path: `${at}.text`, message: 'a table part holds one pipe table and nothing else; its title is `title`' });
    }
  });
  return issues;
}

function checkSpawnTable(at: string, roll: string | undefined, rows: Partial<Record<Difficulty, SpawnRow>>): Issue[] {
  const issues: Issue[] = [];
  const present = DIFFICULTIES.filter((d) => rows[d]);
  for (const d of present) {
    rows[d]!.creatures.forEach((line, j) => {
      if (lowestCount(line.count) < 1) {
        issues.push({ level: 'error', path: `${at}.rows.${d}.creatures[${j}].count`, message: `${line.count} can roll ${lowestCount(line.count)}; a count is at least 1` });
      }
    });
  }
  if (roll === undefined) {
    for (const d of present) {
      if (rows[d]!.range) issues.push({ level: 'error', path: `${at}.rows.${d}.range`, message: 'a range needs the table\'s `roll`, the die it\'s on' });
    }
    return issues;
  }
  const faces = Number(roll.slice('1d'.length));
  const before = issues.length;
  const picks = new Map<number, Difficulty>();
  for (const d of present) {
    const range = rows[d]!.range;
    const path = `${at}.rows.${d}.range`;
    if (!range) {
      issues.push({ level: 'error', path: `${at}.rows.${d}`, message: `the table rolls ${roll}, so every row has a range on it` });
      continue;
    }
    if (range.min > range.max || range.max > faces) {
      issues.push({ level: 'error', path, message: `${range.min}–${range.max} isn't a range of faces on ${roll} (1–${faces})` });
      continue;
    }
    for (let face = range.min; face <= range.max; face++) {
      const taken = picks.get(face);
      if (taken) issues.push({ level: 'error', path, message: `${face} on ${roll} already picks the ${taken} row` });
      else picks.set(face, d);
    }
  }
  if (issues.length === before) {
    const missing = Array.from({ length: faces }, (_, f) => f + 1).filter((f) => !picks.has(f));
    if (missing.length > 0) issues.push({ level: 'error', path: `${at}.rows`, message: `no row's range covers ${missing.join(', ')} on ${roll}; the ranges cover every face` });
  }
  return issues;
}

/** Text that lexes to one pipe table, with nothing else around it. */
function isOneTable(text: string): boolean {
  const blocks = Lexer.lex(text).filter((t) => t.type !== 'space');
  return blocks.length === 1 && blocks[0]?.type === 'table';
}
