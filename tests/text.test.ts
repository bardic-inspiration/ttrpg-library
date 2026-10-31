import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';
import { blocklistMatcher, checkBlocklist, loadBlocklist, markdownViolations, stringsIn } from '../scripts/validate/text.ts';

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
    ['a table', '| a | b |\n|---|---|\n| 1 | 2 |', 'a table'],
    ['a link inside a list item', '- see [x](https://example.com)', 'a link'],
  ])('rejects %s', (_label, text, construct) => {
    expect(markdownViolations(text)).toContain(construct);
  });

  it('names each construct once', () => {
    expect(markdownViolations('# A\n\n[x](a) [y](b) ![i](c)')).toEqual(['a heading', 'a link', 'an image']);
  });
});

describe('blocklist (SPEC.md §11)', () => {
  const matches = blocklistMatcher(['Beholder', 'Mind Flayer', 'Faerûn', 'Tasha']);

  it('matches case-insensitively on word boundaries', () => {
    expect(matches('A BEHOLDER floats here.')).toEqual(['BEHOLDER']);
    expect(matches("Tasha's spell")).toEqual(['Tasha']);
    expect(matches('the beholder-kin')).toEqual(['beholder']);
    expect(matches('Tashan rugs and beholders')).toEqual([]);
  });

  it('matches a multi-word term across any whitespace', () => {
    expect(matches('a mind\nflayer')).toEqual(['mind\nflayer']);
    expect(matches('a mindflayer')).toEqual([]);
  });

  it('uses Unicode word boundaries', () => {
    expect(matches('the roads of faerûn')).toEqual(['faerûn']);
    expect(matches('Faerûnian roads')).toEqual([]);
  });

  it('checks name, summary, description, and every string in stats', () => {
    const entry = {
      name: 'Beholder Hound',
      summary: 'Hunts the mind flayer.',
      description: 'From Faerûn.',
      stats: { descriptors: ['Tasha'], gear: [{ ref: 'magic-item/x' }], actions: [{ text: 'A beholder gaze.' }] },
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
