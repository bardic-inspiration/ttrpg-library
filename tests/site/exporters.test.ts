// The exporter interface, registry, config, and JSON export (SPEC.md §10.1, §10.2, §10.5).
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../config/export.json' with { type: 'json' };
import { configuredExporters, exportersFor, modules } from '../../site/src/exporters/index.ts';
import { rawFileUrl } from '../../site/src/exporters/io.ts';
import { dateStamp, json } from '../../site/src/exporters/json.ts';
import type { ExportFile, ExportItem } from '../../site/src/exporters/types.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const lib = await fixtureLibrary();
const item = (id: string): ExportItem => {
  const { entry, derived } = lib.byId(id);
  return { entry, derived };
};

/** Serves raw files the way build:index lays them out under the site base. */
function fakeIO(files: Record<string, string>) {
  const downloads: ExportFile[] = [];
  const fetched: string[] = [];
  return {
    downloads,
    fetched,
    io: {
      fetch: async (url: string) => {
        fetched.push(url);
        const text = files[url];
        return { ok: text !== undefined, status: text === undefined ? 404 : 200, text: async () => text ?? '' };
      },
      download: (file: ExportFile) => void downloads.push(file),
      now: () => new Date(2026, 10, 2, 23, 30),
    },
  };
}

const BASE = '/ttrpg-library/';
const raw = (id: string) => `{\n  "id": "${id}",\n  "note": "byte-for-byte"\n}\n`;
const served = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [rawFileUrl(BASE, lib.byId(id).entry), raw(id)]));

describe('config/export.json (SPEC.md §10.5)', () => {
  it('has the four page sizes with exactly one default', () => {
    expect(config.pageSizes.map((s) => s.id)).toEqual(['letter', 'a4', 'half-letter', 'card-4x6']);
    expect(config.pageSizes.filter((s) => 'default' in s && s.default).map((s) => s.id)).toEqual(['letter']);
    for (const size of config.pageSizes) {
      expect([1, 2]).toContain(size.columns);
      for (const length of [size.width, size.height, size.margin]) expect(length).toMatch(/^\d+(\.\d+)?(in|mm)$/);
    }
  });

  it('has PNG settings', () => {
    expect(config.png).toEqual({ scale: 2, width: 420, wideWidth: 840 });
  });

  it('lists only exporters that have a module, each once', () => {
    expect(new Set(config.exporters).size).toBe(config.exporters.length);
    for (const id of config.exporters) expect(modules[id]?.id).toBe(id);
  });
});

describe('exporter registry (SPEC.md §10.1)', () => {
  it('keeps config order and filters by scope', () => {
    expect(configuredExporters().map((e) => e.id)).toEqual(config.exporters);
    expect(configuredExporters('entry').every((e) => e.scopes.includes('entry'))).toBe(true);
    expect(exportersFor(['json'], 'set').map((e) => e.id)).toEqual(['json']);
  });

  it('rejects an unknown exporter id', () => {
    expect(() => exportersFor(['json', 'foundry'])).toThrow(/unknown exporter "foundry"/);
  });

  it('has exactly one module file per registered exporter', async () => {
    const dir = join(import.meta.dirname, '../../site/src/exporters');
    const files = (await readdir(dir)).filter((f) => !['index.ts', 'io.ts', 'types.ts'].includes(f));
    expect(files.map((f) => f.replace(/\.ts$/, '')).sort()).toEqual(Object.keys(modules).sort());
  });
});

describe('JSON export (SPEC.md §10.2)', () => {
  it('builds raw file URLs as build:index copies them', () => {
    expect(rawFileUrl(BASE, lib.byId('cinder-hound').entry)).toBe('/ttrpg-library/data/dnd-5e-2024/creature/cinder-hound.json');
  });

  it('downloads one entry\'s raw file unchanged as <id>.json', async () => {
    const fake = fakeIO(served('cinder-hound'));
    await json.run([item('cinder-hound')], { scope: 'entry', base: BASE, io: fake.io });
    expect(fake.downloads).toEqual([{ name: 'cinder-hound.json', type: 'application/json', data: raw('cinder-hound') }]);
  });

  it('downloads a set as one array named by the local date', async () => {
    const fake = fakeIO(served('cinder-hound', 'frost-lance'));
    await json.run([item('frost-lance'), item('cinder-hound')], { scope: 'set', base: BASE, io: fake.io });
    expect(fake.downloads).toHaveLength(1);
    const file = fake.downloads[0]!;
    expect(file.name).toBe('library-20261102.json');
    expect(JSON.parse(file.data as string)).toEqual([
      { id: 'frost-lance', note: 'byte-for-byte' },
      { id: 'cinder-hound', note: 'byte-for-byte' },
    ]);
    expect((file.data as string).endsWith('\n')).toBe(true);
  });

  it('downloads an empty array for an empty set', async () => {
    const fake = fakeIO({});
    await json.run([], { scope: 'set', base: BASE, io: fake.io });
    expect(fake.downloads[0]!.data).toBe('[]\n');
  });

  it('fails without downloading when a raw file is missing', async () => {
    const fake = fakeIO(served('cinder-hound'));
    await expect(
      json.run([item('cinder-hound'), item('frost-lance')], { scope: 'set', base: BASE, io: fake.io }),
    ).rejects.toThrow(/404/);
    expect(fake.downloads).toEqual([]);
  });

  it('takes exactly one entry in entry scope', async () => {
    const fake = fakeIO(served('cinder-hound', 'frost-lance'));
    await expect(
      json.run([item('cinder-hound'), item('frost-lance')], { scope: 'entry', base: BASE, io: fake.io }),
    ).rejects.toThrow(/exactly one/);
  });

  it('pads the date stamp', () => {
    expect(dateStamp(new Date(2027, 0, 5))).toBe('20270105');
  });
});
