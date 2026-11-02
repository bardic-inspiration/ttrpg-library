// Data fetches revalidate with the server, so a deploy shows up on the next
// load instead of after the browser's cached copy expires (SPEC.md §9.1).
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExportItems, resolveIO } from '../../site/src/exporters/io.ts';
import { fetchFresh } from '../../site/src/lib/fetch-fresh.ts';

const ok = () => new Response('{}', { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('fetchFresh', () => {
  it('asks the browser to revalidate its cached copy', async () => {
    const spy = vi.fn(async () => ok());
    vi.stubGlobal('fetch', spy);
    await fetchFresh('/ttrpg-library/library.json');
    expect(spy).toHaveBeenCalledWith('/ttrpg-library/library.json', { cache: 'no-cache' });
  });

  it('is the exporters\' default fetch', async () => {
    const spy = vi.fn(async () => ok());
    vi.stubGlobal('fetch', spy);
    await resolveIO({ scope: 'entry', base: '/' }).fetch('/a.json');
    await loadExportItems('/', [{ ruleset: 'r', type: 't', id: 'x' }]);
    expect(spy.mock.calls).toEqual([
      ['/a.json', { cache: 'no-cache' }],
      ['/data/r/t/x.export.json', { cache: 'no-cache' }],
    ]);
  });
});

describe('site code', () => {
  it('fetches only through fetchFresh', async () => {
    const root = join(import.meta.dirname, '../../site/src');
    const files = (await readdir(root, { recursive: true })).filter((f) => /\.(ts|tsx|astro)$/.test(f));
    const direct: string[] = [];
    for (const file of files) {
      if (file === join('lib', 'fetch-fresh.ts')) continue;
      const text = await readFile(join(root, file), 'utf8');
      if (/(?<![\w.])fetch\(/.test(text)) direct.push(relative(root, join(root, file)));
    }
    expect(direct).toEqual([]);
  });
});
