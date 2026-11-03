import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';
import { termMatcher } from '../lib/text.ts';
import { checkBlocklist, checkMarkdown, loadBlocklist, markdownViolations, stringsIn, tableViolations } from '../scripts/validate/text.ts';

describe('markdown subset (SPEC.md §5.5)', () => {
  it('allows paragraphs, bold, italic, lists, line breaks, and tokens', () => {
    const text = [
      'A **bold** and *italic* paragraph with a token {dmg:2d6+str:fire}.',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      'A line  ',
      'break, 3 < 4, and an escaped \\# sign.',
    ].join('\n');
    expect(markdownViolations(text)).toEqual([]);
  });

  it.each([
    ['an ATX heading', '# Lore', 'a heading'],
    ['a setext heading', 'Lore\n====', 'a heading'],
    ['an inline link', 'See [the SRD](https://example.com).', 'a link'],
    ['a bare URL', 'See https://example.com today.', 'a link'],
    ['an angle-bracket autolink', 'See <https://example.com>.', 'a link'],
    ['a reference link definition', 'See [srd].\n\n[srd]: https://example.com', 'a link'],
    ['an image', '![art](hound.png)', 'an image'],
    ['inline HTML', 'Take <b>half</b> damage.', 'HTML'],
    ['block HTML', '<div>\nlore\n</div>', 'HTML'],
    ['a link inside a table cell', '| a | b |\n|---|---|\n| [x](https://example.com) | 2 |', 'a link'],
    ['a link inside a list item', '- see [x](https://example.com)', 'a link'],
  ])('rejects %s', (_label, text, construct) => {
    expect(markdownViolations(text)).toContain(construct);
  });

  it('allows a pipe table between paragraphs, with bold, italic, and alignment in its cells', () => {
    const text = 'Roll on the table below.\n\n| 1d4 | **Effect** |\n|:--|--:|\n| 1 | *Slowed* |\n| 2–4 | A pipe \\| inside |\n\nThen continue.';
    expect(markdownViolations(text)).toEqual([]);
    expect(tableViolations(text)).toEqual([]);
  });

  it('names each construct once', () => {
    expect(markdownViolations('# A\n\n[x](a) [y](b) ![i](c)')).toEqual(['a heading', 'a link', 'an image']);
  });
});

describe('pipe tables (SPEC.md §5.5)', () => {
  it.each([
    ['a short row', '| a | b |\n|---|---|\n| 1 |', ['table row 1 has 1 cell; its header has 2']],
    ['a long row', '| a | b |\n|---|---|\n| 1 | 2 |\n| 1 | 2 | 3 |', ['table row 2 has 3 cells; its header has 2']],
    ['an empty header cell', '| a |  |\n|---|---|\n| 1 | 2 |', ['a table header cell is empty']],
    ['no rows', '| a | b |\n|---|---|', ['a table has no rows under its header']],
    ['a delimiter row with too few columns', '| a | b |\n|---|\n| 1 | 2 |', [expect.stringMatching(/^a line starts with "\|" but isn't part of a table/)]],
    ['a missing delimiter row', 'Intro.\n\n| a | b |\n| 1 | 2 |', [expect.stringMatching(/^a line starts with "\|"/)]],
  ])('rejects %s', (_label, text, problems) => {
    expect(tableViolations(text)).toEqual(problems);
  });

  it('reports a malformed table with the field path', () => {
    expect(checkMarkdown('stats.effect', '| a | b |\n|---|---|\n| 1 |')).toEqual([
      'stats.effect: table row 1 has 1 cell; its header has 2',
    ]);
  });
});

describe('blocklist (SPEC.md §11)', () => {
  const matches = termMatcher(['Beholder', 'Mind Flayer', 'Faerûn', 'Tasha']);

  it('checks name, summary, description, and every string in stats', () => {
    const entry = {
      name: 'Beholder Hound',
      summary: 'Hunts the mind flayer.',
      description: 'From Faerûn.',
      stats: { descriptors: ['Tasha'], gear: [{ ref: 'magic-item/x' }], actions: [{ text: 'Two beholders gaze.' }] },
    };
    expect(checkBlocklist(entry, matches).map((m) => m.split(':')[0])).toEqual([
      'name',
      'summary',
      'description',
      'stats.descriptors[0]',
      'stats.actions[0].text',
    ]);
  });

  it('lists strings with their paths', () => {
    expect(stringsIn({ a: ['x', { b: 'y' }], n: 3 }, 'stats')).toEqual([
      { path: 'stats.a[0]', text: 'x' },
      { path: 'stats.a[1].b', text: 'y' },
    ]);
  });

  it('loads config/blocklist.json with the §11 examples', async () => {
    const terms = await loadBlocklist(PROJECT_ROOT);
    for (const term of ['Beholder', 'Mind Flayer', 'Illithid', 'Displacer Beast', 'Githyanki', 'Forgotten Realms', 'Faerûn', 'Greyhawk', 'Eberron', 'Waterdeep', 'Mordenkainen', 'Bigby', 'Tasha']) {
      expect(terms).toContain(term);
    }
    expect(JSON.parse(await readFile(join(PROJECT_ROOT, 'config/blocklist.json'), 'utf8'))).toEqual(terms);
  });
});
