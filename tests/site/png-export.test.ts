// PNG export (SPEC.md §10.3, §10.5): capture width, filename, and scope.
import { describe, expect, it } from 'vitest';
import config from '../../config/export.json' with { type: 'json' };
import { captureWidth, isWide, png } from '../../site/src/exporters/png.ts';
import type { CaptureRequest, ExportFile, ExportItem } from '../../site/src/exporters/types.ts';
import type { Entry } from '../../site/src/lib/library.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const lib = await fixtureLibrary();
const item = (id: string): ExportItem => {
  const { entry, derived } = lib.byId(id);
  return { entry, derived };
};
const hound = lib.byId('cinder-hound').entry;
const withStats = (entry: Entry, stats: Record<string, unknown>): Entry => ({
  ...entry,
  stats: { ...(entry.stats as Record<string, unknown>), ...stats },
});
const actions = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Action ${i + 1}`, text: 'It acts.' }));

function fakeIO() {
  const downloads: ExportFile[] = [];
  const captures: CaptureRequest[] = [];
  const blob = new Blob(['png bytes'], { type: 'image/png' });
  return {
    blob,
    downloads,
    captures,
    io: {
      capture: async (request: CaptureRequest) => {
        captures.push(request);
        return blob;
      },
      download: (file: ExportFile) => void downloads.push(file),
    },
  };
}

const BASE = '/ttrpg-library/';

describe('PNG capture width (SPEC.md §10.5)', () => {
  it('uses the normal width for a creature with six or fewer actions and no legendary actions', () => {
    expect(isWide(hound)).toBe(false);
    expect(isWide(withStats(hound, { actions: actions(6) }))).toBe(false);
    expect(captureWidth(hound)).toBe(config.png.width);
  });

  it('uses the wide width for a creature with more than six actions', () => {
    const entry = withStats(hound, { actions: actions(7) });
    expect(isWide(entry)).toBe(true);
    expect(captureWidth(entry)).toBe(config.png.wideWidth);
  });

  it('uses the wide width for a creature with legendary actions', () => {
    const entry = withStats(hound, { legendaryActions: { uses: 3, items: actions(1) } });
    expect(captureWidth(entry)).toBe(config.png.wideWidth);
  });

  it('uses the normal width for every other type', () => {
    expect(captureWidth(lib.byId('frost-lance').entry)).toBe(config.png.width);
    expect(captureWidth(lib.byId('wand-of-frost-lances').entry)).toBe(config.png.width);
    const item = lib.byId('wand-of-frost-lances').entry;
    expect(captureWidth(withStats(item, { actions: actions(9) }))).toBe(config.png.width);
  });

  it('reads widths from the given settings', () => {
    expect(captureWidth(hound, { scale: 3, width: 300, wideWidth: 600 })).toBe(300);
  });
});

describe('PNG export (SPEC.md §10.3)', () => {
  it('captures the entry at its width and the configured scale and downloads <id>.png', async () => {
    const fake = fakeIO();
    await png.run([item('cinder-hound')], { scope: 'entry', base: BASE, io: fake.io });
    expect(fake.captures).toEqual([{ id: 'cinder-hound', width: config.png.width, scale: config.png.scale }]);
    expect(fake.downloads).toEqual([{ name: 'cinder-hound.png', type: 'image/png', data: fake.blob }]);
  });

  it('offers entry scope only', async () => {
    expect(png.scopes).toEqual(['entry']);
    const fake = fakeIO();
    await expect(png.run([item('cinder-hound')], { scope: 'set', base: BASE, io: fake.io })).rejects.toThrow(/entry scope/);
    expect(fake.captures).toEqual([]);
  });

  it('takes exactly one entry', async () => {
    const fake = fakeIO();
    await expect(
      png.run([item('cinder-hound'), item('frost-lance')], { scope: 'entry', base: BASE, io: fake.io }),
    ).rejects.toThrow(/exactly one/);
  });

  it('downloads nothing when the capture fails', async () => {
    const fake = fakeIO();
    const io = { ...fake.io, capture: async () => Promise.reject(new Error('no capture source')) };
    await expect(png.run([item('cinder-hound')], { scope: 'entry', base: BASE, io })).rejects.toThrow(/no capture source/);
    expect(fake.downloads).toEqual([]);
  });
});

describe('PNG capture source (SPEC.md §10.3, §9.6)', () => {
  async function render(loaded: ReturnType<typeof lib.byId>): Promise<string> {
    const { experimental_AstroContainer: AstroContainer } = await import('astro/container');
    const { default: CaptureSource } = await import('../../site/src/components/detail/CaptureSource.astro');
    const container = await AstroContainer.create();
    return container.renderToString(CaptureSource, { props: { loaded, names: lib.names } });
  }

  it('renders the template in capture mode with light tokens inside an inert <template>', async () => {
    const html = await render(lib.byId('cinder-hound'));
    expect(html).toMatch(/^\s*<template data-capture="cinder-hound"[ >]/);
    expect(html).toMatch(/class="capture[^"]*"[^>]*data-theme="light"/);
    expect(html).toContain('data-mode="capture"');
    expect(html).toContain('Includes SRD 5.2 material, CC-BY-4.0');
    expect(html).not.toContain('data-wide');
  });

  it('omits the art placeholder and includes art when present', async () => {
    const loaded = lib.byId('cinder-hound');
    expect(await render(loaded)).not.toContain('art-frame');
    const withArt = await render({ ...loaded, entry: { ...loaded.entry, image: 'assets/images/dnd-5e-2024/creature/cinder-hound.webp' } });
    expect(withArt).toMatch(/<img class="art-frame art-frame--image[^"]*" src="[^"]*cinder-hound\.webp" alt="Cinder Hound"/);
  });

  it('marks a wide creature for the two-column capture', async () => {
    const loaded = lib.byId('cinder-hound');
    const html = await render({ ...loaded, entry: withStats(loaded.entry, { actions: actions(7) }) });
    expect(html).toContain('data-wide');
  });
});
