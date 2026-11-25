// The shared interaction components (docs/styling.md#shared-components): every page builds its
// disclosures, buttons, checkboxes, and card links through the components in
// site/src/components/shared/, so each pattern has one look and one behavior. The scan fails when a
// page or component outside that folder builds one of its own.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import Button from '../../site/src/components/shared/Button.tsx';
import ButtonAstro from '../../site/src/components/shared/Button.astro';
import CardLink, { linkedCard } from '../../site/src/components/shared/CardLink.tsx';
import { Details, DisclosureButton } from '../../site/src/components/shared/Disclosure.tsx';
import DisclosureAstro from '../../site/src/components/shared/Disclosure.astro';

const SRC = new URL('../../site/src/', import.meta.url).pathname;
const SHARED = 'components/shared/';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return sources(path);
    return /\.(astro|tsx|css)$/.test(d.name) ? [path] : [];
  });
}

/** The markup a source builds itself: an Astro file's template, or a whole TSX file. */
const markup = (file: string, text: string) => (file.endsWith('.astro') ? text.replace(/^---[\s\S]*?\n---/, '') : text);

/** What a page or component outside the shared folder may not build on its own. */
const OWN_MARKUP: [string, RegExp][] = [
  ['a disclosure', /<details\b|<summary\b|aria-expanded/],
  ['a button', /<button\b/],
  ['a checkbox', /type=["']checkbox["']/],
];

/** The pattern a stylesheet outside the shared folder may not restyle, as the components own it. */
const OWN_STYLE: [string, RegExp][] = [
  ['the disclosure', /\.chevron\b|::-webkit-details-marker|\bsummary\b\s*[{:,.]|\.disclosure\b/],
  ['the card link', /\.card-link::after|\.linked-card\b/],
];

/** A card: an element whose class list holds `card`. */
const CARD = /class=(?:"(?:[^"]*\s)?card(?:\s[^"]*)?"|\{`card[\s$`])/;

/** Every rule a source breaks, by what it builds itself. */
function violations(file: string, text: string): string[] {
  const found: string[] = [];
  if (file.endsWith('.css')) {
    for (const [name, pattern] of OWN_STYLE) if (pattern.test(text)) found.push(`restyles ${name}`);
    return found;
  }
  const own = markup(file, text);
  for (const [name, pattern] of OWN_MARKUP) if (pattern.test(own)) found.push(`builds ${name}`);
  if (CARD.test(own) && (/<a\b/.test(own) || !/<CardLink\b/.test(own))) found.push('builds a card link');
  return found;
}

describe('pages build interaction patterns only through the shared components', () => {
  const files = sources(SRC).filter((file) => !relative(SRC, file).startsWith(SHARED));

  it.each(files.map((file) => [relative(SRC, file), file]))('%s', (_, file) => {
    expect(violations(file, readFileSync(file, 'utf8'))).toEqual([]);
  });

  it('fails a page that builds its own disclosure, button, checkbox, or card link', () => {
    expect(violations('x.tsx', '<details><summary>More</summary></details>')).toEqual(['builds a disclosure']);
    expect(violations('x.tsx', '<span aria-expanded={open} />')).toEqual(['builds a disclosure']);
    expect(violations('x.astro', '---\nconst a = 1;\n---\n<button type="button">Go</button>')).toEqual(['builds a button']);
    expect(violations('x.tsx', '<input type="checkbox" />')).toEqual(['builds a checkbox']);
    expect(violations('x.tsx', '<article class="card"><h2><a href={url}>Name</a></h2></article>')).toEqual(['builds a card link']);
    expect(violations('x.tsx', '<article class={`card ${linkedCard}`}><h2><CardLink href={url}>Name</CardLink></h2></article>')).toEqual([]);
    expect(violations('x.css', '.tree summary::-webkit-details-marker { display: none; }')).toEqual(['restyles the disclosure']);
    expect(violations('x.css', '.card a::after, .card-link::after { inset: 0; }')).toEqual(['restyles the card link']);
  });
});

describe('the shared components (docs/styling.md#shared-components)', () => {
  it('renders a button disclosure with its chevron on the left, naming the panel it opens', () => {
    const html = renderToString(h(DisclosureButton, { id: 't', controls: 'p', open: false, onToggle: () => {}, label: 'More' }));
    expect(html).toBe('<button type="button" class="disclosure" id="t" aria-expanded="false" aria-controls="p"><span class="chevron" aria-hidden="true"></span>More</button>');
  });

  it('names an icon-only disclosure for a screen reader and shows only its chevron', () => {
    const html = renderToString(h(DisclosureButton, { controls: 'p', open: true, onToggle: () => {}, label: 'Groups in Evocation', iconOnly: true }));
    expect(html).toBe('<button type="button" class="disclosure disclosure--icon" aria-expanded="true" aria-controls="p" aria-label="Groups in Evocation"><span class="chevron" aria-hidden="true"></span></button>');
  });

  it('renders the same details disclosure from Preact and from Astro', async () => {
    const preact = renderToString(h(Details, { class: 'x', summary: 'More', children: 'Body' }));
    const container = await AstroContainer.create();
    const astro = await container.renderToString(DisclosureAstro, { props: { class: 'x' }, slots: { summary: 'More', default: 'Body' } });
    expect(preact).toBe('<details class="x"><summary class="disclosure"><span class="chevron" aria-hidden="true"></span>More</summary>Body</details>');
    expect(astro).toBe(preact);
  });

  it('renders each button variant, from Preact and from Astro alike', async () => {
    const container = await AstroContainer.create();
    for (const variant of ['primary', 'secondary'] as const) {
      const preact = renderToString(h(Button, { variant, children: 'Go' }));
      expect(preact).toBe(`<button type="button" class="button button--${variant}">Go</button>`);
      expect(await container.renderToString(ButtonAstro, { props: { variant }, slots: { default: 'Go' } })).toBe(preact);
    }
    expect(renderToString(h(Button, { variant: 'icon', label: 'Download', children: '↓' }))).toBe('<button type="button" class="button button--icon" aria-label="Download">↓</button>');
  });

  it('marks a card link and the card it covers', () => {
    expect(linkedCard).toBe('linked-card');
    expect(renderToString(h(CardLink, { href: '/x/', children: 'Name' }))).toBe('<a class="card-link" href="/x/">Name</a>');
  });
});
