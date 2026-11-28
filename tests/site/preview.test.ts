// The site base and the preview (docs/workflow.md#deploy): the base follows SITE_BASE and defaults to
// production's, and a preview build's pages carry the notice and noindex while production's don't.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPreview, PREVIEW_BASE, PRODUCTION_BASE, productionPath, siteBase } from '../../lib/site.ts';
import { checkPreviewLink } from '../../site/src/lib/preview.ts';

describe('siteBase', () => {
  it('is /ttrpg-library/ when SITE_BASE is unset or empty', () => {
    expect(siteBase({})).toBe('/ttrpg-library/');
    expect(siteBase({ SITE_BASE: '' })).toBe('/ttrpg-library/');
    expect(PRODUCTION_BASE).toBe('/ttrpg-library/');
  });

  it('follows SITE_BASE', () => {
    expect(siteBase({ SITE_BASE: '/ttrpg-library/next/' })).toBe('/ttrpg-library/next/');
    expect(PREVIEW_BASE).toBe('/ttrpg-library/next/');
  });

  it('rejects a base without its leading and trailing slashes', () => {
    expect(() => siteBase({ SITE_BASE: 'ttrpg-library/next/' })).toThrow('SITE_BASE');
    expect(() => siteBase({ SITE_BASE: '/ttrpg-library/next' })).toThrow('SITE_BASE');
  });
});

describe('isPreview and productionPath', () => {
  it('a build at any base but production’s is a preview', () => {
    expect(isPreview(PRODUCTION_BASE)).toBe(false);
    expect(isPreview(PREVIEW_BASE)).toBe(true);
  });

  it('maps a preview path to the same path on production, and anything else to its Library', () => {
    expect(productionPath('/ttrpg-library/next/dnd-5e-2024/creature/lich/', PREVIEW_BASE)).toBe('/ttrpg-library/dnd-5e-2024/creature/lich/');
    expect(productionPath('/ttrpg-library/next/', PREVIEW_BASE)).toBe('/ttrpg-library/');
    expect(productionPath('/elsewhere/', PREVIEW_BASE)).toBe('/ttrpg-library/');
  });
});

describe('checkPreviewLink', () => {
  /** Checks a stand-in link, with production answering `ok`, or failing to answer when undefined. */
  async function check(ok: boolean | undefined) {
    const link = {
      href: 'https://bardic-inspiration.github.io/ttrpg-library/new/',
      textContent: 'See this page on the released site',
      dataset: { fallbackHref: '/ttrpg-library/', fallbackText: 'Go to the released site’s Library' },
    };
    const fetch = vi.fn(async () => (ok === undefined ? Promise.reject(new Error('offline')) : ({ ok } as Response)));
    await checkPreviewLink(link as unknown as HTMLAnchorElement, fetch);
    expect(fetch).toHaveBeenCalledWith('https://bardic-inspiration.github.io/ttrpg-library/new/');
    return { href: link.href, text: link.textContent };
  }

  it('points the link at production’s Library when production lacks the page', async () => {
    expect(await check(false)).toEqual({ href: '/ttrpg-library/', text: 'Go to the released site’s Library' });
  });

  it('keeps the link when production has the page, or doesn’t answer', async () => {
    const kept = { href: 'https://bardic-inspiration.github.io/ttrpg-library/new/', text: 'See this page on the released site' };
    expect(await check(true)).toEqual(kept);
    expect(await check(undefined)).toEqual(kept);
  });
});

/** Renders the Base layout at `path`, from a fresh module graph built with SITE_BASE as given. */
async function renderBase(base: string | undefined, path: string): Promise<string> {
  vi.resetModules();
  if (base === undefined) vi.stubEnv('SITE_BASE', '');
  else vi.stubEnv('SITE_BASE', base);
  const { default: Base } = await import('../../site/src/layouts/Base.astro');
  const container = await AstroContainer.create();
  container.addServerRenderer({
    name: '@astrojs/preact',
    renderer: {
      name: '@astrojs/preact',
      check: async (Component) => typeof Component === 'function' && !('isAstroComponentFactory' in Component),
      renderToStaticMarkup: async (Component, props) => ({ html: renderToString(h(Component as any, props as any)) }),
    },
  });
  return container.renderToString(Base, { props: { title: 'Test' }, request: new Request(`https://bardic-inspiration.github.io${path}`) });
}

describe('Base layout in each build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('a preview page carries the notice, linking to the same path on production, and noindex', async () => {
    const html = await renderBase(PREVIEW_BASE, '/ttrpg-library/next/about/');
    expect(html).toContain('<meta name="robots" content="noindex">');
    const notice = html.slice(html.indexOf('<aside class="preview-notice'), html.indexOf('</aside>'));
    expect(notice).toContain('preview of the next version');
    expect(notice).toMatch(/<a href="\/ttrpg-library\/about\/"[^>]*data-preview-link/);
    expect(notice).toContain('data-fallback-href="/ttrpg-library/"');
    expect(html.indexOf('preview-notice')).toBeLessThan(html.indexOf('<header'));
  });

  it('a production page has neither', async () => {
    const html = await renderBase(undefined, '/ttrpg-library/about/');
    expect(html).not.toContain('preview-notice');
    expect(html).not.toContain('noindex');
  });
});
