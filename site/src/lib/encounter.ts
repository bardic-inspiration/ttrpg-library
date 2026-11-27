// The encounter page's difficulty section (docs/site.md#difficulty-calculator): the lines it shows
// without JavaScript, the encounter's XP and E, and the calculator island's props. It formats the
// derived values (docs/rulesets.md#encounter-difficulty); it never computes them.

import tables from '../../../rulesets/dnd-5e-2024/tables.json' with { type: 'json' };
import { DIFFICULTIES } from '../../../rulesets/dnd-5e-2024/difficulty.ts';
import type { Budget, DerivedEncounter, DifficultyResult, EncounterStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import type { DifficultyCalculatorProps, EncounterXp } from '../components/encounter/DifficultyCalculator.tsx';
import type { PropertyLine } from './template.ts';
import { name, sayText } from './wording.ts';

/** Whether an entry's page holds the difficulty calculator: an encounter's does. */
export const hasCalculator = (entry: { ruleset: string; type: string }): boolean => entry.ruleset === 'dnd-5e-2024' && entry.type === 'encounter';

const RESULTS: readonly DifficultyResult[] = [...DIFFICULTIES, 'beyond-high'];

/** Whole XP with thousands separators; the derived values aren't rounded. */
const whole = (xp: number): string => Math.round(xp).toLocaleString('en-US');

/** The section's lines without JavaScript: the encounter's XP, a span for a spawn table, and E with its note. */
export function difficultyLines(stats: EncounterStats, derived: DerivedEncounter): PropertyLine[] {
  const { min, max } = derived.xp;
  const xp = min === max ? sayText('encounter.xp', { xp: whole(min) }) : sayText('encounter.xpSpan', { min: whole(min), max: whole(max) });
  const multiplier = String(derived.multiplier);
  const note = stats.environment?.note;
  const environment = note ? sayText('encounter.multiplierWithNote', { multiplier, note }) : sayText('encounter.multiplier', { multiplier });
  return [
    { label: 'XP', value: xp },
    { label: 'Environment', value: environment },
  ];
}

/** The calculator's props: the budget table, the encounter's side, and the difficulties' names. */
export function calculatorProps(derived: DerivedEncounter): Omit<DifficultyCalculatorProps, 'level' | 'ready'> {
  const encounter: EncounterXp = derived.rows
    ? { kind: 'spawn-table', rows: DIFFICULTIES.flatMap((difficulty) => (derived.rows?.[difficulty] ? [{ difficulty, xp: derived.rows[difficulty] }] : [])) }
    : { kind: 'roster', xp: derived.xp.min };
  const labels = Object.fromEntries(RESULTS.map((r) => [r, name('difficulty', r)])) as Record<DifficultyResult, string>;
  return { budgets: tables.xpBudgetPerCharacter as Budget[], encounter, labels };
}
