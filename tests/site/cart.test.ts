// @vitest-environment happy-dom
// The print cart (docs/site.md#gallery "Cart and set actions"): adding and removing entries,
// keeping them across pages and reloads in local storage, working with storage blocked, dropping
// entries the library no longer has, and the set actions on the cart.
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExportControls from '../../site/src/components/detail/ExportControls.tsx';
import Gallery from '../../site/src/components/gallery/Gallery.tsx';
import HeaderActions from '../../site/src/components/header/HeaderActions.tsx';
import {
  CART_EVENT,
  CART_STORAGE_KEY,
  cartKey,
  pruneCart,
  readCart,
  resetPageCart,
  setInCart,
  writeCart,
  type CartStore,
} from '../../site/src/lib/cart.ts';
import { resetView } from '../../site/src/lib/library-view.ts';
import { fixtureRecords } from './gallery/helpers.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const BASE = '/ttrpg-library/';
const lib = await fixtureLibrary();
const records = await fixtureRecords();

/** A store backed by a plain map, as local storage would be. */
function memoryStore(): CartStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

/** A store that throws on every read and write, as blocked storage does. */
const blocked: CartStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

beforeEach(() => {
  resetPageCart();
  resetView();
  window.localStorage.clear();
});

describe('the cart (docs/site.md#gallery "Cart and set actions")', () => {
  it('keys an entry by its ruleset, type, and id', () => {
    expect(cartKey({ ruleset: 'dnd-5e-2024', type: 'item', id: 'ring-of-protection' })).toBe('dnd-5e-2024/item/ring-of-protection');
  });

  it('adds entries in order and removes them', () => {
    const store = memoryStore();
    setInCart('r/spell/a', true, store);
    setInCart('r/spell/b', true, store);
    setInCart('r/spell/a', true, store);
    expect(readCart(store)).toEqual(['r/spell/b', 'r/spell/a']);
    setInCart('r/spell/b', false, store);
    expect(readCart(store)).toEqual(['r/spell/a']);
  });

  it('keeps the cart in storage, so it survives a new page or a reload', () => {
    const store = memoryStore();
    setInCart('r/spell/a', true, store);
    resetPageCart(); // a new page starts with no copy of its own
    expect(readCart(store)).toEqual(['r/spell/a']);
    expect(JSON.parse(store.data.get(CART_STORAGE_KEY)!)).toEqual(['r/spell/a']);
  });

  it('lasts only for the page when storage is blocked', () => {
    expect(readCart(blocked)).toEqual([]);
    setInCart('r/spell/a', true, blocked);
    setInCart('r/spell/b', true, blocked);
    expect(readCart(blocked)).toEqual(['r/spell/a', 'r/spell/b']);
    resetPageCart();
    expect(readCart(blocked)).toEqual([]);
  });

  it('reads unreadable storage as an empty cart', () => {
    const store = memoryStore();
    store.data.set(CART_STORAGE_KEY, '{"not":"a list"}');
    expect(readCart(store)).toEqual([]);
    store.data.set(CART_STORAGE_KEY, 'not json');
    expect(readCart(store)).toEqual([]);
  });

  it('drops entries the library no longer has, writing only when something dropped', () => {
    const store = memoryStore();
    writeCart(['r/spell/a', 'r/spell/gone', 'r/spell/b'], store);
    expect(pruneCart(new Set(['r/spell/a', 'r/spell/b']), store)).toEqual(['r/spell/a', 'r/spell/b']);
    expect(readCart(store)).toEqual(['r/spell/a', 'r/spell/b']);
    const write = vi.spyOn(store, 'setItem');
    pruneCart(new Set(['r/spell/a', 'r/spell/b']), store);
    expect(write).not.toHaveBeenCalled();
  });

  it('tells the page when it changes', () => {
    const heard = vi.fn();
    window.addEventListener(CART_EVENT, heard);
    setInCart('r/spell/a', true, memoryStore());
    window.removeEventListener(CART_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('the cart control', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
  });
  afterEach(() => {
    render(null, root);
    root.remove();
  });

  /** The Library: the gallery, and the page header's set export beside it (docs/site.md#page-header). */
  const library = (query: string) =>
    h('div', null, h(HeaderActions, { base: BASE, library: true }), h(Gallery, { indexUrl: '', base: BASE, records, initialQuery: query }));
  const box = (name: string) => [...root.querySelectorAll('label')].find((label) => label.textContent === `Selected: ${name}`);
  const input = (name: string) => root.querySelector<HTMLInputElement>(`#${box(name)!.htmlFor}`)!;

  it('adds an entry from its detail page, and the Library shows it in the cart', async () => {
    const { entry, derived } = lib.byId('frost-lance');
    await act(() => render(h(ExportControls, { item: { entry, derived }, base: BASE, ready: true }), root));
    expect(input('Frost Lance').checked).toBe(false);
    await act(() => input('Frost Lance').click());
    expect(input('Frost Lance').checked).toBe(true);
    expect(readCart()).toEqual([cartKey(entry)]);

    // A new page: the Library reads the cart back from local storage.
    render(null, root);
    resetPageCart();
    await act(() => render(library('?f.ruleset=dnd-5e-2024'), root));
    expect(input('Frost Lance').checked).toBe(true);
    expect(input('Cinder Hound').checked).toBe(false);
    expect(root.querySelector('.gallery__cart')?.textContent).toContain('1 selected');
    expect(root.querySelector('.set-actions')?.textContent).toContain('Print 1 selected');
  });

  it('adds and removes entries from cards, and the set actions target the cart in the order they were added', async () => {
    await act(() => render(library('?f.ruleset=dnd-5e-2024'), root));
    expect(root.querySelector('.set-actions')?.textContent).toContain(`Print ${records.length} entries`);
    await act(() => input('Wand of Frost Lances').click());
    await act(() => input('Cinder Hound').click());
    expect(readCart()).toEqual(['Wand of Frost Lances', 'Cinder Hound'].map((name) => cartKey(records.find((r) => r.name === name)!)));
    expect(root.querySelector('.set-actions')?.textContent).toContain('Print 2 selected');
    await act(() => input('Cinder Hound').click());
    expect(root.querySelector('.set-actions')?.textContent).toContain('Print 1 selected');
    const empty = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Clear selected')!;
    await act(() => empty.click());
    expect(readCart()).toEqual([]);
    expect(root.querySelector('.gallery__cart')).toBeNull();
  });

  it('filters the library to the selected entries from the last filter, and Clear filters unchecks it', async () => {
    writeCart([]);
    await act(() => render(library('?f.ruleset=dnd-5e-2024'), root));
    const filter = () => root.querySelector<HTMLInputElement>('#gallery-selected')!;
    const all = root.querySelectorAll('.gallery__grid > li').length;
    await act(() => input('Cinder Hound').click());
    await act(() => filter().click());
    expect(root.querySelectorAll('.gallery__grid > li')).toHaveLength(1);
    expect(box('Cinder Hound')).toBeTruthy();
    expect(box('Frost Lance')).toBeUndefined();
    // Clear filters comes right after it.
    expect(filter().closest('.gallery__selected')!.nextElementSibling).toBe(root.querySelector('.gallery__clear'));
    await act(() => filter().click());
    expect(root.querySelectorAll('.gallery__grid > li')).toHaveLength(all);
    await act(() => filter().click());
    await act(() => (root.querySelector('.gallery__clear') as HTMLElement).click());
    expect(filter().checked).toBe(false);
  });
});
