// The page header's search and set export (docs/site.md#page-header), on every page. Search is a
// form that opens the Library with the query (`?q=`), so it works without JavaScript; on the
// Library it searches the gallery as the reader types instead. Print and Download act on the
// print cart, or, on the Library, on the filtered results while the cart is empty. They need
// JavaScript, so they render only once the island hydrates.
import { useEffect, useState } from 'preact/hooks';
import { fetchFresh } from '../../lib/fetch-fresh.ts';
import { cartKey, pruneCart } from '../../lib/cart.ts';
import type { LibraryRecord } from '../../lib/gallery/config.ts';
import { cartTarget, setTarget, type SetTarget, type TargetEntry } from '../../lib/gallery/selection.ts';
import { currentView, onViewChange, requestSearch, type LibraryView } from '../../lib/library-view.ts';
import SearchIcon from '../../icons/Search.tsx';
import { useCart } from '../cart/useCart.ts';
import SetActions from '../export/SetActions.tsx';
import './header.css';

export interface HeaderActionsProps {
  /** The site base URL, ending in `/`: the Library. */
  base: string;
  /** The page is the Library, whose gallery the search and the set export follow. */
  library?: boolean;
  /** Renders before hydration; for tests. */
  ready?: boolean;
}

/**
 * Off the Library, the cart's entries as library.json has them, in the order they were added.
 * Entries the library no longer has drop out of the cart.
 */
async function libraryCart(base: string, keys: TargetEntry[]): Promise<TargetEntry[]> {
  const response = await fetchFresh(`${base}library.json`);
  if (!response.ok) throw new Error(`Fetching library.json failed with status ${response.status}`);
  const all = (await response.json()) as LibraryRecord[];
  pruneCart(new Set(all.map(cartKey)));
  return setTarget(all, [], keys.map(cartKey)).records;
}

export default function HeaderActions({ base, library = false, ready: initial = false }: HeaderActionsProps) {
  const [ready, setReady] = useState(initial);
  const [view, setView] = useState<LibraryView | undefined>(() => (library ? currentView() : undefined));
  const [q, setQ] = useState(view?.q ?? '');
  const cart = useCart();

  useEffect(() => {
    setReady(true);
    if (!library) return;
    const follow = (next: LibraryView) => {
      setView(next);
      setQ(next.q);
    };
    const now = currentView();
    if (now) follow(now);
    return onViewChange(follow);
  }, [library]);

  let target: SetTarget;
  if (!library) target = cartTarget(cart);
  else if (view?.records && view.results) target = setTarget(view.records, view.results, cart);
  else target = { records: [], cart: cart.length > 0 };

  return (
    <div class="header-actions">
      <form
        class="header-search"
        role="search"
        action={base}
        method="get"
        onSubmit={(e) => {
          if (library) e.preventDefault();
        }}
      >
        <label for="site-q">
          <SearchIcon /> Search
        </label>
        <input
          id="site-q"
          name="q"
          type="search"
          placeholder="Name"
          value={q}
          onInput={(e) => {
            const next = (e.currentTarget as HTMLInputElement).value;
            setQ(next);
            if (library) requestSearch(next);
          }}
        />
      </form>
      {ready && <SetActions target={target} base={base} resolve={library ? undefined : (keys) => libraryCart(base, keys)} />}
    </div>
  );
}
