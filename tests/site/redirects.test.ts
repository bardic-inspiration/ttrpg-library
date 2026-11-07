// Former type keys (docs/site.md#redirects): old URLs, print keys, and type filters keep working.
import { describe, expect, it } from 'vitest';
import { galleryConfig } from '../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../site/src/lib/gallery/state.ts';
import { selectEntries } from '../../site/src/lib/print-run.ts';
import { parsePrintQuery } from '../../site/src/lib/print.ts';
import { currentKey, formerTypes, typeAliases } from '../../site/src/lib/redirects.ts';
import { fixtureRecords, registry } from './gallery/helpers.ts';

const reg = await registry();
const records = await fixtureRecords();

describe('former type keys', () => {
  it('come from the registry: magic-item is now item', () => {
    expect(formerTypes(reg)).toEqual([{ ruleset: 'dnd-5e-2024', from: 'magic-item', to: 'item' }]);
    expect(typeAliases(reg, 'dnd-5e-2024')).toEqual({ 'magic-item': 'item' });
    expect(typeAliases(reg, 'another-ruleset')).toEqual({});
  });

  it('map an old entry key to the current one and leave others alone', () => {
    const aliases = typeAliases(reg);
    expect(currentKey('magic-item/wand-of-frost-lances', aliases)).toBe('item/wand-of-frost-lances');
    expect(currentKey('spell/frost-lance', aliases)).toBe('spell/frost-lance');
    expect(currentKey('no-slash', aliases)).toBe('no-slash');
  });

  it('let an old print key print the entry', () => {
    const selection = selectEntries(parsePrintQuery('?ids=magic-item/wand-of-frost-lances'), records, reg);
    expect(selection.records.map((r) => `${r.type}/${r.id}`)).toEqual(['item/wand-of-frost-lances']);
    expect(selection.missing).toEqual([]);
  });

  it('let an old type filter select the renamed type', () => {
    const home = galleryConfig(reg, {});
    expect(parseQuery('?f.type=magic-item', home).filters.get('type')).toEqual({ kind: 'enum', values: ['item'] });
    expect(selectEntries(parsePrintQuery('?f.type=magic-item'), records, reg).records.map((r) => r.id)).toEqual([
      'wand-of-frost-lances',
    ]);
  });
});

describe('redirect pages', () => {
  it('cover every old detail and gallery URL of a renamed type', async () => {
    type Page = { getStaticPaths: (options: never) => Promise<unknown> | unknown };
    const detail = (await import('../../site/src/pages/[ruleset]/[type]/[id].astro')) as unknown as Page;
    const gallery = (await import('../../site/src/pages/[ruleset]/[type]/index.astro')) as unknown as Page;
    const detailPaths = (await detail.getStaticPaths({} as never)) as { params: Record<string, string>; props: { moved?: { to: string } } }[];
    const items = detailPaths.filter((p) => p.params.type === 'item');
    const moved = detailPaths.filter((p) => p.params.type === 'magic-item');
    expect(items.length).toBeGreaterThan(0);
    expect(moved.map((p) => p.params.id).sort()).toEqual(items.map((p) => p.params.id).sort());
    const wand = moved.find((p) => p.params.id === 'wand-of-wonder')!;
    expect(wand.props.moved?.to).toMatch(/\/dnd-5e-2024\/item\/wand-of-wonder\/$/);
    const galleryPaths = (await gallery.getStaticPaths({} as never)) as { params: Record<string, string>; props: { moved?: string } }[];
    expect(galleryPaths.find((p) => p.params.type === 'magic-item')?.props.moved).toMatch(/\/dnd-5e-2024\/item\/$/);
  });
});
