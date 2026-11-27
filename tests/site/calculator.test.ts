// @vitest-environment happy-dom
// The difficulty calculator (docs/site.md#difficulty-calculator): the party starts at four level 1
// characters, is added to and removed from by keyboard, and is kept in local storage so it carries
// to the next encounter, or lasts for the page with storage blocked. It gives the spec's cases: the
// SRD budget examples, a mixed party, and a spawn table's rows. Without JavaScript the page shows XP and E.
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DifficultyCalculator from '../../site/src/components/encounter/DifficultyCalculator.tsx';
import { calculatorProps, difficultyLines, hasCalculator } from '../../site/src/lib/encounter.ts';
import { DEFAULT_PARTY, PARTY_STORAGE_KEY, readParty, resetPageParty, writeParty, type PartyStore } from '../../site/src/lib/party.ts';
import type { DerivedEncounter, EncounterStats } from '../../rulesets/dnd-5e-2024/types.ts';

// The encounters' derived values, as tests/rulesets/dnd-5e-2024/encounters.test.ts derives them.
const BUGBEAR: DerivedEncounter = { multiplier: 1, xp: { min: 200, max: 200 } };
const GROVE: DerivedEncounter = { multiplier: 1, xp: { min: 1125, max: 1125 } };
const COURT: DerivedEncounter = { multiplier: 1.25, xp: { min: 1875, max: 1875 } };
const AMBUSH: DerivedEncounter = {
  multiplier: 1,
  xp: { min: 75, max: 675 },
  rows: {
    low: { min: 75, average: 112.5, max: 150 },
    moderate: { min: 75, average: 150, max: 225 },
    high: { min: 550, average: 612.5, max: 675 },
  },
};
const NO_ENVIRONMENT: EncounterStats = { parts: [] };
const COURT_STATS: EncounterStats = { parts: [], environment: { multiplier: 1.25, note: 'Waist-deep water' } };

/** A store that throws on every read and write, as blocked storage does. */
const blocked: PartyStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
};

let root: HTMLElement;
beforeEach(() => {
  resetPageParty();
  window.localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  render(null, root);
  root.remove();
  vi.restoreAllMocks();
});

const mount = async (derived: DerivedEncounter) => {
  await act(() => render(h(DifficultyCalculator, calculatorProps(derived)), root));
};
const text = (selector: string) => root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const budgets = () => [...root.querySelectorAll('.calculator__budgets > div')].map((d) => `${d.querySelector('dt')?.textContent} ${d.querySelector('dd')?.textContent}`).join(', ');
const levels = () => [...root.querySelectorAll('select')].map((s) => Number(s.value));
const button = (name: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === name)!;
const choose = async (index: number, level: number) => {
  const select = root.querySelectorAll('select')[index]!;
  select.value = String(level);
  await act(() => void select.dispatchEvent(new Event('change', { bubbles: true })));
};
const press = async (name: string) => {
  await act(() => button(name).click());
};

describe('the party', () => {
  it('starts at four characters of level 1', () => {
    expect(readParty()).toEqual([1, 1, 1, 1]);
    expect(DEFAULT_PARTY).toEqual([1, 1, 1, 1]);
  });

  it('is kept in local storage', () => {
    writeParty([2, 3, 5]);
    expect(JSON.parse(window.localStorage.getItem(PARTY_STORAGE_KEY)!)).toEqual([2, 3, 5]);
    resetPageParty();
    expect(readParty()).toEqual([2, 3, 5]);
  });

  it('drops a stored value that isn\'t a level, and reads an empty or unreadable party as the default', () => {
    window.localStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify([3, 0, 21, 2.5, '4', 7]));
    expect(readParty()).toEqual([3, 7]);
    window.localStorage.setItem(PARTY_STORAGE_KEY, '[]');
    expect(readParty()).toEqual([1, 1, 1, 1]);
    window.localStorage.setItem(PARTY_STORAGE_KEY, '{');
    expect(readParty()).toEqual([1, 1, 1, 1]);
  });

  it('keeps at least one character', () => {
    expect(writeParty([])).toEqual([1, 1, 1, 1]);
  });

  it('lasts only for the page when storage is blocked', () => {
    expect(readParty(blocked)).toEqual([1, 1, 1, 1]);
    writeParty([4, 4], blocked);
    expect(readParty(blocked)).toEqual([4, 4]);
  });
});

describe('the calculator', () => {
  it('renders nothing until it mounts, so the page without JavaScript shows only XP and E', () => {
    expect(renderToString(h(DifficultyCalculator, calculatorProps(BUGBEAR)))).toBe('');
  });

  it('gives the SRD examples: a lone bugbear warrior is Low for four level 1 characters', async () => {
    await mount(BUGBEAR);
    expect(levels()).toEqual([1, 1, 1, 1]);
    expect(budgets()).toBe('Low 200 XP, Moderate 300 XP, High 400 XP');
    expect(text('.calculator__line')).toBe('200 XP: Low');
  });

  it('and two druids and nine stirges are Moderate for five level 3 characters', async () => {
    writeParty([3, 3, 3, 3, 3]);
    await mount(GROVE);
    expect(budgets()).toBe('Low 750 XP, Moderate 1,125 XP, High 2,000 XP');
    expect(text('.calculator__line')).toBe('1,125 XP: Moderate');
  });

  it("sums a mixed party's budgets per character", async () => {
    writeParty([2, 3, 5]);
    await mount(COURT);
    expect(budgets()).toBe('Low 750 XP, Moderate 1,125 XP, High 1,700 XP');
    expect(text('.calculator__line')).toBe('1,875 XP: Beyond High');
  });

  it("gives a spawn table's rows, each with its minimum, average, and maximum", async () => {
    await mount(AMBUSH);
    const rows = [...root.querySelectorAll('.calculator__rows tr')].map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      'RowMinimumAverageMaximum',
      'Low75 XP: Low113 XP: Low150 XP: Low',
      'Moderate75 XP: Low150 XP: Low225 XP: Moderate',
      'High550 XP: Beyond High613 XP: Beyond High675 XP: Beyond High',
    ]);
  });

  it('compares unrounded XP: 112.5 XP is Moderate against a Low budget of 112', async () => {
    const { encounter, labels } = calculatorProps(AMBUSH);
    const budgets = calculatorProps(AMBUSH).budgets.map(() => ({ low: 28, moderate: 1000, high: 2000 }));
    await act(() => render(h(DifficultyCalculator, { budgets, encounter, labels }), root));
    expect(root.querySelectorAll('.calculator__rows tbody tr')[0]?.textContent).toContain('113 XP: Moderate');
  });

  it('changes a level, adds a character at the last one\'s level, and removes one, updating the result', async () => {
    await mount(BUGBEAR);
    await choose(0, 3);
    expect(levels()).toEqual([3, 1, 1, 1]);
    expect(budgets()).toBe('Low 300 XP, Moderate 450 XP, High 700 XP');
    await choose(3, 2);
    await press('Add character');
    expect(levels()).toEqual([3, 1, 1, 2, 2]);
    await press('Remove character 2');
    expect(levels()).toEqual([3, 1, 2, 2]);
    expect(readParty()).toEqual([3, 1, 2, 2]);
  });

  it("can't remove the last character", async () => {
    writeParty([5]);
    await mount(BUGBEAR);
    expect(button('Remove character 1').disabled).toBe(true);
  });

  it('works by keyboard: native controls in order, each labeled, and focus kept on the party after an add or a remove', async () => {
    await mount(BUGBEAR);
    const controls = [...root.querySelectorAll('select, button')];
    expect(controls.map((c) => c.tagName)).toEqual(['SELECT', 'BUTTON', 'SELECT', 'BUTTON', 'SELECT', 'BUTTON', 'SELECT', 'BUTTON', 'BUTTON']);
    expect(controls.every((c) => !c.hasAttribute('tabindex'))).toBe(true);
    for (const select of root.querySelectorAll('select')) expect(root.querySelector(`label[for="${select.id}"]`)?.textContent).toMatch(/^Character \d$/);
    await press('Add character');
    expect(document.activeElement).toBe(root.querySelectorAll('select')[4]);
    await press('Remove character 5');
    expect(document.activeElement).toBe(root.querySelectorAll('select')[3]);
    await press('Remove character 1');
    expect(document.activeElement).toBe(root.querySelectorAll('select')[0]);
  });

  it('announces the result politely as the party changes', async () => {
    await mount(BUGBEAR);
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toContain('200 XP: Low');
  });

  it('carries the party to the next encounter, and follows a change from another tab', async () => {
    await mount(BUGBEAR);
    await choose(1, 4);
    render(null, root);
    resetPageParty();
    await mount(GROVE);
    expect(levels()).toEqual([1, 4, 1, 1]);
    window.localStorage.setItem(PARTY_STORAGE_KEY, '[6]');
    await act(() => void window.dispatchEvent(new StorageEvent('storage', { key: PARTY_STORAGE_KEY })));
    expect(levels()).toEqual([6]);
  });

  it('works for the page with storage blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    await mount(BUGBEAR);
    expect(levels()).toEqual([1, 1, 1, 1]);
    await press('Add character');
    expect(levels()).toEqual([1, 1, 1, 1, 1]);
    expect(text('.calculator__line')).toBe('200 XP: Low');
  });
});

describe('the Difficulty section without JavaScript', () => {
  it('is on an encounter page only', () => {
    expect(hasCalculator({ ruleset: 'dnd-5e-2024', type: 'encounter' })).toBe(true);
    expect(hasCalculator({ ruleset: 'dnd-5e-2024', type: 'creature' })).toBe(false);
    expect(hasCalculator({ ruleset: 'elementals', type: 'encounter' })).toBe(false);
  });

  it("shows a roster's XP and E, with E's note", () => {
    expect(difficultyLines(COURT_STATS, COURT)).toEqual([
      { label: 'XP', value: '1,875 XP' },
      { label: 'Environment', value: '×1.25 (Waist-deep water)' },
    ]);
    expect(difficultyLines(NO_ENVIRONMENT, GROVE)).toEqual([
      { label: 'XP', value: '1,125 XP' },
      { label: 'Environment', value: '×1' },
    ]);
  });

  it("shows a spawn table's XP as the span of its rows", () => {
    expect(difficultyLines(NO_ENVIRONMENT, AMBUSH)[0]).toEqual({ label: 'XP', value: '75 to 675 XP' });
  });
});
