import { describe, expect, it } from 'vitest';
import { a11yPages } from '../scripts/a11y/index.ts';
import { resolvePath } from '../scripts/serve/index.ts';

const record = (type: string, id: string, facets: Record<string, unknown>) => ({
  id,
  ruleset: 'dnd-5e-2024',
  type,
  name: id,
  url: `/ttrpg-library/dnd-5e-2024/${type}/${id}/`,
  facets,
});

describe('a11yPages (docs/styling.md#accessibility)', () => {
  it('checks home, a filtered type gallery, one detail page per type with entries, and the print view', () => {
    const pages = a11yPages([
      record('creature', 'cinder-hound', { 'stats.cr': 2, 'stats.size': ['medium'] }),
      record('creature', 'ash-wolf', { 'stats.cr': 1 }),
      record('spell', 'frost-lance', { 'stats.level': 1 }),
    ]);
    expect(pages.map((p) => p.path)).toEqual([
      '',
      'dnd-5e-2024/creature/?f.stats.cr=2..2',
      'dnd-5e-2024/creature/cinder-hound/',
      'dnd-5e-2024/spell/frost-lance/',
      'print/?ids=creature/cinder-hound,spell/frost-lance',
    ]);
    expect(pages.at(-1)).toMatchObject({ label: 'print view: cinder-hound, frost-lance', ready: '.print-entry' });
  });

  it('filters by an enum facet value when the first facet is one', () => {
    expect(a11yPages([record('item', 'wand', { 'stats.rarity': 'very-rare' })])[1]!.path).toBe(
      'dnd-5e-2024/item/?f.stats.rarity=very-rare',
    );
  });

  it('checks each rules page, then the Extensions page of a ruleset that has one', () => {
    const pages = a11yPages([], [
      { ruleset: 'dnd-5e-2024', id: 'glossary', title: 'Glossary', extensions: true },
      { ruleset: 'dnd-5e-2024', id: 'weapons', title: 'Weapons', extensions: true },
      { ruleset: 'fixture-rules', id: 'terms', title: 'Terms', extensions: false },
    ]);
    expect(pages.slice(1)).toEqual([
      { label: 'rules page: Glossary', path: 'dnd-5e-2024/rules/glossary/' },
      { label: 'rules page: Weapons', path: 'dnd-5e-2024/rules/weapons/' },
      { label: 'rules page: Extensions', path: 'dnd-5e-2024/rules/extensions/' },
      { label: 'rules page: Terms', path: 'fixture-rules/rules/terms/' },
    ]);
  });

  it('checks only the home page of an empty library', () => {
    expect(a11yPages([])).toEqual([{ label: 'home', path: '' }]);
  });
});

describe('resolvePath (static site server)', () => {
  it('serves files under the site base, with index.html for directories', () => {
    expect(resolvePath('/dist', '/ttrpg-library/')).toBe('/dist/index.html');
    expect(resolvePath('/dist', '/ttrpg-library/about/')).toBe('/dist/about/index.html');
    expect(resolvePath('/dist', '/ttrpg-library/library.json')).toBe('/dist/library.json');
  });

  it('refuses paths outside the base or the root', () => {
    expect(resolvePath('/dist', '/other/')).toBeUndefined();
    expect(resolvePath('/dist', '/ttrpg-library/../../etc/passwd')).toBeUndefined();
    expect(resolvePath('/dist', '/ttrpg-library/%2e%2e/secret')).toBeUndefined();
  });
});
