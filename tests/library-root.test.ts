// docs/site.md#library-root: the library the site and build:index read, and its own public and dist folders.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { libraryRoot, REPO_ROOT, siteDirs } from '../lib/library-root.ts';
import { ORIGINALS } from './originals/fixture.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('libraryRoot', () => {
  it('is the repo root when LIBRARY_ROOT is unset or empty', () => {
    expect(libraryRoot({})).toBe(REPO_ROOT);
    expect(libraryRoot({ LIBRARY_ROOT: '' })).toBe(REPO_ROOT);
  });

  it('reads LIBRARY_ROOT from the repo root', () => {
    expect(libraryRoot({ LIBRARY_ROOT: 'tests/fixtures/originals' })).toBe(ORIGINALS);
    expect(libraryRoot({ LIBRARY_ROOT: ORIGINALS })).toBe(ORIGINALS);
  });
});

describe('siteDirs', () => {
  it('stages and builds the repo’s library in site/public and site/dist', () => {
    expect(siteDirs(REPO_ROOT)).toEqual({ publicDir: join(REPO_ROOT, 'site/public'), outDir: join(REPO_ROOT, 'site/dist') });
  });

  it('gives another library folders of its own, by its folder’s name', () => {
    expect(siteDirs(ORIGINALS)).toEqual({ publicDir: join(REPO_ROOT, 'site/public-originals'), outDir: join(REPO_ROOT, 'site/dist-originals') });
  });
});

describe('build:index with LIBRARY_ROOT', () => {
  it('indexes that library with its own rulesets and registry', async () => {
    const out = await mkdtemp(join(tmpdir(), 'ttrpg-library-root-'));
    temps.push(out);
    const cli = join(REPO_ROOT, 'scripts/build-index/cli.ts');
    const result = spawnSync('npx', ['tsx', cli, join(ORIGINALS, 'content'), out], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      env: { ...process.env, LIBRARY_ROOT: 'tests/fixtures/originals' },
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const records = JSON.parse(await readFile(join(out, 'library.json'), 'utf8')) as { ruleset: string; facets: object }[];
    expect(new Set(records.map((r) => r.ruleset))).toEqual(new Set(['elementals', 'starships-and-galaxies']));
    // Facets come from the fixtures' registry, so a record has some.
    expect(records.every((r) => Object.keys(r.facets).length > 0)).toBe(true);
    expect((await readdir(join(out, 'data'))).sort()).toEqual(['elementals', 'starships-and-galaxies']);
  });
});
