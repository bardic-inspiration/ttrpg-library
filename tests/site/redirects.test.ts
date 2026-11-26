// Former type keys (docs/site.md#redirects): old URLs, print keys, and type filters keep working.
import { describe, expect, it } from 'vitest';
import { NO_FACET_DATA, galleryConfig } from '../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../site/src/lib/gallery/state.ts';
import { selectEntries } from '../../site/src/lib/print-run.ts';
import { parsePrintQuery } from '../../site/src/lib/print.ts';
import { homeRuleset, homeScript, libraryQuery, pageRuleset } from '../../site/src/lib/gallery/library-url.ts';
import { currentKey, formerTypes, redirectScript, typeAliases } from '../../site/src/lib/redirects.ts';
import { fixtureRecords, registry, whole } from './gallery/helpers.ts';

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
    const selection = selectEntries(parsePrintQuery('?ids=magic-item/wand-of-frost-lances'), records, reg, NO_FACET_DATA);
    expect(selection.records.map((r) => `${r.type}/${r.id}`)).toEqual(['item/wand-of-frost-lances']);
    expect(selection.missing).toEqual([]);
  });

  it('let an old type filter select the renamed type', () => {
    const home = galleryConfig(reg);
    expect(parseQuery('?f.type=magic-item', home).filters.get('type')).toEqual({ kind: 'enum', values: ['dnd-5e-2024/item'] });
    expect(selectEntries(parsePrintQuery(whole('?f.type=magic-item')), records, reg, NO_FACET_DATA).records.map((r) => r.id)).toEqual([
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

  it('give each ruleset its Library page, and send every old type gallery to it with its filter: a type and a former type', async () => {
    const rulesetPaths = await paths(import('../../site/src/pages/[ruleset]/index.astro'));
    expect(rulesetPaths.map((p) => [p.params.ruleset, p.props.moved])).toEqual([['dnd-5e-2024', undefined]]);
    const typePaths = await paths(import('../../site/src/pages/[ruleset]/[type]/index.astro'));
    const moved = (type: string) => typePaths.find((p) => p.params.type === type)?.props.moved;
    for (const type of Object.keys(reg['dnd-5e-2024']!.types)) expect(moved(type), type).toBe(`/dnd-5e-2024/${libraryQuery(reg, 'dnd-5e-2024', type)}`);
    expect(moved('creature')).toBe('/dnd-5e-2024/?sort=stats.cr:asc&f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/creature');
    expect(moved('magic-item')).toBe(moved('item'));
    expect(moved('item')).toMatch(/f\.type=dnd-5e-2024\/item$/);
  });

  it('the Library reads a redirect’s query as the old gallery’s view', () => {
    const state = parseQuery(libraryQuery(reg, 'dnd-5e-2024', 'creature'), galleryConfig(reg));
    expect(state.sort).toEqual({ path: 'stats.cr', dir: 'asc' });
    expect([...state.filters]).toEqual([
      ['ruleset', { kind: 'enum', values: ['dnd-5e-2024'] }],
      ['type', { kind: 'enum', values: ['dnd-5e-2024/creature'] }],
    ]);
  });
});

describe('the home URL (docs/site.md#redirects)', () => {
  const two = { ...reg, other: { ...reg['dnd-5e-2024']!, label: 'Other' } } as typeof reg;
  const run = (search: string, hash = '') => {
    let went = '';
    new Function('location', homeScript('/ttrpg-library/', two))({ search, hash, replace: (next: string) => (went = next) });
    return went;
  };

  it('opens the home ruleset’s Library, the registry’s first, with the query and fragment', () => {
    expect(homeRuleset(reg)).toBe('dnd-5e-2024');
    expect(run('')).toBe('/ttrpg-library/dnd-5e-2024/');
    expect(run('?q=frost', '#x')).toBe('/ttrpg-library/dnd-5e-2024/?q=frost#x');
  });

  it('opens the Library of the ruleset an old link’s f.ruleset names first, when it is registered', () => {
    expect(run('?f.ruleset=other&f.type=other/spell')).toBe('/ttrpg-library/other/?f.ruleset=other&f.type=other/spell');
    expect(run('?f.ruleset=Other,dnd-5e-2024')).toBe('/ttrpg-library/other/?f.ruleset=Other,dnd-5e-2024');
    expect(run('?f.ruleset=gone')).toBe('/ttrpg-library/dnd-5e-2024/?f.ruleset=gone');
    expect(run('?f.ruleset=')).toBe('/ttrpg-library/dnd-5e-2024/?f.ruleset=');
  });

  it('knows a page’s ruleset by its first path segment', () => {
    expect(pageRuleset(reg, 'dnd-5e-2024/spell/fireball/')).toBe('dnd-5e-2024');
    expect(pageRuleset(reg, 'dnd-5e-2024/')).toBe('dnd-5e-2024');
    expect(pageRuleset(reg, 'about/')).toBeUndefined();
    expect(pageRuleset(reg, '')).toBeUndefined();
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
