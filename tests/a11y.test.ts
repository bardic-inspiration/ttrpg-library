import { describe, expect, it } from 'vitest';
import { a11yPages } from '../scripts/a11y/index.ts';
import { resolvePath } from '../scripts/serve/index.ts';

const record = (type: string, id: string, facets: Record<string, unknown>) => ({
  ruleset: 'dnd-5e-2024',
  type,
  name: id,
  url: `/ttrpg-library/dnd-5e-2024/${type}/${id}/`,
  facets,
});

describe('a11yPages (SPEC.md §9.7)', () => {
  it('checks home, a filtered type gallery, and one detail page per type with entries', () => {
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
    ]);
  });

  it('filters by an enum facet value when the first facet is one', () => {
    expect(a11yPages([record('magic-item', 'wand', { 'stats.rarity': 'very-rare' })])[1]!.path).toBe(
      'dnd-5e-2024/magic-item/?f.stats.rarity=very-rare',
    );
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
