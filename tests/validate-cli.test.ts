import { spawnSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cinderHound, tempLibrary } from './helpers.ts';

// SPEC.md §16 milestone 1: "a PR with a broken entry is blocked". The
// `validate` check blocks the PR because `npm run validate` exits non-zero.
const cli = join(import.meta.dirname, '..', 'scripts', 'validate', 'cli.ts');
const run = (root: string) =>
  spawnSync('npx', ['tsx', cli, root], { encoding: 'utf8', cwd: join(import.meta.dirname, '..') });

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('validate CLI', () => {
  it('exits 0 when every entry is valid', async () => {
    const lib = await tempLibrary([await cinderHound()]);
    temps.push(lib.repo);
    expect(run(lib.content).status).toBe(0);
  });

  it('exits 1 when an entry is broken', async () => {
    const lib = await tempLibrary([await cinderHound()]);
    temps.push(lib.repo);
    await writeFile(join(lib.content, 'dnd-5e-2024/creature/cinder-hound.json'), '{"bogus": true}');
    const result = run(lib.content);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('error');
  });
});
