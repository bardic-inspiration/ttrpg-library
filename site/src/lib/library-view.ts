// The Library's view, shared with the page header (docs/site.md#page-header). The header's set
// export lives outside the gallery island, so the gallery publishes its records and its results
// through a window event whenever they change.
import type { LibraryRecord } from './gallery/config.ts';

/** Dispatched on `window` when the gallery's view changes. */
export const VIEW_EVENT = 'ttrpg-library:view';

export interface LibraryView {
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

/** Forgets the published view; for tests. */
export function resetView(): void {
  current = undefined;
}
