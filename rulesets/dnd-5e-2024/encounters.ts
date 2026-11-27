// Encounter checks a JSON schema can't express (docs/rulesets.md#encounters, docs/rulesets.md#consistency-checks).
// The kit parts' shapes are the schema's (docs/content-model.md#arrangements); refs, zones included,
// resolve by the ref check (docs/content-model.md#references).

import { Lexer } from 'marked';
import type { Issue } from '../module.ts';
import type { Difficulty, EncounterStats, SpawnRow } from './types.ts';

/** The rows of a table keyed by difficulty, in the order they read. */
export const DIFFICULTIES: readonly Difficulty[] = ['low', 'moderate', 'high'];

/** The lowest a dice count can roll: one per die, plus its modifier. */
export function lowestCount(count: number | string): number {
  if (typeof count === 'number') return count;
  const match = /^(\d+)d\d+([+-]\d+)?$/.exec(count);
  return match ? Number(match[1]) + Number(match[2] ?? 0) : Number.NaN;
}

/** An encounter has one roster or spawn table, a spawn table's ranges fit its roll, dice counts roll at least 1, and a table part holds one table. */
export function checkEncounter(stats: EncounterStats): Issue[] {
  const issues: Issue[] = [];
  const arranged = stats.parts.flatMap((p, i) => (p.part === 'roster' || p.part === 'spawn-table' ? [i] : []));
  if (arranged.length !== 1) {
    const found = arranged.length === 0 ? 'none' : `${arranged.length}, at ${arranged.map((i) => `stats.parts[${i}]`).join(', ')}`;
    issues.push({ level: 'error', path: 'stats.parts', message: `an encounter has exactly one roster or spawn-table part; found ${found}` });
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
