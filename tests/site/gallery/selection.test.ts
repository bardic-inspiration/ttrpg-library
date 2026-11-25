// Gallery set actions (docs/site.md#gallery "Selection", docs/export.md#exporter-interface): which entries a set
// action receives, and the export bundles it loads for them.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import SetActions from '../../../site/src/components/gallery/SetActions.tsx';
import { configuredControls, modules } from '../../../site/src/exporters/index.ts';
import { bundleUrl, loadExportItems, rawFileUrl, runSetExport } from '../../../site/src/exporters/io.ts';
import { setTarget, targetText } from '../../../site/src/lib/gallery/selection.ts';
import { fixtureLibrary } from '../library-fixtures.ts';
import { record } from './helpers.ts';

const BASE = '/ttrpg-library/';
const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => record({ id }));
const all = [a!, b!, c!, d!];
const urls = (...records: { url: string }[]) => new Set(records.map((r) => r.url));
const ids = (records: { id: string }[]) => records.map((r) => r.id);

describe('setTarget', () => {
  it('targets the whole filtered set, in the gallery’s order, when nothing is selected', () => {
    const target = setTarget(all, [c!, a!], new Set());
    expect(target.selection).toBe(false);
    expect(ids(target.records)).toEqual(['c', 'a']);
  });

  it('targets only the selection when anything is selected, in the gallery’s order', () => {
    const target = setTarget(all, [d!, c!, b!, a!], urls(a!, c!));
    expect(target.selection).toBe(true);
    expect(ids(target.records)).toEqual(['c', 'a']);
  });

  it('keeps selected entries the filters hide, after the shown ones, in index order', () => {
    const target = setTarget(all, [c!], urls(d!, c!, b!));
    expect(ids(target.records)).toEqual(['c', 'b', 'd']);
  });

  it('targets a selection even when no result is shown', () => {
    expect(ids(setTarget(all, [], urls(b!)).records)).toEqual(['b']);
  });

  it('targets nothing when nothing matches and nothing is selected', () => {
    expect(setTarget(all, [], new Set()).records).toEqual([]);
  });

  it('says what it targets', () => {
    expect(targetText(setTarget(all, all, urls(a!, b!, c!)))).toBe('3 selected');
    expect(targetText(setTarget(all, all, new Set()))).toBe('4 entries');
    expect(targetText(setTarget(all, [a!], new Set()))).toBe('1 entry');
  });
});

const lib = await fixtureLibrary();

describe('loadExportItems', () => {
  const entries = ['frost-lance', 'cinder-hound'].map((id) => lib.byId(id));
  const served = Object.fromEntries(
    entries.map(({ entry, derived }) => [bundleUrl(BASE, entry), JSON.stringify({ entry, derived })]),
  );
  const fetchFrom = (files: Record<string, string>) => async (url: string) => ({
    ok: url in files,
    status: url in files ? 200 : 404,
    text: async () => files[url] ?? '',
  });

  it('builds bundle URLs beside the raw files', () => {
    expect(bundleUrl(BASE, { ruleset: 'dnd-5e-2024', type: 'spell', id: 'frost-lance' })).toBe(
      '/ttrpg-library/data/dnd-5e-2024/spell/frost-lance.export.json',
    );
  });

  it('returns each entry with its derived values, in order', async () => {
    const items = await loadExportItems(BASE, entries.map(({ entry }) => entry), fetchFrom(served));
    expect(items).toEqual(entries.map(({ entry, derived }) => ({ entry, derived })));
  });

  it('rejects when any bundle fails to load', async () => {
    const [first] = Object.keys(served);
    const partial = Object.fromEntries(Object.entries(served).filter(([url]) => url !== first));
    await expect(loadExportItems(BASE, entries.map(({ entry }) => entry), fetchFrom(partial))).rejects.toThrow(/404/);
  });
});

describe('runSetExport (docs/export.md#exporter-interface)', () => {
  const entries = ['frost-lance', 'cinder-hound'].map((id) => lib.byId(id).entry);
  /** The gallery's records carry each entry's key, not the entry. */
  const records = entries.map((entry) => record({ id: entry.id, type: entry.type, name: entry.name }));
  const bundles = Object.fromEntries(
    ['frost-lance', 'cinder-hound'].map((id) => lib.byId(id)).map(({ entry, derived }) => [bundleUrl(BASE, entry), JSON.stringify({ entry, derived })]),
  );
  const raws = Object.fromEntries(entries.map((entry) => [rawFileUrl(BASE, entry), JSON.stringify(entry)]));
  const io = (files: Record<string, string>) => {
    const fetched: string[] = [];
    const opened: string[] = [];
    return {
      fetched,
      opened,
      io: {
        fetch: async (url: string) => {
          fetched.push(url);
          return { ok: url in files, status: url in files ? 200 : 404, text: async () => files[url] ?? '' };
        },
        open: (url: string) => void opened.push(url),
        download: () => {},
        now: () => new Date(2026, 10, 2),
      },
    };
  };

  it('marks Print and JSON as reading only entries’ keys, and the rest as reading them in full', () => {
    const keysOnly = Object.values(modules).filter((exporter) => exporter.keysOnly).map((exporter) => exporter.id);
    expect(keysOnly.sort()).toEqual(['json', 'print']);
  });

  it('runs Print on the records’ keys, fetching no bundle', async () => {
    const fake = io(bundles);
    await runSetExport(modules.print!, records, { scope: 'set', base: BASE, io: fake.io });
    expect(fake.fetched).toEqual([]);
    expect(fake.opened).toEqual(['/ttrpg-library/print/?ids=spell/frost-lance,creature/cinder-hound']);
  });

  it('runs JSON on the records’ keys, fetching only the raw files', async () => {
    const fake = io(raws);
    await runSetExport(modules.json!, records, { scope: 'set', base: BASE, io: fake.io });
    expect(fake.fetched).toEqual(Object.keys(raws));
  });

  it('fetches the bundles first for an exporter that reads entries in full', async () => {
    const fake = io(bundles);
    const report = await runSetExport(modules.open5e!, records, { scope: 'set', base: BASE, io: fake.io });
    expect(fake.fetched).toEqual(Object.keys(bundles));
    expect(report).toMatchObject({ downloaded: true });
  });

  it('runs nothing when a bundle fails to load', async () => {
    const fake = io({});
    await expect(runSetExport(modules.open5e!, records, { scope: 'set', base: BASE, io: fake.io })).rejects.toThrow(/404/);
  });
});

describe('SetActions', () => {
  const render = (target: ReturnType<typeof setTarget>) => renderToString(h(SetActions, { target, base: BASE }));

  it('shows Print and Download, each naming its target (docs/export.md#controls)', () => {
    const html = render(setTarget(all, all, urls(a!, b!)));
    expect(html).toContain('Print<span class="visually-hidden"> 2 selected</span>');
    expect(html).toContain('Download<span class="visually-hidden"> 2 selected</span>');
    expect(html.match(/<button/g)).toHaveLength(2 + configuredControls('set').downloads.length);
  });

  it('lists JSON and Open5e, and no PNG, in the Download menu, which starts closed', () => {
    const closed = render(setTarget(all, all, urls(a!, b!)));
    expect(closed).toMatch(/aria-expanded="false"[^>]*aria-controls="set-actions-formats"/);
    expect(closed).toMatch(/<ul id="set-actions-formats"[^>]*hidden/);
    const open = renderToString(h(SetActions, { target: setTarget(all, all, urls(a!, b!)), base: BASE, open: true }));
    expect(open).toMatch(/aria-expanded="true"/);
    expect(open).not.toMatch(/<ul id="set-actions-formats"[^>]*hidden/);
    const formats = [...open.matchAll(/class="menu-button__item">([^<]+)</g)].map((m) => m[1]);
    expect(formats).toEqual(['JSON', 'Open5e']);
  });

  it('has no page size selector: the reader picks the paper in the print dialog (docs/export.md#print-layout)', () => {
    const html = render(setTarget(all, all, new Set()));
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Page size');
  });

  it('disables the actions when they would target nothing', () => {
    const html = render(setTarget(all, [], new Set()));
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(2); // Print and Download; the menu stays closed
    expect(render(setTarget(all, all, new Set()))).not.toMatch(/<button[^>]*disabled/);
  });

  it('reports failures in a polite status region', () => {
    expect(render(setTarget(all, all, new Set()))).toContain('role="status"');
  });
});
