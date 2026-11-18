// Pipe tables in text fields (docs/content-model.md#tables-in-text, docs/site.md#templates): the SRD entries that print
// a table validate with it, and it renders as one site-wide table on the
// card, the detail page, the print view, and the PNG capture.
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { validateLibrary } from '../../scripts/validate/index.ts';
import { PROJECT_ROOT } from '../../scripts/validate/schema.ts';
import EntryDetail from '../../site/src/components/detail/EntryDetail.astro';
import PrintEntry from '../../site/src/components/print/PrintEntry.astro';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refTargets, type Entry } from '../../site/src/lib/library.ts';
import { renderMarkdown } from '../../site/src/lib/markdown.ts';
import { textOf } from './library-fixtures.ts';

/** The SRD entries that print a table, as `<type>/<id>`, with the header cells and first row of their first table. */
const cases: [string, string[], string[]][] = [
  ['spell/confusion', ['1d10', 'Behavior for the Turn'], ['1', expect.stringContaining("The target doesn't take an action") as unknown as string]],
  ['item/belt-of-giant-strength', ['Belt', 'Str.', 'Rarity'], ['Belt of Giant Strength (hill)', '21', 'Rare']],
  ['item/staff-of-healing', ['Spell', 'Charge Cost'], ['Cure Wounds', '1 charge per spell level (maximum 4 for a level 4 spell)']],
];

// The whole library, so a link added to one of them still resolves (AGENTS.md "Dev workflow").
const library = await validateLibrary(join(PROJECT_ROOT, 'content'));
const entries = [...library.entries, ...library.components].map(({ entry }) => entry as unknown as Entry);
const all = loadLibrary(entries, library.rules);
const names = entryNames(all, library.rules);
const byKey = (key: string) => all.find(({ entry }) => `${entry.type}/${entry.id}` === key)!;

/** The header cells and the first body row of the first table in `html`. */
function firstTable(html: string): { header: string[]; firstRow: string[] } {
  const table = html.match(/<div class="md-table"[^>]*><table>([\s\S]*?)<\/table><\/div>/)?.[1] ?? '';
  const cells = (row: string, tag: string) =>
    [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => textOf(m[1]!).trim());
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]!);
  return { header: cells(rows[0] ?? '', 'th'), firstRow: cells(rows[1] ?? '', 'td') };
}

describe('SRD entries with tables (docs/content-model.md#tables-in-text, docs/content-model.md#srd-and-custom-entries)', () => {
  it('validate with their tables, in the whole library', () => {
    expect(library.errors).toEqual([]);
    const valid = new Set(library.entries.map(({ entry }) => `${entry.type}/${entry.id}`));
    expect(cases.map(([key]) => key).filter((key) => !valid.has(key))).toEqual([]);
  });
});

describe('table rendering (docs/site.md#templates)', () => {
  it('renders a table with column headers, inline markup, and alignment', () => {
    const html = renderMarkdown('Intro.\n\n| Spell | Cost |\n|---|--:|\n| *Cure Wounds* | **1** |');
    expect(html).toContain('<p>Intro.</p>');
    expect(html).toContain('<div class="md-table" role="region" tabindex="0" aria-label="Table: Spell, Cost"><table>');
    expect(html).toContain('<th scope="col" class="md-table__cell--nowrap">Spell</th><th scope="col" class="md-table__cell--right md-table__cell--nowrap">Cost</th>');
    expect(html).toContain('<td><em>Cure Wounds</em></td><td class="md-table__cell--right md-table__cell--nowrap"><strong>1</strong></td>');
  });

  it('keeps a one-word cell, such as a die range, on one line', () => {
    const html = renderMarkdown('| d10 | Behavior |\n|---|---|\n| 9–10 | The target chooses. |');
    expect(html).toContain('<td class="md-table__cell--nowrap">9–10</td><td>The target chooses.</td>');
  });

  it('escapes HTML in cells and in the label', () => {
    const html = renderMarkdown('| <b>a</b> |\n|---|\n| <i>1</i> |');
    expect(html).not.toMatch(/<(b|i)>/);
    expect(html).toContain('aria-label="Table: &lt;b&gt;a&lt;/b&gt;"');
  });

  describe('table titles (docs/content-model.md#tables-in-text)', () => {
    const titled = 'The GM chooses the omen from the Omens table.\n\n**Omens**\n\n| Omen | For Results That Will Be … |\n|---|---|\n| Weal | Good |';

    it('renders a bold line directly above a table as its caption, not as a paragraph', () => {
      const html = renderMarkdown(titled);
      expect(html).toContain('<p>The GM chooses the omen from the Omens table.</p>');
      expect(html).not.toContain('<strong>Omens</strong>');
      expect(html).toContain('<div class="md-table" role="region" tabindex="0" aria-label="Table: Omens"><table><caption>Omens</caption><thead>');
    });

    it('captions each of several titled tables in one text', () => {
      const html = renderMarkdown('**Wind**\n\n| Stage | Condition |\n|---|---|\n| 1 | Calm |\n\n**Temperature**\n\n| Stage | Condition |\n|---|---|\n| 1 | Heat wave |');
      expect(html.match(/<caption>([^<]*)<\/caption>/g)).toEqual(['<caption>Wind</caption>', '<caption>Temperature</caption>']);
    });

    it.each([
      ['not followed by a table', '**Omens**\n\nThe GM chooses.'],
      ['followed by more text on its line', '**First Roar.** A roar.\n\n| a | b |\n|---|---|\n| 1 | 2 |'],
      ['italic rather than bold', '*Omens*\n\n| a | b |\n|---|---|\n| 1 | 2 |'],
    ])('leaves a line %s as a paragraph', (_label, text) => {
      const html = renderMarkdown(text);
      expect(html).not.toContain('<caption>');
      expect(html).toMatch(/<p>/);
    });

    it('keeps the column headers as the label of an untitled table', () => {
      expect(renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('aria-label="Table: a, b"><table><thead>');
    });

    it('escapes HTML in a title', () => {
      const html = renderMarkdown('**<b>Omens</b>**\n\n| a |\n|---|\n| 1 |');
      expect(html).not.toMatch(/<b>/);
      expect(html).toContain('<caption>&lt;b&gt;Omens&lt;/b&gt;</caption>');
    });
  });

  describe.each(cases)('%s', (key, header, firstRow) => {
    const { entry, derived } = byKey(key);

    it.each(['screen', 'capture'])('renders its table on the card in %s mode', async (mode) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(EntryTemplate, { props: { entry, derived, names, mode } });
      expect(firstTable(html)).toEqual({ header, firstRow });
    });

    it('renders its table on the detail page', async () => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(EntryDetail, { props: { loaded: byKey(key), names, targets: refTargets(all, library.rules) } });
      expect(firstTable(html)).toEqual({ header, firstRow });
    });

    it('renders its table in the print view', async () => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(PrintEntry, { props: { loaded: byKey(key), names } });
      expect(firstTable(html)).toEqual({ header, firstRow });
    });
  });
});
