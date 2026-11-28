// dnd-5e-2024 encounters (docs/rulesets.md#encounters), built of the kit's parts
// (docs/content-model.md#arrangements): the spec's bandit attack, boss fight, and SRD budget rosters validate,
// and a malformed part, roster, or spawn table fails. Refs in parts are inventory, labeled apart from rules refs.
// Difficulty (docs/rulesets.md#encounter-difficulty) gives the spec's budget examples and mixed party.
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import Gallery from '../../../site/src/components/gallery/Gallery.tsx';
import { galleryConfig, type LibraryRecord, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { computeView } from '../../../site/src/lib/gallery/view.ts';
import registryJson from '../../../config/types.json' with { type: 'json' };
import { ruleset, tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { countSpan, lowestCount } from '../../../rulesets/dnd-5e-2024/encounters.ts';
import { difficultyOf, partyBudget } from '../../../rulesets/dnd-5e-2024/difficulty.ts';
import { linkedLibrary, type LinkedEntry } from '../../../rulesets/module.ts';
import { FIXTURES, libraryWithout, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const ENCOUNTERS = join(FIXTURES, 'encounter');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
const jsonIn = async (path: string) => Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f))));

/**
 * The encounter fixtures (with the custom creature the bandit attack adds), the valid map fixtures,
 * and the library minus its encounters and maps, and the entries that link to them.
 */
const loadAll = async () => {
  const fixtures = [...(await jsonIn(ENCOUNTERS)), ...(await jsonIn(MAPS)).filter((m) => m.id !== 'broken-weir')];
  return [...fixtures, ...(await libraryWithout(['encounter', 'map'], fixtures))];
};
let library: ReturnType<typeof loadAll> | undefined;
const all = async () => structuredClone(await (library ??= loadAll()));

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Validating the whole library takes a few seconds; Vitest's 5 s default is too tight. */
const VALIDATION_TIMEOUT = 30_000;

/** The library with the fixtures in a temporary repo, the map fixtures' diagrams beside it. */
async function fixtureLibrary(entries: Record<string, any>[]) {
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const images = join(lib.repo, 'assets/images/dnd-5e-2024/map');
  await mkdir(images, { recursive: true });
  for (const svg of (await readdir(MAPS)).filter((f) => f.endsWith('.svg') && f !== 'broken-weir.svg')) await copyFile(join(MAPS, svg), join(images, svg));
  return lib;
}

/** Validates the library with the fixtures, after `change` edits the entries. */
async function validate(change: (entries: Record<string, any>[]) => void = () => {}) {
  const entries = await all();
  change(entries);
  const lib = await fixtureLibrary(entries);
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  const ofEncounters = (issues: { file: string; message: string }[]) => issues.filter((i) => i.file.includes('/encounter/')).map((i) => `${i.file.replace(/^.*\/encounter\//, '')}: ${i.message}`);
  return { errors: result.errors.map((e) => `${e.file}: ${e.message}`), encounterErrors: ofEncounters(result.errors), result };
}

const encounter = (entries: Record<string, any>[], id: string) => entries.find((e) => e.type === 'encounter' && e.id === id)!;
const part = (entries: Record<string, any>[], id: string, kind: string) => encounter(entries, id).stats.parts.find((p: { part: string }) => p.part === kind);

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the bandit attack, the boss fight in a zone of a dungeon, and the SRD budget rosters', async () => {
    const { errors, result } = await validate();
    expect(errors).toEqual([]);
    const ids = result.entries.filter((e) => e.entry.type === 'encounter').map((e) => e.entry.id).sort();
    expect(ids).toEqual(['bandit-ambush', 'bugbear-warrior-alone', 'druids-and-stirges', 'warren-kings-court']);
  });

  it("links a part's refs and text tokens, and setIn names the map's zone on both ends", async () => {
    const { result } = await validate();
    const court = result.entries.find((e) => e.entry.type === 'encounter' && e.entry.id === 'warren-kings-court')!;
    expect(court.refs).toEqual(
      expect.arrayContaining([
        { path: 'stats.setIn', key: 'map/sunken-cistern', zone: 'drowned-shrine' },
        { path: 'stats.parts[0].map', key: 'map/sunken-cistern', zone: 'drowned-shrine' },
        { path: 'stats.parts[2].creatures[0]', key: 'creature/goblin-warren-king' },
        { path: 'stats.parts[4].text', key: 'item/potion-of-climbing' },
      ]),
    );
    const cistern = result.entries.find((e) => e.entry.type === 'map' && e.entry.id === 'sunken-cistern')!;
    expect(cistern.refBy).toEqual(expect.arrayContaining([{ path: 'stats.setIn', key: 'encounter/warren-kings-court', zone: 'drowned-shrine' }]));
    const ambush = result.entries.find((e) => e.entry.type === 'encounter' && e.entry.id === 'bandit-ambush')!;
    expect(ambush.refs).toEqual(
      expect.arrayContaining([
        { path: 'stats.parts[2].rows.high.creatures[0]', key: 'creature/bandit-captain' },
        { path: 'stats.parts[4].rows.high.items[1]', key: 'item/potion-of-climbing' },
        { path: 'stats.parts[4].rows.moderate.items[0]', key: 'equipment/manacles' },
      ]),
    );
  });

  it('fails an encounter with no roster or spawn table, or with two', async () => {
    const { encounterErrors } = await validate((entries) => {
      const ambush = encounter(entries, 'bandit-ambush');
      ambush.stats.parts = ambush.stats.parts.filter((p: { part: string }) => p.part !== 'spawn-table');
      const court = encounter(entries, 'warren-kings-court');
      court.stats.parts.push({ part: 'roster', creatures: [{ ref: 'creature/goblin-boss', count: 2 }] });
    });
    expect(encounterErrors).toEqual(
      expect.arrayContaining([
        'bandit-ambush.json: stats.parts: an encounter has exactly one roster or spawn-table part; found none',
        'warren-kings-court.json: stats.parts: an encounter has exactly one roster or spawn-table part; found 2, at stats.parts[2], stats.parts[5]',
      ]),
    );
  });

  it('fails a malformed part: an unknown kind, a missing or unknown key, and a module part', async () => {
    const { encounterErrors } = await validate((entries) => {
      const parts = encounter(entries, 'warren-kings-court').stats.parts;
      parts.push({ part: 'epilogue', text: 'And then?' });
      parts.push({ part: 'prose', title: 'Aftermath' });
      parts.push({ part: 'dm-guide', text: 'Run it.', title: 'How' });
      parts.push({ part: 'sequence', trigger: 'Go.', example: 'Both forms.' });
      parts.push({ part: 'map', map: { ref: 'creature/goblin-boss' } });
      parts.push({ part: 'loot', rows: { deadly: { coins: { dice: '2d6', unit: 'gp' } } } });
      parts.push({ part: 'loot', rows: { low: {} } });
      parts.push({ part: 'sequence', victory: 'Win.' });
    });
    const at = (i: number) => `warren-kings-court.json: stats.parts[${i}]`;
    expect(encounterErrors).toEqual(
      expect.arrayContaining([
        `${at(5)}.part: must be one of "prose", "description", "dm-guide", "roster", "spawn-table", "sequence", "table", "loot", "map"`,
        `${at(6)}: missing required key "text"`,
        `${at(7)}.title: unknown key`,
        `${at(8)}.trigger: not allowed here`,
        `${at(9)}.map.ref: must match pattern "^map/[a-z0-9]+(-[a-z0-9]+)*$"`,
        `${at(10)}.rows.deadly: unknown key`,
        `${at(11)}.rows.low: must match a schema in anyOf`,
        `${at(12)}: must match exactly one schema in oneOf`,
      ]),
    );
  });

  it('fails a table part that holds more than a table', async () => {
    const { encounterErrors } = await validate((entries) => {
      part(entries, 'warren-kings-court', 'table').text = 'The king keeps it all in a crate.\n\n| d4 | Treasure |\n|---|---|\n| 1 | A sack of 300 CP |';
    });
    expect(encounterErrors).toEqual(['warren-kings-court.json: stats.parts[4].text: a table part holds one pipe table and nothing else; its title is `title`']);
  });

  it("fails a malformed roster: no count, a count of 0, dice, a creature that isn't, and one not in the library", async () => {
    const { encounterErrors } = await validate((entries) => {
      const creatures = part(entries, 'warren-kings-court', 'roster').creatures;
      delete creatures[0].count;
      creatures[1].count = 0;
      creatures[2].count = '1d4';
      creatures.push({ ref: 'item/potion-of-climbing', count: 1 }, { ref: 'creature/goblin-emperor', count: 1 }, { ref: 'creature/goblin-boss', count: 1, show: 'portrait' });
    });
    const at = 'warren-kings-court.json: stats.parts[2].creatures';
    expect(encounterErrors).toEqual(
      expect.arrayContaining([
        `${at}[0]: missing required key "count"`,
        `${at}[1].count: must be >= 1`,
        `${at}[2].count: must be integer`,
        `${at}[3].ref: must match pattern "^creature/[a-z0-9]+(-[a-z0-9]+)*$"`,
        `${at}[5].show: must be one of "link", "card", "thumbnail"`,
      ]),
    );
    const { encounterErrors: unresolved } = await validate((entries) => {
      part(entries, 'warren-kings-court', 'roster').creatures.push({ ref: 'creature/goblin-emperor', count: 1 });
    });
    expect(unresolved.join('\n')).toMatch(/warren-kings-court\.json: .*creature\/goblin-emperor.* does not resolve/);
  });

  it('fails a malformed spawn table: a count that can roll 0, ranges that overlap or miss a face, and a range with no roll', async () => {
    const { encounterErrors } = await validate((entries) => {
      const rows = part(entries, 'bandit-ambush', 'spawn-table').rows;
      rows.low.creatures[1].count = '1d4-1';
      rows.moderate.range = { min: 2, max: 4 };
    });
    const at = 'bandit-ambush.json: stats.parts[2]';
    expect(encounterErrors).toEqual([`${at}.rows.low.creatures[1].count: 1d4-1 can roll 0; a count is at least 1`, `${at}.rows.moderate.range: 2 on 1d6 already picks the low row`]);
    const { encounterErrors: gaps } = await validate((entries) => {
      part(entries, 'bandit-ambush', 'spawn-table').rows.high.range = { min: 6, max: 7 };
    });
    expect(gaps).toEqual([`${at}.rows.high.range: 6–7 isn't a range of faces on 1d6 (1–6)`]);
    const { encounterErrors: missing } = await validate((entries) => {
      const table = part(entries, 'bandit-ambush', 'spawn-table');
      delete table.rows.high;
    });
    expect(missing).toEqual([`${at}.rows: no row's range covers 6 on 1d6; the ranges cover every face`]);
    const { encounterErrors: unrolled } = await validate((entries) => {
      const table = part(entries, 'bandit-ambush', 'spawn-table');
      delete table.roll;
      delete table.rows.low.range;
      delete table.rows.moderate.range;
    });
    expect(unrolled).toEqual([`${at}.rows.high.range: a range needs the table's \`roll\`, the die it's on`]);
    const { encounterErrors: unranged } = await validate((entries) => {
      delete part(entries, 'bandit-ambush', 'spawn-table').rows.low.range;
    });
    expect(unranged).toEqual([`${at}.rows.low: the table rolls 1d6, so every row has a range on it`]);
    const { encounterErrors: empty } = await validate((entries) => {
      part(entries, 'bandit-ambush', 'spawn-table').rows = {};
    });
    expect(empty).toEqual([`${at}.rows: must NOT have fewer than 1 properties`]);
  });

  it("fails a setIn or map part naming a zone the map doesn't have", async () => {
    const { encounterErrors } = await validate((entries) => {
      const court = encounter(entries, 'warren-kings-court');
      court.stats.setIn.zone = 'throne-room';
      court.stats.parts[0].map.zone = 'throne-room';
    });
    expect(encounterErrors).toHaveLength(2);
    for (const message of encounterErrors) expect(message).toMatch(/map\/sunken-cistern has no zone "throne-room"/);
  });
});

describe('lowestCount', () => {
  it('is a number itself, and a dice count its dice plus its modifier', () => {
    expect([3, '1d6', '2d4', '1d6+2', '3d8-2'].map(lowestCount)).toEqual([3, 1, 2, 3, 1]);
  });
});

describe('ref labels', () => {
  it("labels a part's refs as inventory, apart from rules refs, and setIn as the setting", () => {
    expect(ruleset.refLabels('encounter', 'stats.parts[2].creatures[0]')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(ruleset.refLabels('encounter', 'stats.parts[1].text')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(ruleset.refLabels('encounter', 'stats.setIn')).toEqual({ forward: 'Set in', back: 'Set here' });
    expect(ruleset.refLabels('creature', 'stats.gear[0]').back).not.toBe('Appears in');
  });
});

describe('environment', { timeout: VALIDATION_TIMEOUT }, () => {
  it('warns on any E, for the reviewer, and fails a multiplier of 1, 0, or one without a note', async () => {
    const { result } = await validate();
    const warnings = result.warnings.filter((w) => w.file.includes('/encounter/')).map((w) => `${w.file.replace(/^.*\/encounter\//, '')}: ${w.message}`);
    expect(warnings).toEqual(["warren-kings-court.json: stats.environment.multiplier: the environment multiplies the encounter's XP by 1.25; confirm the deviation"]);

    const { encounterErrors } = await validate((entries) => {
      encounter(entries, 'warren-kings-court').stats.environment.multiplier = 1;
      encounter(entries, 'druids-and-stirges').stats.environment = { multiplier: 0, note: 'Nothing.' };
      encounter(entries, 'bugbear-warrior-alone').stats.environment = { multiplier: 1.5 };
    });
    expect(encounterErrors.find((e) => e.startsWith('warren-kings-court.json'))).toMatch(/a multiplier of 1 changes nothing/);
    expect(encounterErrors.find((e) => e.startsWith('druids-and-stirges.json'))).toMatch(/multiplier/);
    expect(encounterErrors.find((e) => e.startsWith('bugbear-warrior-alone.json'))).toMatch(/note/);
  });
});

describe('difficulty', () => {
  const derived = async (id: string) => {
    const entries = (await all()).filter((e) => e.ruleset === 'dnd-5e-2024') as unknown as LinkedEntry[];
    const found = entries.find((e) => e.type === 'encounter' && e.id === id)!;
    return ruleset.deriveLinked!('encounter', `encounter/${id}`, found.stats, linkedLibrary(entries));
  };

  it('gives the SRD budget examples: 200 XP is Low for four level 1 characters, 1,125 XP Moderate for five level 3', async () => {
    const bugbear = await derived('bugbear-warrior-alone');
    expect(bugbear).toEqual({ multiplier: 1, xp: { min: 200, max: 200 }, creatureTypes: ['fey'] });
    expect(partyBudget([1, 1, 1, 1], tables)).toEqual({ low: 200, moderate: 300, high: 400 });
    expect(difficultyOf(200, partyBudget([1, 1, 1, 1], tables))).toBe('low');

    const grove = await derived('druids-and-stirges');
    expect(grove.xp).toEqual({ min: 1125, max: 1125 });
    expect(grove.creatureTypes).toEqual(['humanoid', 'monstrosity']);
    expect(difficultyOf(1125, partyBudget([3, 3, 3, 3, 3], tables))).toBe('moderate');
  }, VALIDATION_TIMEOUT);

  it("multiplies the boss fight's XP by its E", async () => {
    // The Warren King (CR 4, 1,100 XP), a hexer and a boss (CR 1, 200 XP each), times 1.25.
    expect(await derived('warren-kings-court')).toEqual({ multiplier: 1.25, xp: { min: 1875, max: 1875 }, creatureTypes: ['fey'] });
  }, VALIDATION_TIMEOUT);

  it("gives a spawn table each row's minimum, average, and maximum, and the span of its rows", async () => {
    // A lookout and bandits are 25 XP each; the captain is 450.
    expect(await derived('bandit-ambush')).toEqual({
      multiplier: 1,
      xp: { min: 75, max: 675 },
      rows: {
        low: { min: 75, average: 112.5, max: 150 },
        moderate: { min: 75, average: 150, max: 225 },
        high: { min: 550, average: 612.5, max: 675 },
      },
      creatureTypes: ['humanoid'],
    });
  }, VALIDATION_TIMEOUT);

  it("sums a mixed party's budgets per character, and equals the SRD's budget times the size at one level", () => {
    expect(partyBudget([2, 3, 5], tables)).toEqual({ low: 750, moderate: 1125, high: 1700 });
    expect(partyBudget([5, 5, 5, 5], tables)).toEqual({ low: 2000, moderate: 3000, high: 4400 });
    expect(partyBudget([], tables)).toEqual({ low: 0, moderate: 0, high: 0 });
    expect(() => partyBudget([21], tables)).toThrow(/level 21/);
  });

  it('reads Low at or under the Low budget, then Moderate, High, and Beyond High', () => {
    const budget = partyBudget([2, 3, 5], tables);
    expect([0, 750, 751, 1125, 1126, 1700, 1701].map((xp) => difficultyOf(xp, budget))).toEqual(['low', 'low', 'moderate', 'moderate', 'high', 'high', 'beyond-high']);
  });

  it("spans a count's dice: lowest, average, and highest roll", () => {
    expect(countSpan(3)).toEqual({ min: 3, average: 3, max: 3 });
    expect(countSpan('1d4+1')).toEqual({ min: 2, average: 3.5, max: 5 });
    expect(countSpan('3d8-2')).toEqual({ min: 1, average: 11.5, max: 22 });
  });

  it('has a budget for every level, 1 to 20, rising with level', () => {
    expect(tables.xpBudgetPerCharacter).toHaveLength(20);
    for (const [i, row] of tables.xpBudgetPerCharacter.entries()) {
      expect(row.low < row.moderate && row.moderate < row.high, `level ${i + 1}`).toBe(true);
      if (i > 0) expect(row.low > tables.xpBudgetPerCharacter[i - 1]!.low, `level ${i + 1}`).toBe(true);
    }
  });
});

describe('in the Library (docs/site.md#type-registry)', { timeout: VALIDATION_TIMEOUT }, () => {
  let indexed: Promise<LibraryRecord[]> | undefined;
  /** The index's encounter records, built from the library with the fixtures. */
  const encounters = () =>
    (indexed ??= (async () => {
      const lib = await fixtureLibrary(await all());
      const { errors, records } = await buildIndex(lib.content, { assetsRoot: lib.repo });
      if (errors.length > 0) throw new Error(errors.map((e) => e.message).join('\n'));
      return records.filter((r) => r.type === 'encounter') as LibraryRecord[];
    })());
  const config = galleryConfig(registryJson as unknown as Registry);
  const view = async (query: string) =>
    computeView(await encounters(), config, parseQuery(`?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/encounter&${query}`, config)).results.map((r) => r.id);

  it("lifts XP as a span, a spawn table's across its rows, and the roster's creature types", async () => {
    const facets = Object.fromEntries((await encounters()).map((r) => [r.id, r.facets]));
    expect(facets['bandit-ambush']).toEqual({ 'derived.xp': { min: 75, max: 675 }, 'derived.creatureTypes': ['humanoid'] });
    expect(facets['bugbear-warrior-alone']).toEqual({ 'derived.xp': { min: 200, max: 200 }, 'derived.creatureTypes': ['fey'] });
    expect(facets['druids-and-stirges']).toEqual({ 'derived.xp': { min: 1125, max: 1125 }, 'derived.creatureTypes': ['humanoid', 'monstrosity'] });
    expect(facets['warren-kings-court']).toEqual({ 'derived.xp': { min: 1875, max: 1875 }, 'derived.creatureTypes': ['fey'] });
  });

  it('filters the cases by XP, a spawn table matching a range its span overlaps, and by creature type', async () => {
    expect(await view('f.derived.xp=500..700')).toEqual(['bandit-ambush']);
    expect(await view('f.derived.xp=..200&sort=derived.xp:asc')).toEqual(['bandit-ambush', 'bugbear-warrior-alone']);
    expect(await view('f.derived.xp=1000..')).toEqual(['druids-and-stirges', 'warren-kings-court']);
    expect(await view('f.derived.creatureTypes=fey')).toEqual(['bugbear-warrior-alone', 'warren-kings-court']);
    expect(await view('f.derived.creatureTypes=humanoid&f.derived.xp=1000..')).toEqual(['druids-and-stirges']);
  });

  it('opens the XP and creature type filters when the Library opens with encounters checked, as a creature opens CR and type', () => {
    expect(config.types.get('dnd-5e-2024/encounter')!.defaultFilters).toEqual(['derived.xp', 'derived.creatureTypes']);
  });

  it('sorts by XP, a span by its minimum', async () => {
    expect(await view('sort=derived.xp:desc')).toEqual(['warren-kings-court', 'druids-and-stirges', 'bugbear-warrior-alone', 'bandit-ambush']);
  });

  it('shows name, XP, creature types, and summary on the card', async () => {
    const records = await encounters();
    const html = renderToString(
      h(Gallery, { indexUrl: '/library.json', base: '/ttrpg-library/', records, initialQuery: '?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/encounter' }),
    );
    const ambush = records.find((r) => r.id === 'bandit-ambush')!;
    const card = html.slice(html.indexOf(`id="card-encounter-bandit-ambush-name"`));
    expect(card).toContain(ambush.name);
    expect(card).toContain('<dt>XP</dt><dd>75–675</dd>');
    expect(card).toContain('<dt>Creature type</dt><dd>Humanoid</dd>');
    expect(card).toContain(ambush.summary);
    const grove = html.slice(html.indexOf(`id="card-encounter-druids-and-stirges-name"`));
    expect(grove).toContain('<dt>XP</dt><dd>1125</dd>');
    expect(grove).toContain('<dt>Creature type</dt><dd>Humanoid, Monstrosity</dd>');
  });
});
