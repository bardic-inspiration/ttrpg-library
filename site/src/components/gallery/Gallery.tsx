// A ruleset's Library gallery island (docs/site.md#pages-and-navigation, docs/site.md#gallery). It
// loads library.json once, then filters, searches, and sorts the ruleset's entries in memory, keeping the view in the query
// string. Its search box heads the filter menu; its set export sits in the page header
// (docs/site.md#page-header), where the gallery publishes its view. The logic lives in
// lib/gallery/; this file is the view.
import { useEffect, useMemo, useState } from 'preact/hooks';
import registryJson from '@library/config/types.json' with { type: 'json' };
import { fetchFresh } from '../../lib/fetch-fresh.ts';
import { defaultScope, galleryConfig, isScopePath, sortChoices, validSort, type FacetData, type LibraryRecord, type Registry } from '../../lib/gallery/config.ts';
import { isActive, isDefaultScope, parseQuery, toQuery, type FilterValue, type GalleryState } from '../../lib/gallery/state.ts';
import { filterTree } from '../../lib/gallery/tree.ts';
import { computeView } from '../../lib/gallery/view.ts';
import { rulesetRegistry } from '../../lib/gallery/library-url.ts';
import FilterIcon from '../../icons/Filter.tsx';
import SearchIcon from '../../icons/Search.tsx';
import SortIcon from '../../icons/Sort.tsx';
import { cartKey, pruneCart, setInCart, writeCart } from '../../lib/cart.ts';
import { publishView } from '../../lib/library-view.ts';
import { useCart } from '../cart/useCart.ts';
import Button from '../shared/Button.tsx';
import { DisclosureButton } from '../shared/Disclosure.tsx';
import Card from './Card.tsx';
import { FilterTree } from './Filters.tsx';
import './gallery.css';

export interface GalleryProps {
  /** Where library.json is served, under the site base. */
  indexUrl: string;
  /** The site base, for art paths (docs/content-model.md#images). */
  base: string;
  /** Records to show without fetching, for the style guide and tests. */
  records?: LibraryRecord[];
  /** The query string to start from; defaults to the page's. */
  initialQuery?: string;
  /** Ref targets' names and grouped types' groups, from the build (docs/site.md#gallery "Filters"). */
  facetData?: FacetData;
  /** The ruleset whose Library this is; every ruleset's entries when it's left out, as in the style guide. */
  ruleset?: string;
  /** The ruleset's rules pages, listed under the filter menu (docs/site.md#gallery "Layout"). */
  rules?: RulesLink[];
}

export interface RulesLink {
  title: string;
  href: string;
}

const registry = registryJson as unknown as Registry;

const resultText = (n: number) => (n === 0 ? 'No entries match.' : n === 1 ? '1 entry' : `${n} entries`);

export default function Gallery({ indexUrl, base, records: given, initialQuery, facetData, ruleset, rules = [] }: GalleryProps) {
  const own = useMemo(() => rulesetRegistry(registry, ruleset), [ruleset]);
  const config = useMemo(() => galleryConfig(own, facetData), [own, facetData]);
  // Every ruleset's records, which the cart reads; the gallery shows only its ruleset's.
  const [all, setRecords] = useState<LibraryRecord[] | undefined>(given);
  const records = useMemo(() => all?.filter((r) => Object.hasOwn(own, r.ruleset)), [all, own]);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<GalleryState>(() =>
    parseQuery(initialQuery ?? (typeof window === 'undefined' ? '' : window.location.search), config),
  );
  const cart = useCart();
  // The filter menu's container on phones and tablets, closed by default; on desktop it's a sidebar and always shows.
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (given) return;
    fetchFresh(indexUrl)
      .then((response) => (response.ok ? (response.json() as Promise<LibraryRecord[]>) : Promise.reject(response.status)))
      .then(setRecords)
      .catch(() => setFailed(true));
  }, [indexUrl, given]);

  // An entry the library no longer has drops out of the cart once the library loads.
  useEffect(() => {
    if (all && !given) pruneCart(new Set(all.map(cartKey)));
  }, [all, given]);

  // Keep the URL in step with the view, without adding a history entry per keystroke.
  useEffect(() => {
    if (initialQuery !== undefined || typeof window === 'undefined') return;
    const query = toQuery(state, config);
    if (query !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
  }, [state, config, initialQuery]);

  const view = useMemo(() => computeView(records ?? [], config, state), [records, config, state]);

  // The header's set export follows the results.
  useEffect(() => {
    publishView(all ? { records: all, results: view.results } : {});
  }, [all, view.results]);

  if (failed) return <p class="gallery__status">The library couldn’t be loaded. Try reloading the page.</p>;
  if (!records) return <p class="gallery__status">Loading the library…</p>;

  const update = (change: (next: GalleryState) => void) =>
    setState((current) => {
      const next = { ...current, filters: new Map(current.filters) };
      change(next);
      next.sort = validSort(config, next.sort, next.filters);
      return next;
    });
  const setFilter = (path: string, value: FilterValue) =>
    update((next) => {
      if (isActive(value)) next.filters.set(path, value);
      else next.filters.delete(path);
    });

  const tree = filterTree(config, state, records);
  const inCart = new Set(cart);
  const choices = sortChoices(config, state.filters);

  return (
    <div class="gallery">
      <div class="gallery__layout">
        <div class="gallery__menu">
          <div class="gallery__search" role="search">
            <label for="gallery-q">
              <SearchIcon /> Search
            </label>
            <input
              id="gallery-q"
              type="search"
              placeholder="Name"
              value={state.q}
              onInput={(e) => {
                const q = (e.currentTarget as HTMLInputElement).value;
                setState((current) => (current.q === q ? current : { ...current, q }));
              }}
            />
          </div>
          <DisclosureButton
            class="gallery__filters-toggle"
            controls="gallery-filters"
            open={filtersOpen}
            onToggle={setFiltersOpen}
            label={
              <>
                <FilterIcon /> Filters
              </>
            }
          />
          <section id="gallery-filters" class="gallery__filters" aria-label="Filters" data-open={filtersOpen || undefined}>
            <FilterTree
              nodes={tree}
              filters={state.filters}
              onEnum={(path, values) => setFilter(path, { kind: 'enum', values })}
              onRange={(path, min, max) => setFilter(path, { kind: 'range', ...(min !== undefined && { min }), ...(max !== undefined && { max }) })}
            />
            {(!isDefaultScope(state.filters) || [...state.filters.keys()].some((path) => !isScopePath(path))) && (
              <Button
                class="gallery__clear"
                onClick={() =>
                  update((next) => {
                    next.filters = new Map(defaultScope());
                  })
                }
              >
                Clear filters
              </Button>
            )}
          </section>
          {rules.length > 0 && (
            <nav class="gallery__rules" aria-labelledby="gallery-rules">
              <h2 id="gallery-rules" class="gallery__rules-heading">
                Rules
              </h2>
              <ul class="gallery__rules-list">
                {rules.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.title}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <section class="gallery__results" aria-label="Results">
          <div class="gallery__sort">
            <label for="gallery-sort">
              <SortIcon /> Sort
            </label>
            <select
              id="gallery-sort"
              value={state.sort.path}
              onChange={(e) => {
                const path = (e.currentTarget as HTMLSelectElement).value;
                update((next) => {
                  next.sort = { ...next.sort, path };
                });
              }}
            >
              {choices.map((c) => (
                <option key={c.path} value={c.path}>
                  {c.label}
                </option>
              ))}
            </select>
            <label for="gallery-dir" class="visually-hidden">
              Direction
            </label>
            <select
              id="gallery-dir"
              value={state.sort.dir}
              onChange={(e) => {
                const dir = (e.currentTarget as HTMLSelectElement).value === 'desc' ? 'desc' : 'asc';
                update((next) => {
                  next.sort = { ...next.sort, dir };
                });
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div class="gallery__summary">
            <p role="status" class="gallery__count">
              {resultText(view.results.length)}
            </p>
            {cart.length > 0 && (
              <p class="gallery__cart">
                {cart.length} in cart{' '}
                <Button onClick={() => writeCart([])}>Empty cart</Button>
              </p>
            )}
          </div>
          <ul class="gallery__grid">
            {view.results.map((record) => {
              const typeInfo = config.types.get(`${record.ruleset}/${record.type}`);
              return (
                <li key={record.url}>
                  <Card
                    record={record}
                    typeLabel={typeInfo?.label ?? record.type}
                    cardFields={typeInfo?.cardFields ?? []}
                    imageSrc={record.image ? `${base}${record.image}` : undefined}
                    inCart={inCart.has(cartKey(record))}
                    onCart={(on) => setInCart(cartKey(record), on)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
