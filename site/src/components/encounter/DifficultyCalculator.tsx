// The difficulty calculator (docs/site.md#difficulty-calculator), an island on the encounter page. The
// reader enters the party, each character's level, added and removed; it starts at four characters of
// level 1 and is kept in local storage (`site/src/lib/party.ts`), so it carries to the next encounter.
// It shows the party's three budgets, the encounter's XP, and the result: one line for a roster, or
// one row per spawn table row with its minimum, average, and maximum. It renders nothing until it
// mounts, so without JavaScript the page shows only the encounter's XP and E.
import { useEffect, useRef, useState } from 'preact/hooks';
import { DIFFICULTIES, difficultyOf, partyBudget } from '../../../../rulesets/dnd-5e-2024/difficulty.ts';
import type { Budget, Difficulty, DifficultyResult, XpSpan } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { MAX_LEVEL, onPartyChange, readParty, writeParty } from '../../lib/party.ts';
import Button from '../shared/Button.tsx';
import './calculator.css';

/** The encounter's side: a roster's XP, or each spawn table row's span, in difficulty order. */
export type EncounterXp = { kind: 'roster'; xp: number } | { kind: 'spawn-table'; rows: { difficulty: Difficulty; xp: XpSpan }[] };

export interface DifficultyCalculatorProps {
  /** The XP Budget per Character table, levels 1–20. */
  budgets: Budget[];
  encounter: EncounterXp;
  /** Each difficulty's display name, from the ruleset's vocabulary. */
  labels: Record<DifficultyResult, string>;
  /** The heading level of the calculator's own headings. */
  level?: 3 | 4;
  /** Set in tests: render as mounted, without waiting for the effect. */
  ready?: boolean;
}

/** XP as the page shows it: whole, with thousands separators. The comparison uses the unrounded value. */
export const formatXp = (xp: number): string => `${Math.round(xp).toLocaleString('en-US')} XP`;

const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

export default function DifficultyCalculator({ budgets, encounter, labels, level = 3, ready = false }: DifficultyCalculatorProps) {
  const [party, setParty] = useState<number[] | null>(ready ? readParty() : null);
  const root = useRef<HTMLDivElement>(null);
  // After an add or a remove, the level select to move focus to.
  const focusNext = useRef<number | null>(null);

  useEffect(() => {
    setParty(readParty());
    return onPartyChange(() => setParty(readParty()));
  }, []);

  useEffect(() => {
    if (focusNext.current === null) return;
    root.current?.querySelectorAll<HTMLSelectElement>('select')[focusNext.current]?.focus();
    focusNext.current = null;
  }, [party]);

  if (!party) return null;

  const Heading = `h${level}` as 'h3' | 'h4';
  const budget = partyBudget(party, { xpBudgetPerCharacter: budgets });
  const reads = (xp: number) => labels[difficultyOf(xp, budget)];
  const change = (next: number[], focus: number | null) => {
    focusNext.current = focus;
    writeParty(next);
  };

  return (
    <div class="calculator" ref={root}>
      <section class="calculator__party" aria-labelledby="calculator-party">
        <Heading id="calculator-party">Your party</Heading>
        <ol class="calculator__characters">
          {party.map((characterLevel, i) => (
            <li key={i} class="calculator__character">
              <label for={`calculator-level-${i}`}>Character {i + 1}</label>
              <select
                id={`calculator-level-${i}`}
                value={String(characterLevel)}
                onChange={(e) => change(party.map((l, j) => (j === i ? Number((e.currentTarget as HTMLSelectElement).value) : l)), null)}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={String(l)}>
                    Level {l}
                  </option>
                ))}
              </select>
              <Button
                disabled={party.length === 1}
                onClick={() => change(party.filter((_, j) => j !== i), Math.min(i, party.length - 2))}
              >
                Remove<span class="visually-hidden"> character {i + 1}</span>
              </Button>
            </li>
          ))}
        </ol>
        <Button onClick={() => change([...party, party[party.length - 1] ?? 1], party.length)}>Add character</Button>
      </section>

      <section aria-labelledby="calculator-budgets">
        <Heading id="calculator-budgets">Budgets</Heading>
        <dl class="calculator__budgets">
          {DIFFICULTIES.map((d) => (
            <div key={d}>
              <dt>{labels[d]}</dt>
              <dd>{formatXp(budget[d])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="calculator-result">
        <Heading id="calculator-result">For your party</Heading>
        <div aria-live="polite">
          {encounter.kind === 'roster' ? (
            <p class="calculator__line">
              {formatXp(encounter.xp)}: <strong>{reads(encounter.xp)}</strong>
            </p>
          ) : (
            <div class="md-table">
              <table class="calculator__rows">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Minimum</th>
                    <th scope="col">Average</th>
                    <th scope="col">Maximum</th>
                  </tr>
                </thead>
                <tbody>
                  {encounter.rows.map((row) => (
                    <tr key={row.difficulty}>
                      <th scope="row">{labels[row.difficulty]}</th>
                      {(['min', 'average', 'max'] as const).map((at) => (
                        <td key={at}>
                          {formatXp(row.xp[at])}: <strong>{reads(row.xp[at])}</strong>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
