// The print cart (docs/site.md#gallery "Cart and set actions"): the entries a reader has gathered
// to print or download, in the order they were added. It lives in the browser's local storage,
// keyed by `<ruleset>/<type>/<id>`, so it survives page changes and reloads. Every read and write
// is wrapped: with storage blocked, the cart lasts only for the page. It isn't in the URL.

/** The local storage key the cart is kept under. */
export const CART_STORAGE_KEY = 'ttrpg-library:cart';
/** Dispatched on `window` whenever this page changes the cart. */
export const CART_EVENT = 'ttrpg-library:cart';

/** The part of storage the cart uses; `window.localStorage` in the browser. */
export interface CartStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** An entry's cart key: `<ruleset>/<type>/<id>`. */
export const cartKey = (entry: { ruleset: string; type: string; id: string }): string => `${entry.ruleset}/${entry.type}/${entry.id}`;

// The page's own copy, which is the whole cart while storage is blocked.
let pageCart: string[] = [];

function browserStore(): CartStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): string[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((key): key is string => typeof key === 'string'))];
}

/** The cart's keys, in the order they were added. */
export function readCart(store: CartStore | null = browserStore()): string[] {
  if (store) {
    try {
      pageCart = parse(store.getItem(CART_STORAGE_KEY));
    } catch {
      // Storage is blocked or holds something unreadable: keep the page's copy.
    }
  }
  return [...pageCart];
}

/** Replaces the cart, and tells this page's listeners. */
export function writeCart(keys: string[], store: CartStore | null = browserStore()): string[] {
  pageCart = [...new Set(keys)];
  try {
    store?.setItem(CART_STORAGE_KEY, JSON.stringify(pageCart));
  } catch {
    // Storage is blocked: the cart lasts only for the page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_EVENT));
  return [...pageCart];
}

/** Adds an entry to the end of the cart, or removes it. */
export function setInCart(key: string, on: boolean, store: CartStore | null = browserStore()): string[] {
  const keys = readCart(store).filter((k) => k !== key);
  return writeCart(on ? [...keys, key] : keys, store);
}

/** Drops entries the library no longer has. Writes only when something dropped out. */
export function pruneCart(known: ReadonlySet<string>, store: CartStore | null = browserStore()): string[] {
  const keys = readCart(store);
  const kept = keys.filter((key) => known.has(key));
  return kept.length === keys.length ? keys : writeCart(kept, store);
}

/**
 * Calls `listener` whenever the cart changes, in this page or another tab. Returns the
 * unsubscribe function.
 */
export function onCartChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(CART_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CART_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Resets the page's copy; for tests. */
export function resetPageCart(): void {
  pageCart = [];
}
