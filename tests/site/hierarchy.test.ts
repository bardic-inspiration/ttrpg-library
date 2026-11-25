// The style guide's standards (docs/styling.md#standards): heading sizes come from the two
// ladders, and link underlines are decided in one place.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../../site/src/', import.meta.url).pathname;
const read = (file: string) => readFileSync(join(SRC, file), 'utf8');
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => /\.(css|astro|tsx?)$/.test(file))
  .map((file) => ({ file: file.replaceAll('\\', '/'), text: read(file) }));
const base = read('styles/base.css');

describe('headings (docs/styling.md#type-and-headings)', () => {
  it.each([1, 2, 3, 4, 5, 6])('base.css sizes h%i from its level token', (n) => {
    expect(base).toContain(`h${n} { font-size: var(--text-h${n}); }`);
  });

  it('only the page ladder, its print sizes, and the style guide read the level tokens', () => {
    const allowed = ['styles/base.css', 'styles/tokens/semantic.css', 'components/print/PrintEntry.astro', 'styleguide/StyleGuide.astro'];
    const readers = files.filter((f) => /--text-h[1-6]\b/.test(f.text)).map((f) => f.file);
    expect(readers.filter((file) => !allowed.includes(file))).toEqual([]);
  });

  it.each([
    ['components/templates/parts/StatBlockHeader.astro', '--text-statblock-name'],
    ['components/templates/parts/ActionList.astro', '--text-statblock-heading'],
    ['components/templates/ItemCard.astro', '--text-statblock-heading'],
    ['components/templates/parts/Accordion.astro', '--text-statblock-heading'],
    ['components/templates/parts/EmbeddedStatBlock.astro', '--text-statblock-heading'],
    ['components/gallery/gallery.css', '--text-card-title'],
  ])('%s sizes its headings with %s', (file, token) => {
    expect(read(file)).toContain(`font-size: var(${token});`);
  });

  it('print sizes the stat block ladder', () => {
    const print = read('components/print/PrintEntry.astro');
    for (const token of ['--text-statblock-name', '--text-statblock-heading', '--text-statblock-subheading', '--text-h5', '--text-h6']) {
      expect(print, token).toContain(`${token}:`);
    }
  });
});

describe('links (docs/styling.md#links)', () => {
  it('base.css underlines links and quiets them in navigation, headings, and link lists', () => {
    expect(base).toMatch(/a \{[^}]*text-decoration-line: underline;/);
    expect(base).toContain(':where(nav, h1, h2, h3, h4, h5, h6, .link-list) a,\n  a:where(.link-quiet) {');
    expect(base).toContain('&:where(:hover, :focus-visible) {\n      text-decoration-line: underline;');
  });

  it('no file but base.css turns an underline off', () => {
    const off = files.filter((f) => f.file !== 'styles/base.css' && /text-decoration(-line)?:\s*none/.test(f.text));
    expect(off.map((f) => f.file)).toEqual([]);
  });

  it.each([
    ['components/detail/EntryDetail.astro', 'entry-detail__links link-list'],
    ['components/rules/RefLinks.astro', 'rule-links link-list'],
    ['pages/rulesets.astro', '<ul class="link-list">'],
    ['layouts/Base.astro', 'site-header__home link-quiet'],
    ['components/detail/EntryDetail.astro', 'entry-detail__type link-quiet'],
  ])('%s marks its quiet links (%s)', (file, marker) => {
    expect(read(file)).toContain(marker);
  });
});
