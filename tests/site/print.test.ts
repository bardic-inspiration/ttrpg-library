// The print view and print export (docs/export.md#print, docs/export.md#exporter-interface): query parsing,
// entry selection, the injected `@page` rules, the width breakpoint, loading a
// run, the print fragment, and the print exporter.
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { print } from '../../site/src/exporters/print.ts';
import type { ExportItem } from '../../site/src/exporters/types.ts';
import { facetData } from '../../site/src/lib/gallery/facet-data.ts';
import { loadPrintRun, selectEntries } from '../../site/src/lib/print-run.ts';
import { loadRules } from '../../site/src/lib/rules.ts';
import { readTokens, tokensIn } from '../../site/src/lib/design-tokens.ts';
import {
  SHORT_ATTRIBUTION,
  cssString,
  fragmentUrl,
  pageRules,
  parsePrintQuery,
  printUrl,
} from '../../site/src/lib/print.ts';
import { fixtureRecords, record, registry, whole } from './gallery/helpers.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const BASE = '/ttrpg-library/';
const records = await fixtureRecords();
const reg = await registry();
const lib = await fixtureLibrary();
// The facet data the build gives the print view: ref names and every grouped type's groups.
const rules = loadRules();
const data = facetData(reg, lib.all, lib.names, rules);

describe('parsePrintQuery', () => {
  it('reads <type>/<id> keys in order, without repeats or blanks', () => {
    const query = parsePrintQuery('?ids=spell/frost-lance,creature/cinder-hound,spell/frost-lance,,');
    expect(query.ids).toEqual(['spell/frost-lance', 'creature/cinder-hound']);
  });

  it('takes no page size: the query carries none', () => {
    expect(Object.keys(parsePrintQuery('?ids=a'))).toEqual(['ids', 'gallery']);
  });

  it('accepts percent-encoded commas between ids', () => {
    expect(parsePrintQuery('?ids=a%2Cb').ids).toEqual(['a', 'b']);
  });

  it('keeps the rest of the query as the gallery query when ids is absent', () => {
    const query = parsePrintQuery('?f.type=spell&sort=name:asc');
    expect(query.ids).toBeUndefined();
    expect(query.gallery).toBe('f.type=spell&sort=name:asc');
  });
});

describe('print layout by printed page width (docs/export.md#print-layout)', async () => {
  const tokens = await readFile(new URL('../../site/src/styles/tokens/print.css', import.meta.url), 'utf8');
  const queries = [...tokens.matchAll(/@media ([^{]+)\{/g)].map((m) => m[1]!.trim());

  it('switches layout at one width breakpoint, kept in tokens/print.css', () => {
    expect(queries).toEqual(['print and (width < 6.5in)']);
    expect(tokens).not.toContain('data-page-size');
  });

  it('sets two columns on a wide page and one with smaller type on a narrow one', () => {
    const value = (name: string) => Number(tokens.match(new RegExp(`--print-${name}:\\s*([\\d.]+)`))?.[1]);
    expect(value('wide-columns')).toBe(2);
    expect(value('narrow-columns')).toBe(1);
    expect(value('narrow-font-size')).toBeLessThan(value('wide-font-size'));
  });

  it('gives a narrow page a narrower margin', () => {
    const narrow = tokens.slice(tokens.indexOf('@media print'));
    expect(tokens.slice(0, tokens.indexOf('@media print'))).toMatch(/@page \{\s*margin: 0\.5in;/);
    expect(narrow).toMatch(/@page \{\s*margin: 0\.3in;/);
  });
});

describe('selectEntries', () => {
  it('keeps the order of ids and reports ids no entry has', () => {
    const selection = selectEntries(parsePrintQuery('?ids=spell/frost-lance,spell/nope,creature/cinder-hound'), records, reg, data);
    expect(selection.records.map((r) => r.id)).toEqual(['frost-lance', 'cinder-hound']);
    expect(selection.missing).toEqual(['spell/nope']);
  });

  it('tells apart entries of different types that share an id (docs/content-model.md#ids-and-names)', () => {
    const twin = { ...records.find((r) => r.id === 'frost-lance')!, type: 'creature', name: 'Frost Lance', url: '/ttrpg-library/dnd-5e-2024/creature/frost-lance/' };
    const selection = selectEntries(parsePrintQuery('?ids=creature/frost-lance'), [...records, twin], reg, data);
    expect(selection.records.map((r) => `${r.type}/${r.id}`)).toEqual(['creature/frost-lance']);
  });

  it('reads a gallery query as the Library’s, with f.type narrowing by type', () => {
    expect(selectEntries(parsePrintQuery(whole('?f.type=spell')), records, reg, data).records.map((r) => r.id)).toEqual(['frost-lance']);
    expect(selectEntries(parsePrintQuery(whole('?f.stats.cr=1..5')), records, reg, data).records.map((r) => r.id)).toEqual(['cinder-hound']);
  });

  it('ignores a stale size parameter from an older print link', () => {
    const ids = (q: string) => selectEntries(parsePrintQuery(whole(q)), records, reg, data).records.map((r) => r.id);
    expect(ids('?ids=spell/frost-lance&size=a4')).toEqual(['frost-lance']);
    expect(ids('?f.type=spell&size=card-4x6')).toEqual(ids('?f.type=spell'));
  });

  it('prints a gallery query’s results in its order', () => {
    const names = (q: string) => selectEntries(parsePrintQuery(whole(q)), records, reg, data).records.map((r) => r.name);
    expect(names('?sort=name:asc')).toEqual(['Cinder Hound', 'Frost Lance', 'Sorcerer', 'Wand of Frost Lances', 'Wizard']);
    expect(names('?sort=name:desc')).toEqual(['Wizard', 'Wand of Frost Lances', 'Sorcerer', 'Frost Lance', 'Cinder Hound']);
  });

  it('matches a group filter by the groups in it, as the gallery does (docs/site.md#gallery "Filters")', () => {
    const gear = [
      record({ id: 'longsword-plus', type: 'equipment', facets: { 'stats.group': 'martial-melee-weapons' } }),
      record({ id: 'sling-plus', type: 'equipment', facets: { 'stats.group': 'simple-ranged-weapons' } }),
    ];
    const ids = (q: string) => selectEntries(parsePrintQuery(whole(q)), gear, reg, data).records.map((r) => r.id);
    expect(ids('?f.stats.group=martial-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=weapons')).toEqual(['longsword-plus', 'sling-plus']);
  });

  it('sorts by a ref facet by its targets’ names, in the gallery’s order', () => {
    const subclasses = [
      record({ id: 'path-of-a', type: 'subclass', name: 'Path of A', facets: { 'stats.class': 'class/aardvark' } }),
      record({ id: 'path-of-z', type: 'subclass', name: 'Path of Z', facets: { 'stats.class': 'class/zebra' } }),
    ];
    const names = { names: { 'class/aardvark': 'Zealot', 'class/zebra': 'Abjurer' }, groups: {}, publishers: {}, chips: {} };
    const ids = selectEntries(parsePrintQuery(whole('?sort=stats.class:asc')), subclasses, reg, names).records.map((r) => r.id);
    expect(ids).toEqual(['path-of-z', 'path-of-a']);
  });
});

describe('URLs', () => {
  it('serve each entry’s print fragment beside its detail path', () => {
    expect(fragmentUrl(BASE, record({ id: 'cinder-hound' }))).toBe('/ttrpg-library/print/dnd-5e-2024/creature/cinder-hound/');
  });

  it('build a print view URL with ids and no size', () => {
    expect(printUrl(BASE, ['creature/cinder-hound', 'spell/frost-lance'])).toBe('/ttrpg-library/print/?ids=creature/cinder-hound,spell/frost-lance');
  });
});

describe('pageRules', () => {
  it('puts the short attribution in every page’s footer and sets no page size or margin', () => {
    const css = pageRules();
    expect(css).toMatch(/^@page \{ @bottom-right \{ content: "Includes adapted SRD 5\.2 material, CC-BY-4\.0";/);
    expect(css).toContain(`"${SHORT_ATTRIBUTION}"`);
    expect(css).not.toMatch(/[{;]\s*(size|margin):/);
  });

  it('stacks entries on shared pages: one page rule, no named pages, the footer carrying only the attribution', () => {
    const css = pageRules();
    expect(css.match(/@page/g)).toHaveLength(1);
    expect(css).not.toContain('@bottom-left');
    expect(css).not.toContain('.site-footer');
  });

  it('escapes footer text as CSS strings', () => {
    expect(cssString('The "Ash" \\ Hound\n')).toBe('"The \\"Ash\\" \\\\ Hound "');
  });
});

describe('loadPrintRun', () => {
  const site = (overrides: Record<string, string | undefined> = {}, index = records) => {
    const files: Record<string, string | undefined> = {
      [`${BASE}library.json`]: JSON.stringify(index),
      ...Object.fromEntries(index.map((r) => [fragmentUrl(BASE, r), `<article class="print-entry" data-id="${r.id}"></article>`])),
      ...overrides,
    };
    const fetched: string[] = [];
    const fetch = async (url: string) => {
      fetched.push(url);
      const body = files[url];
      return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body ?? '' };
    };
    return { fetch, fetched };
  };

  it('fetches only the named entries’ fragments, in order', async () => {
    const { fetch, fetched } = site();
    const run = await loadPrintRun('?ids=spell/frost-lance,creature/cinder-hound', BASE, reg, data, fetch);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect('size' in run).toBe(false);
    expect(run.fragments.map((f) => f.record.id)).toEqual(['frost-lance', 'cinder-hound']);
    expect(run.fragments[0]!.html).toContain('data-id="frost-lance"');
    expect(fetched).toEqual([
      `${BASE}library.json`,
      '/ttrpg-library/print/dnd-5e-2024/spell/frost-lance/',
      '/ttrpg-library/print/dnd-5e-2024/creature/cinder-hound/',
    ]);
  });

  it('reads a gallery query with the facet data it’s given, so a group filter prints its entries', async () => {
    const gear = [
      record({ id: 'longsword-plus', type: 'equipment', facets: { 'stats.group': 'martial-melee-weapons' } }),
      record({ id: 'rope-plus', type: 'equipment', facets: { 'stats.group': 'adventuring-gear' } }),
    ];
    const run = await loadPrintRun(whole('?f.stats.group=martial-weapons'), BASE, reg, data, site({}, gear).fetch);
    expect(run.ok && run.fragments.map((f) => f.record.id)).toEqual(['longsword-plus']);
  });

  it('fails with a message when an id has no entry', async () => {
    const run = await loadPrintRun('?ids=creature/cinder-hound,creature/nope', BASE, reg, data, site().fetch);
    expect(run).toMatchObject({ ok: false, message: 'No entry matches “creature/nope”.' });
  });

  it('fails with a message when a fragment fails to load', async () => {
    const run = await loadPrintRun('?ids=creature/cinder-hound,spell/frost-lance', BASE, reg, data, site({ [fragmentUrl(BASE, records.find((r) => r.id === 'frost-lance')!)]: undefined }).fetch);
    expect(run).toMatchObject({ ok: false, message: 'Frost Lance couldn’t be loaded. Try reloading the page.' });
  });

  it('fails with a message when the index fails to load, or nothing matches', async () => {
    expect(await loadPrintRun('?ids=a', BASE, reg, data, site({ [`${BASE}library.json`]: undefined }).fetch)).toMatchObject({ ok: false });
    expect(await loadPrintRun('?ids=', BASE, reg, data, site().fetch)).toMatchObject({ ok: false, message: 'No entries to print.' });
    expect(await loadPrintRun('?q=zzzzqqq', BASE, reg, data, site().fetch)).toMatchObject({ ok: false, message: 'No entries to print.' });
  });
});

describe('print fragment (docs/export.md#print)', () => {
  it('renders the template in print mode, with no page shell', async () => {
    const { experimental_AstroContainer: AstroContainer } = await import('astro/container');
    const { default: PrintEntry } = await import('../../site/src/components/print/PrintEntry.astro');
    const container = await AstroContainer.create();
    const html = await container.renderToString(PrintEntry, { props: { loaded: lib.byId('cinder-hound'), names: lib.names } });
    expect(html).toMatch(/^\s*<article class="print-entry[^"]*" data-id="cinder-hound" data-name="Cinder Hound" data-type="creature"/);
    expect(html).toContain('data-mode="print"');
    expect(html).toMatch(/<h2[^>]*>Cinder Hound<\/h2>/);
    expect(html).not.toContain('<html');
  });
});

describe('print exporter (docs/export.md#exporter-interface, docs/export.md#print)', () => {
  const item = (id: string): ExportItem => {
    const { entry, derived } = lib.byId(id);
    return { entry, derived };
  };
  const opened = () => {
    const urls: string[] = [];
    return { urls, io: { open: (url: string) => void urls.push(url) } };
  };

  it('offers entry and set scope and takes no page size', () => {
    expect(print.scopes).toEqual(['entry', 'set']);
    expect('pageSize' in print).toBe(false);
  });

  it('opens the print view for one entry', async () => {
    const fake = opened();
    await print.run([item('cinder-hound')], { scope: 'entry', base: BASE, io: fake.io });
    expect(fake.urls).toEqual(['/ttrpg-library/print/?ids=creature/cinder-hound']);
  });

  it('opens the print view for a set, in order', async () => {
    const fake = opened();
    await print.run([item('frost-lance'), item('cinder-hound')], { scope: 'set', base: BASE, io: fake.io });
    expect(fake.urls).toEqual(['/ttrpg-library/print/?ids=spell/frost-lance,creature/cinder-hound']);
  });

  it('rejects an empty set and more than one entry in entry scope', async () => {
    const fake = opened();
    await expect(print.run([], { scope: 'set', base: BASE, io: fake.io })).rejects.toThrow(/at least one/);
    await expect(print.run([item('cinder-hound'), item('frost-lance')], { scope: 'entry', base: BASE, io: fake.io })).rejects.toThrow(/exactly one/);
    expect(fake.urls).toEqual([]);
  });
});

// Print uses fixed point sizes (docs/export.md#print-layout). A custom property resolves where
// it's declared, so a component size token declared on :root as a text role keeps the screen
// size unless the print entry declares it again.
describe('print sizes (docs/export.md#print-layout)', async () => {
  const site = new URL('../../site/src/', import.meta.url).pathname;
  const printEntry = await readFile(`${site}components/print/PrintEntry.astro`, 'utf8');
  const style = printEntry.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const scoped = new Map(readTokens(style).map((d) => [d.name, d.value]));
  const components = tokensIn(readTokens(await readFile(`${site}styles/tokens/components.css`, 'utf8')), 'base');
  const textSized = [...components].filter(([, value]) => /^var\(--text-[a-z0-9-]+\)$/.test(value)).map(([name]) => name);

  // Follows var() through the print entry's own declarations to the first value it doesn't set.
  const resolve = (name: string): string => {
    const value = scoped.get(name);
    const ref = value?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
    return ref && scoped.has(ref) ? resolve(ref) : (value ?? '');
  };

  it('finds the component size tokens built on text roles', () => {
    expect(textSized).toEqual(expect.arrayContaining(['--statblock-title-size', '--statblock-heading-size', '--card-title-size']));
  });

  it.each(['--text-body', '--text-small', '--text-h3', '--text-h4', '--text-h5', '--text-h6'])('maps the text role %s to a print size', (name) => {
    expect(resolve(name)).toMatch(/^var\(--print-[a-z-]+-size\)$/);
  });

  it('maps every component size token built on a text role to the print size of that role', () => {
    for (const name of textSized) {
      const role = components.get(name)!.match(/--text-[a-z0-9-]+/)![0];
      expect({ name, value: resolve(name) }).toEqual({ name, value: resolve(role) || 'a print size' });
    }
  });
});
