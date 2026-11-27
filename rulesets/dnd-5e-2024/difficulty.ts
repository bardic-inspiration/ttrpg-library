// The party's side of encounter difficulty (docs/rulesets.md#encounter-difficulty): g(Party), the
// budgets, and what an encounter's XP reads against them. Kept apart from `encounters.ts`, with no
// imports but types, so the site's calculator island can use it without the ruleset's tables or checks.

import type { Budget, Difficulty, DifficultyResult, Tables } from './types.ts';

/** The rows of a table keyed by difficulty, in the order they read. */
export const DIFFICULTIES: readonly Difficulty[] = ['low', 'moderate', 'high'];

/** g(Party): the sum of each character's XP budget for their level, for each difficulty. */
export function partyBudget(levels: readonly number[], tables: Pick<Tables, 'xpBudgetPerCharacter'>): Budget {
  const budget: Budget = { low: 0, moderate: 0, high: 0 };
  for (const level of levels) {
    const row = tables.xpBudgetPerCharacter[level - 1];
    if (!row) throw new Error(`encounter: no XP budget for level ${level}`);
    for (const d of DIFFICULTIES) budget[d] += row[d];
  }
  return budget;
}

/** What XP reads against a party's budgets: Low at or under Low, then Moderate, High, or Beyond High. */
export function difficultyOf(xp: number, budget: Budget): DifficultyResult {
  return DIFFICULTIES.find((d) => xp <= budget[d]) ?? 'beyond-high';
}
