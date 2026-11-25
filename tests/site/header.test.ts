// @vitest-environment happy-dom
// The page header's search and set export (docs/site.md#page-header): on every page, search opens
// the Library with the query, and on the Library it searches the gallery as the reader types.
// Print and Download act on the cart, or on the Library's filtered results while it's empty,
// and their accessible names say which.
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Gallery from '../../site/src/components/gallery/Gallery.tsx';
import HeaderActions from '../../site/src/components/header/HeaderActions.tsx';
import { cartKey, readCart, resetPageCart, writeCart } from '../../site/src/lib/cart.ts';
import { resetView } from '../../site/src/lib/library-view.ts';
import { fixtureRecords, whole } from './gallery/helpers.ts';

const BASE = '/ttrpg-library/';
const records = await fixtureRecords();
const key = (name: string) => cartKey(records.find((r) => r.name === name)!);

let root: HTMLElement;
beforeEach(() => {
  resetPageCart();
  resetView();
  window.localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  render(null, root);
  root.remove();
  vi.restoreAllMocks();
});

const search = () => root.querySelector<HTMLInputElement>('#site-q')!;
const actions = () => root.querySelector('.set-actions')?.textContent ?? '';
const button = (text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.startsWith(text))!;
const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  await act(() => void input.dispatchEvent(new Event('input', { bubbles: true })));
};

describe('the header search', () => {
  it('is a labeled form that opens the Library with the query, so it works without JavaScript', () => {
    const html = renderToString(h(HeaderActions, { base: BASE }));
    expect(html).toContain('<form class="header-search" role="search" action="/ttrpg-library/" method="get">');
    expect(html).toMatch(/<label for="site-q">.*Search<\/label><input id="site-q" name="q" type="search" placeholder="Name"/);
  });

  it('renders no set export until the island hydrates', () => {
    expect(renderToString(h(HeaderActions, { base: BASE }))).not.toContain('set-actions');
  });

  it('submits to the Library from any other page', async () => {
    await act(() => render(h(HeaderActions, { base: BASE }), root));
    const submit = new Event('submit', { cancelable: true });
    root.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(false);
  });

  it('searches the gallery as the reader types on the Library, without leaving the page', async () => {
    await act(() =>
      render(
        h('div', null, h(HeaderActions, { base: BASE, library: true }), h(Gallery, { indexUrl: '', base: BASE, records, initialQuery: whole('') })),
        root,
      ),
    );
    const before = root.querySelectorAll('.gallery__grid > li').length;
    await type(search(), 'cinder');
    const names = [...root.querySelectorAll('.gallery__grid article h3, .gallery__grid article h2')].map((n) => n.textContent);
    expect(root.querySelectorAll('.gallery__grid > li').length).toBeLessThan(before);
    expect(names.join(' ')).toMatch(/Cinder Hound/);
    const submit = new Event('submit', { cancelable: true });
    root.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('shows the Library’s query from its URL', async () => {
    await act(() =>
      render(
        h('div', null, h(HeaderActions, { base: BASE, library: true }), h(Gallery, { indexUrl: '', base: BASE, records, initialQuery: whole('?q=frost') })),
        root,
      ),
    );
    expect(search().value).toBe('frost');
  });
});

describe('the header set export', () => {
  it('targets the Library’s filtered results while the cart is empty, then the cart', async () => {
    await act(() =>
      render(
        h('div', null, h(HeaderActions, { base: BASE, library: true }), h(Gallery, { indexUrl: '', base: BASE, records, initialQuery: whole('?f.type=spell') })),
        root,
      ),
    );
    expect(actions()).toContain('Print 1 entry');
    expect(actions()).toContain('Download 1 entry');
    await act(() => void writeCart([key('Cinder Hound'), key('Frost Lance')]));
    expect(actions()).toContain('Print 2 in cart');
  });

  it('targets the cart on every other page, and is disabled while it’s empty', async () => {
    await act(() => render(h(HeaderActions, { base: BASE }), root));
    expect(actions()).toContain('Print 0 in cart');
    expect(button('Print').disabled).toBe(true);
    await act(() => void writeCart([key('Frost Lance')]));
    expect(actions()).toContain('Print 1 in cart');
    expect(button('Print').disabled).toBe(false);
  });

  it('prints the cart from another page in the order it was added, dropping what the library no longer has', async () => {
    const gone = 'dnd-5e-2024/creature/gone';
    writeCart([key('Cinder Hound'), gone, key('Frost Lance')]);
    const fetched: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      fetched.push(String(url));
      return new Response(JSON.stringify(records));
    });
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await act(() => render(h(HeaderActions, { base: BASE }), root));
    expect(actions()).toContain('Print 3 in cart');
    await act(async () => button('Print').click());
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(fetched).toEqual(['/ttrpg-library/library.json']);
    expect(open.mock.calls[0]![0]).toBe('/ttrpg-library/print/?ids=creature/cinder-hound,spell/frost-lance');
    expect(readCart()).toEqual([key('Cinder Hound'), key('Frost Lance')]);
  });

  it('says so when the library can’t be loaded, and runs nothing', async () => {
    writeCart([key('Frost Lance')]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const open = vi.spyOn(window, 'open');
    await act(() => render(h(HeaderActions, { base: BASE }), root));
    await act(async () => button('Print').click());
    await vi.waitFor(() => expect(root.querySelector('.set-actions__status')?.textContent).toBe('Print failed. Try again.'));
    expect(open).not.toHaveBeenCalled();
  });
});
