// The import script (docs/generation.md#imports): a fixture Open5e file on an import issue gives
// valid entries and a skip list; a license off the allowlist is rejected; custom-entry rules skip.
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addAttribution,
  loadImportLibrary,
  runImport,
  skipListSection,
  type ImportLibrary,
  type ImportRequest,
} from '../scripts/import/index.ts';
import { validateLibrary } from '../scripts/validate/index.ts';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';
import { FIXTURES } from './helpers.ts';

let library: ImportLibrary;
let file: unknown;
const temps: string[] = [];

beforeAll(async () => {
  library = await loadImportLibrary('dnd-5e-2024');
  file = JSON.parse(await readFile(join(FIXTURES, 'import/open5e-hollow-grove.json'), 'utf8'));
}, 120_000);
afterAll(async () => {
  await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
});

const request = (over: Partial<ImportRequest> = {}): ImportRequest => ({
  issue: 7,
  format: 'open5e',
  file,
  work: 'The Hollow Grove',
  author: 'A. Author',
  url: 'https://example.com/hollow-grove',
  license: 'CC-BY-4.0',
  ruleset: 'dnd-5e-2024',
  date: '2026-11-17',
  ...over,
});

const done = (outcome: ReturnType<typeof runImport>) => {
  if (outcome.rejected !== undefined) throw new Error(outcome.rejected);
  return outcome;
};

describe('import script (docs/generation.md#imports)', () => {
  it('turns a fixture Open5e file into entries that pass validation beside the whole library', async () => {
    const { entries } = done(runImport(request(), library));
    expect(entries.map((e) => `${e.type}/${e.id}`)).toEqual(['spell/bark-ward', 'item/slippers-of-drifting', 'condition/sapped']);
    const repo = await mkdtemp(join(tmpdir(), 'ttrpg-import-'));
    temps.push(repo);
    await cp(join(PROJECT_ROOT, 'content'), join(repo, 'content'), { recursive: true });
    // The library's maps name diagrams beside the content (docs/content-model.md#map-diagrams).
    await cp(join(PROJECT_ROOT, 'assets'), join(repo, 'assets'), { recursive: true }).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
    for (const entry of entries) {
      const dir = join(repo, 'content', entry.ruleset, entry.type);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${entry.id}.json`), JSON.stringify(entry, null, 2));
    }
    const { errors } = await validateLibrary(join(repo, 'content'));
    expect(errors).toEqual([]);
  }, 120_000);

  it('writes the work as source, its author, and the license block, with no tags (docs/content-model.md#source-and-author)', () => {
    const [spell] = done(runImport(request({ issue: 9 }), library)).entries;
    expect(spell!.meta).toEqual({
      createdAt: '2026-11-17',
      source: { kind: 'import', issues: [9], license: { id: 'CC-BY-4.0', author: 'A. Author', url: 'https://example.com/hollow-grove' } },
    });
    expect(spell).toMatchObject({ source: 'The Hollow Grove', author: 'A. Author' });
    expect(spell).not.toHaveProperty('tags');
    expect(spell!.summary.length).toBeGreaterThanOrEqual(10);
  });

  it('lists the translator\'s skips and the SRD-name skips, by record', () => {
    const { skipped } = done(runImport(request(), library));
    expect(skipped.map((s) => s.entry)).toEqual(['Withered', 'Fireball']);
    expect(skipped[1]!.reason).toMatch(/SRD name/);
  });

  it('skips a record whose name or id the library already has, and a second record of the same name', () => {
    const names = new Map(library.names);
    names.set('spell/bark-ward', 'Bark Ward');
    const { entries, skipped } = done(runImport(request(), { ...library, names }));
    expect(entries.map((e) => e.id)).not.toContain('bark-ward');
    expect(skipped.map((s) => s.reason)).toContainEqual(expect.stringMatching(/already has a spell named Bark Ward/));
    const twice = { spells: [(file as any).spells[0], (file as any).spells[0]] };
    const again = done(runImport(request({ file: twice }), library));
    expect(again.entries).toHaveLength(1);
    expect(again.skipped.map((s) => s.reason)).toContainEqual(expect.stringMatching(/already has/));
  });

  it('skips a record with a blocklisted term', () => {
    const blocked = { ...library, blocklist: [...library.blocklist, 'Drifting'] };
    const { entries, skipped } = done(runImport(request(), blocked));
    expect(entries.map((e) => e.id)).not.toContain('slippers-of-drifting');
    expect(skipped.map((s) => s.reason)).toContainEqual(expect.stringMatching(/blocklisted term/));
  });

  it('rejects a license off the import allowlist, an unknown format, and another ruleset', () => {
    for (const license of ['CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'public-domain']) {
      expect(runImport(request({ license }), library).rejected).toMatch(new RegExp(`"${license}" isn't one the library accepts`));
    }
    expect(runImport(request({ format: 'roll20' }), library).rejected).toMatch(/isn't a format/);
    expect(runImport(request({ ruleset: 'pathfinder-2e' }), library).rejected).toMatch(/maps the dnd-5e-2024 ruleset/);
  });

  it('gives the work\'s ATTRIBUTION.md line and adds it once, under Imported works', async () => {
    const { attribution } = done(runImport(request(), library));
    expect(attribution).toBe(
      '- **The Hollow Grove** by A. Author, https://example.com/hollow-grove, licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode). Adapted: converted from the Open5e format into this library\'s entries.',
    );
    const text = await readFile(join(PROJECT_ROOT, 'ATTRIBUTION.md'), 'utf8');
    const added = addAttribution(text, attribution);
    expect(added.slice(added.lastIndexOf('\n## ') + 1)).toMatch(/^## Imported works\n[\s\S]*\n- \*\*The Hollow Grove\*\*.*\n$/);
    expect(addAttribution(added, attribution)).toBe(added);
  });

  it('prints one issue\'s skip-list section', () => {
    const { skipped } = done(runImport(request(), library));
    expect(skipListSection(7, 'The Hollow Grove', skipped)).toBe(
      [
        '#### #7: The Hollow Grove',
        '',
        '| Record | Field | Reason |',
        '|---|---|---|',
        '| Withered | (whole entry) | Its description lists no effects the library can read, so it isn\'t imported. |',
        '| Fireball | (whole entry) | Its name is an SRD name; an imported entry is custom and can\'t reuse one. |',
        '',
      ].join('\n'),
    );
    expect(skipListSection(8, 'Other', [])).toBe('#### #8: Other\n\nNothing skipped.\n');
  });
});

describe('import CLI (docs/generation.md#imports)', () => {
  // The file doesn't exist, so a run that gets past the issue check stops at reading it and writes nothing.
  const run = (issue: string) =>
    spawnSync(
      'npx',
      ['tsx', join(PROJECT_ROOT, 'scripts/import/cli.ts'), `--issue=${issue}`, '--format', 'open5e', '--file', join(FIXTURES, 'import/missing.json'),
        '--work', 'W', '--author', 'A', '--url', 'https://example.com', '--license', 'CC-BY-4.0'],
      { encoding: 'utf8', cwd: PROJECT_ROOT },
    );

  it('exits 2 when --issue isn\'t a positive integer', () => {
    for (const issue of ['#123', '0', '-4', '1.5', '12abc', '1e3']) {
      const result = run(issue);
      expect(result.status, issue).toBe(2);
      expect(result.stderr, issue).toContain(`--issue "${issue}" isn't an issue number`);
    }
  }, 60_000);

  it('takes a positive integer --issue', () => {
    const result = run('123');
    expect(result.stderr).not.toContain('--issue');
    expect(result.stderr).toMatch(/isn't JSON/);
  }, 20_000);
});
