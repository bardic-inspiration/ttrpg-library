// The reader's party (docs/site.md#difficulty-calculator): each character's level, in the order they
// were added, for the encounter page's difficulty calculator. It lives in local storage, wrapped as the
// cart is (docs/site.md#gallery "Cart and set actions"), so it carries from one encounter to the next.
// Every read and write is wrapped: with storage blocked, the party lasts only for the page.

/** The local storage key the party is kept under. */
export const PARTY_STORAGE_KEY = 'ttrpg-library:party';
/** Dispatched on `window` whenever this page changes the party. */
export const PARTY_EVENT = 'ttrpg-library:party';
/** The highest character level. */
export const MAX_LEVEL = 20;
/** The party before the reader enters one: four characters of level 1. */
export const DEFAULT_PARTY: readonly number[] = [1, 1, 1, 1];

/** The part of storage the party uses; `window.localStorage` in the browser. */
export interface PartyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isLevel = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LEVEL;

// The page's own copy, which is the whole party while storage is blocked.
let pageParty: number[] = [...DEFAULT_PARTY];

function browserStore(): PartyStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A stored party's levels; anything that isn't a level is dropped, and a party with none is the default. */
function parse(raw: string | null): number[] {
  if (raw === null) return [...DEFAULT_PARTY];
  const value: unknown = JSON.parse(raw);
  const levels = Array.isArray(value) ? value.filter(isLevel) : [];
  return levels.length > 0 ? levels : [...DEFAULT_PARTY];
}

/** The party's levels, in the order the characters were added. */
export function readParty(store: PartyStore | null = browserStore()): number[] {
  if (store) {
    try {
      pageParty = parse(store.getItem(PARTY_STORAGE_KEY));
    } catch {
      // Storage is blocked or holds something unreadable: keep the page's copy.
    }
  }
  return [...pageParty];
}

/** Replaces the party, and tells this page's listeners. A party keeps at least one character. */
export function writeParty(levels: readonly number[], store: PartyStore | null = browserStore()): number[] {
  const kept = levels.filter(isLevel);
  pageParty = kept.length > 0 ? kept : [...DEFAULT_PARTY];
  try {
    store?.setItem(PARTY_STORAGE_KEY, JSON.stringify(pageParty));
  } catch {
    // Storage is blocked: the party lasts only for the page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PARTY_EVENT));
  return [...pageParty];
}

/**
 * Calls `listener` whenever the party changes, in this page or another tab. Returns the
 * unsubscribe function.
 */
export function onPartyChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === PARTY_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(PARTY_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PARTY_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Resets the page's copy; for tests. */
export function resetPageParty(): void {
  pageParty = [...DEFAULT_PARTY];
}
