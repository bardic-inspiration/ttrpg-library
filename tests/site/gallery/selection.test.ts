// Gallery set actions (SPEC.md §9.3 "Selection", §10.1): which entries a set
// action receives, and the export bundles it loads for them.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import SetActions from '../../../site/src/components/gallery/SetActions.tsx';
import { configuredExporters } from '../../../site/src/exporters/index.ts';
import { bundleUrl, loadExportItems } from '../../../site/src/exporters/io.ts';
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

describe('SetActions', () => {
  const render = (target: ReturnType<typeof setTarget>) => renderToString(h(SetActions, { target, base: BASE }));

  it('offers one button per configured set-scope exporter, naming its target', () => {
    const html = render(setTarget(all, all, urls(a!, b!)));
    const labels = configuredExporters('set').map((e) => e.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(html).toContain(`${label}<span class="visually-hidden"> 2 selected</span>`);
    expect(html).not.toContain('Download PNG');
  });

  it('puts a page size selector beside an exporter that takes one', () => {
    expect(render(setTarget(all, all, new Set()))).toContain('Page size for Print');
  });

  it('disables the actions when they would target nothing', () => {
    const html = render(setTarget(all, [], new Set()));
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(configuredExporters('set').length);
    expect(render(setTarget(all, all, new Set()))).not.toMatch(/<button[^>]*disabled/);
  });

  it('reports failures in a polite status region', () => {
    expect(render(setTarget(all, all, new Set()))).toContain('role="status"');
  });
});
