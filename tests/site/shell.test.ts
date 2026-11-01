import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import Base from '../../site/src/layouts/Base.astro';

const ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

const PAGES = join(import.meta.dirname, '../../site/src/pages');

async function renderBase(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  // The layout's icons are Preact components rendered statically; the Preact
  // integration's own server renderer needs the site's Vite plugins.
  container.addServerRenderer({
    name: '@astrojs/preact',
    renderer: {
      name: '@astrojs/preact',
      check: async (Component) => typeof Component === 'function' && !('isAstroComponentFactory' in Component),
      renderToStaticMarkup: async (Component, props) => ({ html: renderToString(h(Component as any, props as any)) }),
    },
  });
  return container.renderToString(Base, { props, request: new Request('https://bardic-inspiration.github.io/ttrpg-library/about/') });
}

describe('site shell (SPEC.md §9.2, §11)', () => {
  it('every page renders in the Base layout, except the print fragments (§10.4)', async () => {
    const pages = (await readdir(PAGES, { recursive: true })).filter((f) => f.endsWith('.astro'));
    expect(pages).toContain('about.astro');
    const partials: string[] = [];
    for (const page of pages) {
      const source = await readFile(join(PAGES, page), 'utf8');
      if (/^export const partial = true;$/m.test(source)) partials.push(page);
      else expect(source, page).toMatch(/import Base from '(\.\.\/)+layouts\/Base\.astro'/);
    }
    expect(partials).toEqual([join('print', '[ruleset]', '[type]', '[id].astro')]);
  });

  it('the layout carries the SRD 5.2 attribution statement verbatim', async () => {
    // Drop tags without adding spaces, so a lost space around a link fails.
    const html = await renderBase({ title: 'Test' });
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    expect(footer.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).toContain(ATTRIBUTION);
  });

  it('the header navigates to each ruleset, its types, and the about page', async () => {
    const html = await renderBase({ title: 'Test' });
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    for (const [label, path] of <[string, string][]>[
      ['D&amp;D 5e (SRD 5.2)', 'dnd-5e-2024/'],
      ['Creatures', 'dnd-5e-2024/creature/'],
      ['Magic items', 'dnd-5e-2024/magic-item/'],
      ['Spells', 'dnd-5e-2024/spell/'],
      ['About', 'about/'],
    ]) {
      expect(nav).toMatch(new RegExp(`href="[^"]*/${path}"[^>]*>${label.replace(/[()]/g, '\\$&')}</a>`));
    }
  });

  it('writes Open Graph tags when a page gives them', async () => {
    const html = await renderBase({ title: 'Test', og: { title: 'Cinder Hound', description: 'A hound.', image: '/ttrpg-library/art.png', type: 'article' } });
    expect(html).toContain('<meta property="og:title" content="Cinder Hound">');
    expect(html).toContain('<meta property="og:description" content="A hound.">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:image" content="https://bardic-inspiration.github.io/ttrpg-library/art.png">');
    expect(await renderBase({ title: 'Test' })).not.toContain('og:title');
  });
});
