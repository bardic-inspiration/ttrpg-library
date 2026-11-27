// dnd-5e-2024 modules (docs/rulesets.md#modules), arrangements that contain encounters and other modules
// (docs/content-model.md#arrangements): the spec's five-room dungeon and the nested module that holds it
// validate, a module containing itself fails, and a malformed part, length, or levels fails. Contained
// entries list their modules under "Part of".
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import { refLabels } from '../../../rulesets/dnd-5e-2024/refs.ts';
import { FIXTURES, libraryWithout, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const MODULES = join(FIXTURES, 'module');
const ENCOUNTERS = join(FIXTURES, 'encounter');
const CHARACTERS = join(FIXTURES, 'character');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
const jsonIn = async (path: string) => Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f))));

/**
 * The module fixtures (with the encounters the five-room dungeon adds), the encounter, character, and
 * valid map fixtures they ref, and the library minus its modules, encounters, characters, and maps,
 * and the entries that link to them.
 */
const STOOD_IN = new Set(['module', 'encounter', 'character', 'map']);
const loadAll = async () => {
  const fixtures = [...(await jsonIn(MODULES)), ...(await jsonIn(ENCOUNTERS)), ...(await jsonIn(CHARACTERS)), ...(await jsonIn(MAPS)).filter((m) => m.id !== 'broken-weir')];
  return [...fixtures, ...(await libraryWithout([...STOOD_IN], fixtures))];
};
let library: ReturnType<typeof loadAll> | undefined;
const all = async () => structuredClone(await (library ??= loadAll()));

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Validating the whole library takes a few seconds; Vitest's 5 s default is too tight. */
const VALIDATION_TIMEOUT = 30_000;

/** Validates the library with the fixtures, the map fixtures' diagrams beside it, after `change` edits the entries. */
async function validate(change: (entries: Record<string, any>[]) => void = () => {}) {
  const entries = await all();
  change(entries);
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const images = join(lib.repo, 'assets/images/dnd-5e-2024/map');
  await mkdir(images, { recursive: true });
  for (const svg of (await readdir(MAPS)).filter((f) => f.endsWith('.svg') && f !== 'broken-weir.svg')) await copyFile(join(MAPS, svg), join(images, svg));
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  const moduleErrors = result.errors.filter((i) => i.file.includes('/module/')).map((i) => `${i.file.replace(/^.*\/module\//, '')}: ${i.message}`);
  return { errors: result.errors.map((e) => `${e.file}: ${e.message}`), moduleErrors, result };
}

const mod = (entries: Record<string, any>[], id: string) => entries.find((e) => e.type === 'module' && e.id === id)!;

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the five-room dungeon and the multi-session module that holds it as a chapter', async () => {
    const { errors, result } = await validate();
    expect(errors).toEqual([]);
    const ids = result.entries.filter((e) => e.entry.type === 'module').map((e) => e.entry.id).sort();
    expect(ids).toEqual(['sunken-cistern-delve', 'the-stilled-mill']);
  });

  it('links contained arrangements both ways, and a hook\'s refs and every text token as inventory', async () => {
    const { result } = await validate();
    const found = (type: string, id: string) => result.entries.find((e) => e.entry.type === type && e.entry.id === id)!;
    expect(found('module', 'the-stilled-mill').refs).toEqual(
      expect.arrayContaining([
        { path: 'stats.parts[1].refs[0]', key: 'character/brannoc-ashguard' },
        { path: 'stats.parts[1].refs[2]', key: 'creature/guard-captain' },
        { path: 'stats.parts[3].map', key: 'map/harrowfield' },
        { path: 'stats.parts[5].arrangement', key: 'encounter/bandit-ambush' },
        { path: 'stats.parts[6].arrangement', key: 'module/sunken-cistern-delve' },
      ]),
    );
    expect(found('module', 'sunken-cistern-delve').refs).toEqual(
      expect.arrayContaining([{ path: 'stats.parts[0].text', key: 'map/harrowfield', zone: 'millside' }]),
    );
    // The delve is part of the mill, and the king's court part of the delve; an arrangement may be in several modules.
    expect(found('module', 'sunken-cistern-delve').refBy).toEqual([{ path: 'stats.parts[6].arrangement', key: 'module/the-stilled-mill' }]);
    expect(found('encounter', 'warren-kings-court').refBy).toEqual(expect.arrayContaining([{ path: 'stats.parts[5].arrangement', key: 'module/sunken-cistern-delve' }]));
  });

  it("labels a contained arrangement \"Contains\" and \"Part of\", and a module's other refs as inventory", () => {
    expect(refLabels('module', 'stats.parts[6].arrangement')).toEqual({ forward: 'Contains', back: 'Part of' });
    expect(refLabels('module', 'stats.parts[1].refs[0]')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(refLabels('module', 'stats.parts[3].map')).toEqual({ forward: 'Includes', back: 'Appears in' });
    expect(refLabels('module', 'stats.parts[0].text')).toEqual({ forward: 'Includes', back: 'Appears in' });
  });

  it('lets one encounter be in several modules', async () => {
    const { errors } = await validate((entries) => {
      mod(entries, 'the-stilled-mill').stats.parts.push({ part: 'arrangement', arrangement: { ref: 'encounter/warren-kings-court' } });
    });
    expect(errors).toEqual([]);
  });

  it('fails a module that contains itself, directly or through others', async () => {
    const { moduleErrors } = await validate((entries) => {
      mod(entries, 'sunken-cistern-delve').stats.parts.push({ part: 'arrangement', arrangement: { ref: 'module/the-stilled-mill' } });
      const loop: Record<string, any> = { ...structuredClone(mod(entries, 'sunken-cistern-delve')), id: 'mirror-pool' };
      loop.name = 'The Mirror Pool';
      loop.stats.parts = [{ part: 'arrangement', arrangement: { ref: 'module/mirror-pool' } }];
      entries.push(loop);
    });
    expect(moduleErrors).toEqual(
      expect.arrayContaining([
        "sunken-cistern-delve.json: stats.parts[7].arrangement: a module can't contain itself: module/sunken-cistern-delve › module/the-stilled-mill › module/sunken-cistern-delve",
        "the-stilled-mill.json: stats.parts[6].arrangement: a module can't contain itself: module/the-stilled-mill › module/sunken-cistern-delve › module/the-stilled-mill",
        "mirror-pool.json: stats.parts[0].arrangement: a module can't contain itself: module/mirror-pool › module/mirror-pool",
      ]),
    );
  });

  it("fails a malformed part: an encounter's own part, a hook without text, an arrangement that isn't one, and a table holding more than a table", async () => {
    const { moduleErrors } = await validate((entries) => {
      const parts = mod(entries, 'the-stilled-mill').stats.parts;
      parts.push({ part: 'roster', creatures: [{ ref: 'creature/bandit', count: 2 }] });
      parts.push({ part: 'hook', refs: [{ ref: 'creature/bandit' }] });
      parts.push({ part: 'arrangement', arrangement: { ref: 'map/harrowfield' } });
    });
    const at = (i: number) => `the-stilled-mill.json: stats.parts[${i}]`;
    expect(moduleErrors).toEqual(
      expect.arrayContaining([
        `${at(8)}.part: must be one of "prose", "description", "dm-guide", "hook", "sequence", "table", "map", "arrangement"`,
        `${at(9)}: missing required key "text"`,
        `${at(10)}.arrangement.ref: must match pattern "^(encounter|module)/[a-z0-9]+(-[a-z0-9]+)*$"`,
      ]),
    );
    // A schema error stops the entry's checks and refs, so these run on their own.
    const checked = await validate((entries) => {
      const parts = mod(entries, 'the-stilled-mill').stats.parts;
      parts.push({ part: 'arrangement', arrangement: { ref: 'module/no-such-module' } });
      parts.push({ part: 'table', title: 'Notes', text: 'Some words.\n\n| a | b |\n|---|---|\n| 1 | 2 |' });
    });
    expect(checked.moduleErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^the-stilled-mill\.json: stats\.parts\[8\]\.arrangement: ref "module\/no-such-module" does not resolve/),
        `${at(9)}.text: a table part holds one pipe table and nothing else; its title is \`title\``,
      ]),
    );
  });

  it("fails a module without a length or levels, an unknown length, and levels that run backward or past 20", async () => {
    const { moduleErrors } = await validate((entries) => {
      delete mod(entries, 'the-stilled-mill').stats.length;
      mod(entries, 'the-stilled-mill').stats.levels = { min: 5, max: 3 };
      const delve = mod(entries, 'sunken-cistern-delve');
      delve.stats.length = 'campaign';
      delve.stats.levels = { min: 2, max: 21 };
    });
    expect(moduleErrors).toEqual(
      expect.arrayContaining([
        'the-stilled-mill.json: stats: missing required key "length"',
        'sunken-cistern-delve.json: stats.length: must be one of "one-shot", "delve", "multi-session"',
        'sunken-cistern-delve.json: stats.levels.max: must be <= 20',
      ]),
    );
    const backward = await validate((entries) => {
      mod(entries, 'the-stilled-mill').stats.levels = { min: 5, max: 3 };
    });
    expect(backward.moduleErrors).toEqual(['the-stilled-mill.json: stats.levels: levels 5–3 run backward; `min` is at most `max`']);
  });

  it("fails a module part in an encounter", async () => {
    const { errors } = await validate((entries) => {
      const court = entries.find((e) => e.type === 'encounter' && e.id === 'warren-kings-court')!;
      court.stats.parts.push({ part: 'hook', text: 'Come along.' });
    });
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/warren-kings-court\.json: stats\.parts\[5\]\.part: must be one of "prose", "description", "dm-guide", "roster", "spawn-table", "sequence", "table", "loot", "map"$/)]),
    );
  });
});
