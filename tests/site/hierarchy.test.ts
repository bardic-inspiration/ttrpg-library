// The text hierarchy and its standards (docs/styling.md#hierarchy-and-standards): every heading
// level has a size role, a stat block's section headings read one size below its name, the
// spacing rhythm is a set of tokens, and links outside running text underline only on hover and
// focus, except the current page's.
import { readFileSync } from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import { readTokens } from '../../site/src/lib/design-tokens.ts';
import { entryNames, loadLibrary } from '../../site/src/lib/library.ts';
import { fixtureLibrary, withoutContents } from './library-fixtures.ts';

const STYLES = new URL('../../site/src/styles/', import.meta.url).pathname;
const base = readFileSync(`${STYLES}base.css`, 'utf8');
const semantic = readTokens(readFileSync(`${STYLES}tokens/semantic.css`, 'utf8'));
const declared = new Set(semantic.map((d) => d.name));
const components = new Map(readTokens(readFileSync(`${STYLES}tokens/components.css`, 'utf8')).map((d) => [d.name, d.value]));
const component = (path: string) => readFileSync(new URL(`../../site/src/components/${path}`, import.meta.url), 'utf8');

/** The class attribute of each heading in rendered markup, as `h<level> <classes>`. */
const headings = (html: string) =>
  [...html.replace(/ data-astro-cid-\w+/g, '').matchAll(/<h([1-6])(?: class="([^"]*)")?>([\s\S]*?)<\/h\1>/g)].map(([, level, cls = '', text = '']) => ({
    level: Number(level),
    classes: cls.split(' ').filter(Boolean),
    text: text.replace(/<[^>]+>/g, '').trim(),
  }));

describe('text hierarchy (docs/styling.md#hierarchy-and-standards)', () => {
  it.each([1, 2, 3, 4, 5, 6])('h%i takes its size from --text-h%i', (level) => {
    expect(declared.has(`--text-h${level}`)).toBe(true);
    expect(base).toMatch(new RegExp(`\\bh${level}\\s*\\{\\s*font-size:\\s*var\\(--text-h${level}\\);`));
  });

  it.each(['--flow-line', '--flow-text', '--flow-block', '--flow-section'])('declares the rhythm token %s', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('underlines links in headings, navigation, and the site header only on hover and focus', () => {
    const rule = base.match(/:is\(([^)]*)\) a \{([\s\S]*?)\n {2}\}/);
    expect(rule).not.toBeNull();
    const [, selectors = '', body = ''] = rule!;
    expect(selectors.split(',').map((s) => s.trim())).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', '.site-header']);
    expect(body).toMatch(/text-decoration-line: none;/);
    expect(body).toMatch(/&:hover,\s*&:focus-visible \{\s*text-decoration-line: underline;/);
  });

  it("marks the current page's link with a heavier underline at rest, in the same rule", () => {
    const body = base.match(/:is\([^)]*\) a \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    expect(body).toMatch(/&\[aria-current\] \{\s*text-decoration-line: underline;\s*text-decoration-thickness: var\(--border-width-strong\);/);
    // The nav doesn't take it away again.
    expect(component('SiteNav.astro')).not.toMatch(/text-decoration(-line)?:\s*none/);
  });
});

describe('stat block section headings (docs/styling.md#hierarchy-and-standards)', async () => {
  const lib = await fixtureLibrary();

  it('sizes section headings at the section size and nested ones a step smaller', () => {
    expect(components.get('--statblock-title-size')).toBe('var(--text-h3)');
    expect(components.get('--statblock-heading-size')).toBe('var(--text-h4)');
    expect(components.get('--statblock-subheading-size')).toBe('var(--text-h5)');
    const frame = component('templates/parts/StatBlock.astro');
    expect(frame).toMatch(/\.statblock :global\(\.statblock-heading\) \{\s*font-family: var\(--statblock-heading-font\);\s*font-size: var\(--statblock-heading-size\);\s*color: var\(--accent\);/);
    expect(frame).toMatch(/\.statblock :global\(\.statblock-heading--nested\) \{\s*font-size: var\(--statblock-subheading-size\);/);
  });

  it.each(['screen', 'print'])("gives a class page's sections the section size and its features the nested size in %s mode", async (mode) => {
    const wizard = lib.byId('wizard');
    const html = await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...wizard, names: lib.names, components: wizard.components, mode } });
    const all = headings(withoutContents(html));
    const [name, ...rest] = all;
    expect(name).toMatchObject({ level: 2, text: 'Wizard', classes: ['statblock-header__name'] });
    const sections = rest.filter((h) => h.level === 3);
    const nested = rest.filter((h) => h.level === 4);
    expect(sections.map((h) => h.text)).toEqual(expect.arrayContaining(['Core Wizard Traits', 'Wizard Class Features']));
    expect(nested.map((h) => h.text)).toContain('Level 1: Spellcasting');
    for (const h of sections) expect(h.classes).toEqual(['statblock-heading']);
    for (const h of nested) expect(h.classes).toEqual(['statblock-heading', 'statblock-heading--nested']);
  });

  it("sizes an embedded stat block's name as a section heading, and its sections a step smaller", async () => {
    const spell = structuredClone(lib.byId('frost-lance').entry) as { stats: Record<string, unknown> };
    spell.stats.statBlocks = [
      {
        name: 'Frost Sprite',
        typeLine: 'Tiny Elemental, Neutral',
        abilities: { str: 3, dex: 16, con: 10, int: 6, wis: 12, cha: 8 },
        actions: [{ name: 'Chill', text: 'It chills.' }],
      },
    ];
    const all = loadLibrary([spell as never]);
    const html = await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...all[0]!, names: entryNames(all) } });
    const hs = headings(html);
    expect(hs.find((h) => h.text === 'Frost Lance')!.classes).toEqual(['statblock-header__name']);
    expect(hs.find((h) => h.text === 'Frost Sprite')!.classes).toEqual(['statblock-heading']);
    expect(hs.find((h) => h.text === 'Actions')!.classes).toEqual(['statblock-heading', 'statblock-heading--nested', 'action-list__heading']);
  });

  it('keeps the print sizes for every heading role, h5 and h6 and the component tokens among them', () => {
    const print = component('print/PrintEntry.astro');
    for (const line of ['--text-h5: var(--print-font-size);', '--text-h6: var(--print-font-size);', '--statblock-subheading-size: var(--text-h5);']) {
      expect(print).toContain(line);
    }
  });
});
