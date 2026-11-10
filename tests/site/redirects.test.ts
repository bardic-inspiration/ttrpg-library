// Former type keys (docs/site.md#redirects): old URLs, print keys, and type filters keep working.
import { describe, expect, it } from 'vitest';
import { galleryConfig } from '../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../site/src/lib/gallery/state.ts';
import { selectEntries } from '../../site/src/lib/print-run.ts';
import { parsePrintQuery } from '../../site/src/lib/print.ts';
import { libraryQuery } from '../../site/src/lib/gallery/library-url.ts';
import { currentKey, formerTypes, redirectScript, typeAliases } from '../../site/src/lib/redirects.ts';
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
    const home = galleryConfig(reg);
    expect(parseQuery('?f.type=magic-item', home).filters.get('type')).toEqual({ kind: 'enum', values: ['item'] });
    expect(selectEntries(parsePrintQuery('?f.type=magic-item'), records, reg).records.map((r) => r.id)).toEqual([
      'wand-of-frost-lances',
    ]);
  });
});

describe('redirect pages', () => {
  type Page = { getStaticPaths: (options: never) => Promise<unknown> | unknown };
  type Paths = { params: Record<string, string>; props: { moved?: string | { to: string } } }[];
  const paths = async (page: Promise<unknown>) => ((await ((await page) as Page).getStaticPaths({} as never)) as Paths);

  it('cover every old detail URL of a renamed type', async () => {
    const detailPaths = await paths(import('../../site/src/pages/[ruleset]/[type]/[id].astro'));
    const items = detailPaths.filter((p) => p.params.type === 'item');
    const moved = detailPaths.filter((p) => p.params.type === 'magic-item');
    expect(items.length).toBeGreaterThan(0);
    expect(moved.map((p) => p.params.id).sort()).toEqual(items.map((p) => p.params.id).sort());
    const wand = moved.find((p) => p.params.id === 'wand-of-wonder')!;
    expect((wand.props.moved as { to: string }).to).toMatch(/\/dnd-5e-2024\/item\/wand-of-wonder\/$/);
  }, 30_000);

  it('send every old gallery to the Library with its filter: a ruleset, a type, and a former type', async () => {
    const rulesetPaths = await paths(import('../../site/src/pages/[ruleset]/index.astro'));
    expect(rulesetPaths.map((p) => [p.params.ruleset, p.props.moved])).toEqual([['dnd-5e-2024', '/?f.ruleset=dnd-5e-2024']]);
    const typePaths = await paths(import('../../site/src/pages/[ruleset]/[type]/index.astro'));
    const moved = (type: string) => typePaths.find((p) => p.params.type === type)?.props.moved;
    for (const type of Object.keys(reg['dnd-5e-2024']!.types)) expect(moved(type), type).toBe(`/${libraryQuery(reg, 'dnd-5e-2024', type)}`);
    expect(moved('creature')).toBe('/?sort=stats.cr:asc&f.ruleset=dnd-5e-2024&f.type=creature');
    expect(moved('magic-item')).toBe(moved('item'));
    expect(moved('item')).toMatch(/f\.type=item$/);
  });

  it('the Library reads a redirect’s query as the old gallery’s view', () => {
    const state = parseQuery(libraryQuery(reg, 'dnd-5e-2024', 'creature'), galleryConfig(reg));
    expect(state.sort).toEqual({ path: 'stats.cr', dir: 'asc' });
    expect([...state.filters]).toEqual([
      ['ruleset', { kind: 'enum', values: ['dnd-5e-2024'] }],
      ['type', { kind: 'enum', values: ['creature'] }],
    ]);
  });
});

describe('the redirect script', () => {
  const run = (to: string, search: string, hash = '') => {
    let went = '';
    new Function('location', redirectScript(to))({ search, hash, replace: (next: string) => (went = next) });
    return went;
  };

  it('adds the old URL’s query after the new one’s, so the reader’s parameters win, and keeps the fragment', () => {
    expect(run('/ttrpg-library/dnd-5e-2024/item/wand/', '?x=1', '#a')).toBe('/ttrpg-library/dnd-5e-2024/item/wand/?x=1#a');
    expect(run('/ttrpg-library/?f.type=creature', '?f.stats.cr=2..8&sort=name:desc')).toBe(
      '/ttrpg-library/?f.type=creature&f.stats.cr=2..8&sort=name:desc',
    );
    expect(run('/ttrpg-library/?f.type=creature', '')).toBe('/ttrpg-library/?f.type=creature');
    const state = parseQuery('?sort=stats.cr:asc&f.type=creature&sort=name:desc', galleryConfig(reg));
    expect(state.sort).toEqual({ path: 'name', dir: 'desc' });
  });
});
