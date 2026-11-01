// The print view and print export (SPEC.md §10.4, §10.1): query parsing, page
// size resolution, entry selection, the injected `@page` rules, loading a run,
// the print fragment, and the print exporter.
import { describe, expect, it } from 'vitest';
import config from '../../config/export.json' with { type: 'json' };
import { print } from '../../site/src/exporters/print.ts';
import type { ExportItem } from '../../site/src/exporters/types.ts';
import { loadPrintRun, selectEntries } from '../../site/src/lib/print-run.ts';
import {
  SHORT_ATTRIBUTION,
  cssString,
  fragmentUrl,
  pageRules,
  pageSizes,
  parsePrintQuery,
  printUrl,
  resolveSize,
} from '../../site/src/lib/print.ts';
import { fixtureRecords, record, registry } from './gallery/helpers.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const BASE = '/ttrpg-library/';
const records = await fixtureRecords();
const reg = await registry();
const lib = await fixtureLibrary();
const size = (id: string) => resolveSize(id);

describe('page sizes (SPEC.md §10.4, §10.5)', () => {
  it('come from config/export.json', () => {
    expect(pageSizes).toEqual(config.pageSizes);
  });

  it('resolve by id, falling back to the default for a missing or unknown id', () => {
    expect(resolveSize('a4').id).toBe('a4');
    expect(resolveSize('card-4x6').id).toBe('card-4x6');
    expect(resolveSize(undefined).id).toBe('letter');
    expect(resolveSize(null).id).toBe('letter');
    expect(resolveSize('tabloid').id).toBe('letter');
  });
});

describe('parsePrintQuery', () => {
  it('reads ids in order, without repeats or blanks, and the size', () => {
    const query = parsePrintQuery('?ids=frost-lance,cinder-hound,frost-lance,,&size=a4');
    expect(query.ids).toEqual(['frost-lance', 'cinder-hound']);
    expect(query.size.id).toBe('a4');
  });

  it('accepts percent-encoded commas between ids', () => {
    expect(parsePrintQuery('?ids=a%2Cb').ids).toEqual(['a', 'b']);
  });

  it('keeps the rest of the query as the gallery query when ids is absent', () => {
    const query = parsePrintQuery('?f.type=spell&size=half-letter&sort=name:asc');
    expect(query.ids).toBeUndefined();
    expect(query.size.id).toBe('half-letter');
    expect(query.gallery).toBe('f.type=spell&sort=name:asc');
  });

  it('defaults the size when it is missing or unknown', () => {
    expect(parsePrintQuery('?ids=a').size.id).toBe('letter');
    expect(parsePrintQuery('?ids=a&size=legal').size.id).toBe('letter');
  });
});

describe('selectEntries', () => {
  it('keeps the order of ids and reports ids no entry has', () => {
    const selection = selectEntries(parsePrintQuery('?ids=frost-lance,nope,cinder-hound'), records, reg);
    expect(selection.records.map((r) => r.id)).toEqual(['frost-lance', 'cinder-hound']);
    expect(selection.missing).toEqual(['nope']);
  });

  it('reads a gallery query as the home gallery’s, with f.type narrowing by type', () => {
    expect(selectEntries(parsePrintQuery('?f.type=spell'), records, reg).records.map((r) => r.id)).toEqual(['frost-lance']);
    expect(selectEntries(parsePrintQuery('?f.stats.cr=1..5'), records, reg).records.map((r) => r.id)).toEqual(['cinder-hound']);
  });

  it('prints a gallery query’s results in its order', () => {
    const names = (q: string) => selectEntries(parsePrintQuery(q), records, reg).records.map((r) => r.name);
    expect(names('?sort=name:asc')).toEqual(['Cinder Hound', 'Frost Lance', 'Wand of Frost Lances']);
    expect(names('?sort=name:desc')).toEqual(['Wand of Frost Lances', 'Frost Lance', 'Cinder Hound']);
  });
});

describe('URLs', () => {
  it('serve each entry’s print fragment beside its detail path', () => {
    expect(fragmentUrl(BASE, record({ id: 'cinder-hound' }))).toBe('/ttrpg-library/print/dnd-5e-2024/creature/cinder-hound/');
  });

  it('build a print view URL with ids and an optional size', () => {
    expect(printUrl(BASE, ['cinder-hound', 'frost-lance'], 'a4')).toBe('/ttrpg-library/print/?ids=cinder-hound,frost-lance&size=a4');
    expect(printUrl(BASE, ['cinder-hound'])).toBe('/ttrpg-library/print/?ids=cinder-hound');
  });
});

describe('pageRules', () => {
  it('sets the chosen size and margin with the short attribution in every page’s footer', () => {
    const css = pageRules(size('a4'), ['Cinder Hound'], false);
    expect(css).toMatch(/^@page \{ size: 210mm 297mm; margin: 12mm; @bottom-right \{ content: "Includes SRD 5\.2 material, CC-BY-4\.0";/);
    expect(css).toContain(`"${SHORT_ATTRIBUTION}"`);
  });

  it('gives each entry a named page whose footer carries its name, with the site footer on the last', () => {
    const css = pageRules(size('letter'), ['Cinder Hound', 'Frost Lance'], false);
    expect(css).toContain('@page entry-1 { @bottom-left { content: "Cinder Hound";');
    expect(css).toContain('@page entry-2 { @bottom-left { content: "Frost Lance";');
    expect(css).toContain('.site-footer { page: entry-2; }');
  });

  it('packs entries onto shared pages in continuous mode, with only the attribution in the footer', () => {
    const css = pageRules(size('card-4x6'), ['Cinder Hound', 'Frost Lance'], true);
    expect(css).toMatch(/^@page \{ size: 4in 6in; margin: 0\.25in;/);
    expect(css).not.toContain('entry-1');
    expect(css).not.toContain('.site-footer');
  });

  it('escapes names as CSS strings', () => {
    expect(cssString('The "Ash" \\ Hound\n')).toBe('"The \\"Ash\\" \\\\ Hound "');
    expect(pageRules(size('letter'), ['Say "hi"'], false)).toContain('content: "Say \\"hi\\"";');
  });
});

describe('loadPrintRun', () => {
  const site = (overrides: Record<string, string | undefined> = {}) => {
    const files: Record<string, string | undefined> = {
      [`${BASE}library.json`]: JSON.stringify(records),
      ...Object.fromEntries(records.map((r) => [fragmentUrl(BASE, r), `<article class="print-entry" data-id="${r.id}"></article>`])),
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

  it('fetches only the named entries’ fragments, in order, at the chosen size', async () => {
    const { fetch, fetched } = site();
    const run = await loadPrintRun('?ids=frost-lance,cinder-hound&size=half-letter', BASE, reg, fetch);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.size.id).toBe('half-letter');
    expect(run.fragments.map((f) => f.record.id)).toEqual(['frost-lance', 'cinder-hound']);
    expect(run.fragments[0]!.html).toContain('data-id="frost-lance"');
    expect(fetched).toEqual([
      `${BASE}library.json`,
      '/ttrpg-library/print/dnd-5e-2024/spell/frost-lance/',
      '/ttrpg-library/print/dnd-5e-2024/creature/cinder-hound/',
    ]);
  });

  it('fails with a message when an id has no entry', async () => {
    const run = await loadPrintRun('?ids=cinder-hound,nope', BASE, reg, site().fetch);
    expect(run).toMatchObject({ ok: false, message: 'No entry has the id “nope”.' });
  });

  it('fails with a message when a fragment fails to load', async () => {
    const run = await loadPrintRun('?ids=cinder-hound,frost-lance', BASE, reg, site({ [fragmentUrl(BASE, records.find((r) => r.id === 'frost-lance')!)]: undefined }).fetch);
    expect(run).toMatchObject({ ok: false, message: 'Frost Lance couldn’t be loaded. Try reloading the page.' });
  });

  it('fails with a message when the index fails to load, or nothing matches', async () => {
    expect(await loadPrintRun('?ids=a', BASE, reg, site({ [`${BASE}library.json`]: undefined }).fetch)).toMatchObject({ ok: false });
    expect(await loadPrintRun('?ids=', BASE, reg, site().fetch)).toMatchObject({ ok: false, message: 'No entries to print.' });
    expect(await loadPrintRun('?q=zzzzqqq', BASE, reg, site().fetch)).toMatchObject({ ok: false, message: 'No entries to print.' });
  });
});

describe('print fragment (SPEC.md §10.4)', () => {
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

describe('print exporter (SPEC.md §10.1, §10.4)', () => {
  const item = (id: string): ExportItem => {
    const { entry, derived } = lib.byId(id);
    return { entry, derived };
  };
  const opened = () => {
    const urls: string[] = [];
    return { urls, io: { open: (url: string) => void urls.push(url) } };
  };

  it('offers entry and set scope and takes a page size', () => {
    expect(print.scopes).toEqual(['entry', 'set']);
    expect(print.pageSize).toBe(true);
  });

  it('opens the print view for one entry at the chosen size', async () => {
    const fake = opened();
    await print.run([item('cinder-hound')], { scope: 'entry', base: BASE, pageSize: 'card-4x6', io: fake.io });
    expect(fake.urls).toEqual(['/ttrpg-library/print/?ids=cinder-hound&size=card-4x6']);
  });

  it('opens the print view for a set, in order', async () => {
    const fake = opened();
    await print.run([item('frost-lance'), item('cinder-hound')], { scope: 'set', base: BASE, io: fake.io });
    expect(fake.urls).toEqual(['/ttrpg-library/print/?ids=frost-lance,cinder-hound']);
  });

  it('rejects an empty set and more than one entry in entry scope', async () => {
    const fake = opened();
    await expect(print.run([], { scope: 'set', base: BASE, io: fake.io })).rejects.toThrow(/at least one/);
    await expect(print.run([item('cinder-hound'), item('frost-lance')], { scope: 'entry', base: BASE, io: fake.io })).rejects.toThrow(/exactly one/);
    expect(fake.urls).toEqual([]);
  });
});
