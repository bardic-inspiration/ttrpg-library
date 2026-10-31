import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../scripts/validate/index.ts';
import { listEntryFiles } from '../scripts/validate/walk.ts';

const fixtures = join(import.meta.dirname, 'fixtures/library');

describe('listEntryFiles', () => {
  it('lists entry files relative to the root', async () => {
    expect(await listEntryFiles(join(fixtures, 'valid'))).toEqual([
      'dnd-5e-2024/creature/sample.json',
    ]);
  });

  it('treats a missing root as an empty library', async () => {
    expect(await listEntryFiles(join(fixtures, 'does-not-exist'))).toEqual([]);
  });
});

describe('validateLibrary', () => {
  let empty: string | undefined;
  afterEach(async () => {
    if (empty) await rm(empty, { recursive: true, force: true });
    empty = undefined;
  });

  it('passes on an empty library', async () => {
    empty = await mkdtemp(join(tmpdir(), 'ttrpg-empty-'));
    expect(await validateLibrary(empty)).toEqual({ files: [], errors: [] });
  });

  it('passes a library of well-formed files', async () => {
    const result = await validateLibrary(join(fixtures, 'valid'));
    expect(result.errors).toEqual([]);
  });

  it('reports a file that is not valid JSON', async () => {
    const result = await validateLibrary(join(fixtures, 'broken'));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.file).toBe('dnd-5e-2024/creature/sample.json');
    expect(result.errors[0]?.message).toMatch(/^invalid JSON/);
  });
});
