// dnd-5e-2024 encounters (docs/rulesets.md#encounters), the kit (docs/content-model.md#the-kit), and
// inventory refs (docs/content-model.md#refs-in-arrangements): the spec's bandit attack and boss fight
// validate, a malformed part, roster, or spawn table fails, and a part's refs read "Appears in".
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import { diceSpan } from '../../../rulesets/dnd-5e-2024/encounters.ts';
import type { EncounterStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { FIXTURES, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const ENCOUNTERS = join(FIXTURES, 'encounter');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
const jsonIn = async (path: string) => Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f))));

/** The encounter fixtures (with the lookout they add), the valid map fixtures, and the whole library, which has no encounters or maps of its own. */
const loadAll = async () => [
  ...(await jsonIn(ENCOUNTERS)),
  ...(await jsonIn(MAPS)).filter((e) => e.id !== 'broken-weir'),
  ...(await Promise.all((await readdir(CONTENT)).filter((t) => t !== 'encounter' && t !== 'map').map((t) => jsonIn(join(CONTENT, t))))).flat(),
];
let library: ReturnType<typeof loadAll> | undefined;
const all = async () => structuredClone(await (library ??= loadAll()));

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Validating the whole library takes a few seconds; Vitest's 5 s default is too tight. */
const VALIDATION_TIMEOUT = 30_000;

/** Validates the library with the fixtures, after `change` edits the entries; returns the encounters' errors and the result. */
async function validate(change: (entries: Record<string, any>[]) => void = () => {}) {
  const entries = await all();
  change(entries);
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const images = join(lib.repo, 'assets/images/dnd-5e-2024/map');
  await mkdir(images, { recursive: true });
  for (const svg of (await readdir(MAPS)).filter((f) => f.endsWith('.svg'))) await copyFile(join(MAPS, svg), join(images, svg));
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  return { errors: result.errors.map((e) => `${e.file}: ${e.message}`), result };
}

const encounter = (entries: Record<string, any>[], id: string) => entries.find((e) => e.type === 'encounter' && e.id === id)!;
const BANDIT = 'content/dnd-5e-2024/encounter/bandit-attack.json';
const THRONE = 'content/dnd-5e-2024/encounter/warren-throne.json';

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the bandit attack, with its spawn table and loot, and the boss fight set in a zone of a dungeon map', async () => {
    const { errors, result } = await validate();
    expect(errors).toEqual([]);
    expect(result.warnings.filter((w) => w.file.includes('/encounter/'))).toEqual([]);
    const throne = result.entries.find((e) => e.entry.type === 'encounter' && e.entry.id === 'warren-throne')!;
    expect(throne.refs).toEqual(
      expect.arrayContaining([
        { path: 'stats.parts[1].map', key: 'map/sunken-cistern', zone: 'drowned-shrine' },
        { path: 'stats.parts[2].creatures[0]', key: 'creature/goblin-warren-king' },
        { path: 'stats.setIn', key: 'map/sunken-cistern', zone: 'drowned-shrine' },
      ]),
    );
    // The bandit attack's custom lookout is named in a part's text and in its spawn table.
    const lookout = result.entries.find((e) => e.entry.type === 'creature' && e.entry.id === 'bandit-lookout')!;
    expect(lookout.refBy.map((l) => l.path)).toEqual(['stats.parts[1].text', 'stats.parts[2].rows[0].creatures[1]', 'stats.parts[2].rows[1].creatures[1]', 'stats.parts[2].rows[2].creatures[2]']);
  });

  it('fails an encounter with no roster or spawn table, or with two', async () => {
    const { errors } = await validate((entries) => {
      encounter(entries, 'bandit-attack').stats.parts.splice(2, 1);
      const throne = encounter(entries, 'warren-throne');
      throne.stats.parts.push(structuredClone(throne.stats.parts[2]));
    });
    expect(errors).toEqual([
      `${BANDIT}: stats.parts: an encounter has exactly one roster or spawn-table part; it has none`,
      `${THRONE}: stats.parts[5]: an encounter has exactly one roster or spawn-table part; parts[2] is its roster`,
    ]);
  });

  it('fails a malformed part: an unknown part, a missing field, a structured sequence mixed with an example, and a bad show', async () => {
    const { errors } = await validate((entries) => {
      const parts = encounter(entries, 'warren-throne').stats.parts;
      parts.push({ part: 'epilogue', text: 'After.' });
      delete parts[4].title;
      parts[3].example = 'It might go like this.';
      parts[2].creatures[1].show = 'portrait';
    });
    expect(errors).toEqual([
      `${THRONE}: stats.parts[2].creatures[1].show: must be one of "link", "card", "thumbnail"`,
      `${THRONE}: stats.parts[3].trigger: not allowed here`,
      `${THRONE}: stats.parts[3].stages: not allowed here`,
      `${THRONE}: stats.parts[3].victory: not allowed here`,
      `${THRONE}: stats.parts[4]: missing required key "title"`,
      `${THRONE}: stats.parts[5].part: must be one of "prose", "description", "dm-guide", "roster", "spawn-table", "sequence", "table", "loot", "map"`,
    ]);
  });

  it('fails a malformed roster: a character in it, or a count of 0', async () => {
    const { errors } = await validate((entries) => {
      const creatures = encounter(entries, 'warren-throne').stats.parts[2].creatures;
      creatures[1].ref = 'character/brannoc-ashguard';
      creatures[2].count = 0;
    });
    expect(errors).toEqual([
      `${THRONE}: stats.parts[2].creatures[1].ref: must match pattern "^creature/[a-z0-9]+(-[a-z0-9]+)*$"`,
      `${THRONE}: stats.parts[2].creatures[2].count: must be >= 1`,
    ]);
  });

  it('fails a malformed spawn table on each fault', async () => {
    const { errors } = await validate((entries) => {
      const table = encounter(entries, 'bandit-attack').stats.parts[2];
      table.rows[1].difficulty = 'low';
      table.rows[0].creatures[0].count = '1d4-1';
      table.rows[2].range = '5-6';
      delete table.rows[0].range;
    });
    expect(errors).toEqual([
      `${BANDIT}: stats.parts[2].rows[1].difficulty: "low" is already a row; each difficulty is a row at most once`,
      `${BANDIT}: stats.parts[2].rows[0].creatures[0].count: "1d4-1" can roll 0; a count is 1 or more`,
      `${BANDIT}: stats.parts[2].rows[0]: a row of a table with a roll (1d6) needs a range on it`,
      `${BANDIT}: stats.parts[2].rows[2].range: 5 is already rows[1]'s; each result chooses one row`,
    ]);
  });

  it('fails a zone the setIn map lacks, and a loot row repeated', async () => {
    const { errors } = await validate((entries) => {
      const throne = encounter(entries, 'warren-throne');
      throne.stats.setIn.zone = 'gatehouse';
      const loot = encounter(entries, 'bandit-attack').stats.parts[4];
      loot.rows[2].difficulty = 'moderate';
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        `${BANDIT}: stats.parts[4].rows[2].difficulty: "moderate" is already a row; each difficulty is a row at most once`,
        expect.stringMatching(/^content\/dnd-5e-2024\/encounter\/warren-throne\.json: .*ref "map\/sunken-cistern#gatehouse" does not resolve/),
      ]),
    );
  });

  it('fails an environment multiplier of 1, or at or below 0', async () => {
    const { errors } = await validate((entries) => {
      encounter(entries, 'warren-throne').stats.environment.multiplier = 1;
      encounter(entries, 'bandit-attack').stats.environment = { multiplier: 0, note: 'None.' };
    });
    expect(errors).toEqual([
      `${BANDIT}: stats.environment.multiplier: must be > 0`,
      `${THRONE}: stats.environment.multiplier: a multiplier of 1 changes nothing; leave out \`environment\` for an E of 1`,
    ]);
  });
});

describe('the encounter check', () => {
  const table = (roll: string | undefined, ranges: (string | undefined)[]): EncounterStats => ({
    parts: [{ part: 'spawn-table', ...(roll ? { roll } : {}), rows: ranges.map((range, i) => ({ difficulty: (['low', 'moderate', 'high'] as const)[i]!, ...(range ? { range } : {}), creatures: [{ ref: 'creature/bandit', count: 1 }] })) }],
  });
  const messages = (stats: EncounterStats) => ruleset.check('encounter', stats).map((i) => `${i.path}: ${i.message}`);

  it('passes ranges that cover the roll once, and a table with no roll and no ranges', () => {
    expect(messages(table('1d6', ['1-2', '3-5', '6']))).toEqual([]);
    expect(messages(table('2d6', ['2-6', '7-9', '10-12']))).toEqual([]);
    expect(messages(table(undefined, [undefined, undefined]))).toEqual([]);
  });

  it('fails a gap, a range outside the roll, a backward range, and a range with no roll', () => {
    expect(messages(table('1d6', ['1-2', '3-4', '6']))).toEqual(['stats.parts[0].rows: no row\'s range covers 5 on 1d6; every result chooses a row']);
    expect(messages(table('1d6', ['1-2', '3-5', '6-7']))).toEqual(['stats.parts[0].rows[2].range: "6-7" is outside 1d6\'s results, 1 to 6']);
    expect(messages(table('1d6', ['2-1', '3-5', '6']))).toEqual(['stats.parts[0].rows[0].range: "2-1" runs backward; write the lower result first']);
    expect(messages(table(undefined, ['1-2']))).toEqual(['stats.parts[0].rows[0].range: a row has a range only when its table has a `roll`']);
  });

  it('reads a dice count\'s least and most', () => {
    expect(diceSpan('1d6+2')).toEqual({ min: 3, max: 8 });
    expect(diceSpan('2d4')).toEqual({ min: 2, max: 8 });
    expect(diceSpan('1d4-1')).toEqual({ min: 0, max: 3 });
  });
});

describe('ref labels', () => {
  it('labels a ref in a part as inventory, apart from rules refs, and the setting as "Set in"', () => {
    expect(ruleset.refLabels('encounter', 'stats.parts[2].creatures[0]')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(ruleset.refLabels('encounter', 'stats.parts[1].text')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(ruleset.refLabels('encounter', 'stats.setIn')).toEqual({ forward: 'Set in', back: 'Encounters' });
    expect(ruleset.refLabels('creature', 'stats.gear[0]').back).not.toBe('Appears in');
  });
});
