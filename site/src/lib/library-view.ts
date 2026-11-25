// The Library's view, shared with the page header (docs/site.md#page-header). The header's search
// and set export live outside the gallery island, so the two talk through window events: the
// gallery publishes its query, its records, and its results whenever they change, and the header
// asks it to search.
import type { LibraryRecord } from './gallery/config.ts';

/** Dispatched on `window` when the gallery's view changes. */
export const VIEW_EVENT = 'ttrpg-library:view';
/** Dispatched on `window`, with the query as its detail, when the header searches. */
export const SEARCH_EVENT = 'ttrpg-library:search';

export interface LibraryView {
  /** The search query. */
  q: string;
  /** Every entry, once library.json has loaded. */
  records?: LibraryRecord[];
  /** The filtered results, in the gallery's order, once library.json has loaded. */
  results?: LibraryRecord[];
}

let current: LibraryView | undefined;

/** The gallery's latest view, if a gallery on this page has published one. */
export const currentView = (): LibraryView | undefined => current;

/** Publishes the gallery's view to the header. */
export function publishView(view: LibraryView): void {
  current = view;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(VIEW_EVENT));
}

/** Calls `listener` with each view the gallery publishes. Returns the unsubscribe function. */
export function onViewChange(listener: (view: LibraryView) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const heard = () => current && listener(current);
  window.addEventListener(VIEW_EVENT, heard);
  return () => window.removeEventListener(VIEW_EVENT, heard);
}

/** Asks the gallery to search for `q`. */
export function requestSearch(q: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<string>(SEARCH_EVENT, { detail: q }));
}

/** Calls `listener` with each query the header asks for. Returns the unsubscribe function. */
export function onSearchRequest(listener: (q: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const heard = (event: Event) => listener(String((event as CustomEvent<unknown>).detail ?? ''));
  window.addEventListener(SEARCH_EVENT, heard);
  return () => window.removeEventListener(SEARCH_EVENT, heard);
}

/** Forgets the published view; for tests. */
export function resetView(): void {
  current = undefined;
}
