// The gallery island (SPEC.md §9.2, §9.3) for `/`, `/<ruleset>/`, and
// `/<ruleset>/<type>/`. It loads library.json once, then filters, searches,
// and sorts in memory, keeping the view in the query string. The logic lives
// in lib/gallery/; this file is the view.
import { useEffect, useMemo, useState } from 'preact/hooks';
import registryJson from '../../../../config/types.json' with { type: 'json' };
import { filterDef, galleryConfig, sortChoices, type GalleryScope, type LibraryRecord, type Registry } from '../../lib/gallery/config.ts';
import { isActive, parseQuery, toQuery, type FilterValue, type GalleryState } from '../../lib/gallery/state.ts';
import { addableFilters, bounds, chips, computeView, hasValues, searchIndex, withoutFilter } from '../../lib/gallery/view.ts';
import SearchIcon from '../../icons/Search.tsx';
import SortIcon from '../../icons/Sort.tsx';
import { setTarget } from '../../lib/gallery/selection.ts';
import Card from './Card.tsx';
import { AddFilter, EnumFilter, RangeFilter, idFor } from './Filters.tsx';
import SetActions from './SetActions.tsx';
import './gallery.css';

export interface GalleryProps extends GalleryScope {
  /** Where library.json is served, under the site base. */
  indexUrl: string;
  /** The site base, for art paths (§5.6). */
  base: string;
  /** Records to show without fetching, for the style guide and tests. */
  records?: LibraryRecord[];
  /** The query string to start from; defaults to the page's. */
  initialQuery?: string;
}

const registry = registryJson as unknown as Registry;

const resultText = (n: number) => (n === 0 ? 'No entries match.' : n === 1 ? '1 entry' : `${n} entries`);

export default function Gallery({ ruleset, type, indexUrl, base, records: given, initialQuery }: GalleryProps) {
  const config = useMemo(() => galleryConfig(registry, { ruleset, type }), [ruleset, type]);
  const [records, setRecords] = useState<LibraryRecord[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<GalleryState>(() =>
    parseQuery(initialQuery ?? (typeof window === 'undefined' ? '' : window.location.search), config),
  );
  const [shown, setShown] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (given) return;
    fetch(indexUrl)
      .then((response) => (response.ok ? (response.json() as Promise<LibraryRecord[]>) : Promise.reject(response.status)))
      .then(setRecords)
      .catch(() => setFailed(true));
  }, [indexUrl, given]);

  // Keep the URL in step with the view, without adding a history entry per keystroke.
  useEffect(() => {
    if (initialQuery !== undefined || typeof window === 'undefined') return;
    const query = toQuery(state, config);
    if (query !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
  }, [state, config, initialQuery]);

  const index = useMemo(() => searchIndex(records ?? []), [records]);
  const view = useMemo(() => computeView(records ?? [], config, state, index), [records, config, state, index]);

  if (failed) return <p class="gallery__status">The library couldn’t be loaded. Try reloading the page.</p>;
  if (!records) return <p class="gallery__status">Loading the library…</p>;

  const update = (change: (next: GalleryState) => void) =>
    setState((current) => {
      const next = { ...current, filters: new Map(current.filters) };
      change(next);
      return next;
    });
  const setFilter = (path: string, value: FilterValue) =>
    update((next) => {
      if (isActive(value)) next.filters.set(path, value);
      else next.filters.delete(path);
    });

  // Shown filters: the defaults that have values here, any active filter, and any the reader added.
  const visible = [
    ...new Set([...config.defaultFilters.filter((path) => hasValues(path, view.scoped)), ...state.filters.keys(), ...shown]),
  ];
  const addable = addableFilters(config, state, view.scoped, view.results).filter((def) => !visible.includes(def.path));
  const choices = sortChoices(config);
  const sortValue = choices.some((c) => c.path === state.sort.path) ? state.sort.path : config.defaultSort.path;

  return (
    <div class="gallery">
      <div class="gallery__controls">
        <div class="gallery__search" role="search">
          <label for="gallery-q">
            <SearchIcon /> Search
          </label>
          <input
            id="gallery-q"
            type="search"
            placeholder="Name, tag, or text"
            value={state.q}
            onInput={(e) => {
              const q = (e.currentTarget as HTMLInputElement).value;
              update((next) => {
                next.q = q;
              });
            }}
          />
        </div>
        <div class="gallery__sort">
          <label for="gallery-sort">
            <SortIcon /> Sort
          </label>
          <select
            id="gallery-sort"
            value={sortValue}
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
      </div>

      <div class="gallery__layout">
        <section class="gallery__filters" aria-label="Filters">
          {visible.map((path) => {
            const def = filterDef(config, path);
            if (!def) return null;
            const onRemove = config.defaultFilters.includes(path)
              ? undefined
              : () => {
                  setShown(shown.filter((p) => p !== path));
                  update((next) => {
                    next.filters.delete(path);
                  });
                };
            return def.kind === 'range' ? (
              <RangeFilter
                key={path}
                def={def}
                bounds={bounds(path, view.scoped)}
                value={state.filters.get(path)}
                onRemove={onRemove}
                onChange={(min, max) => setFilter(path, { kind: 'range', ...(min !== undefined && { min }), ...(max !== undefined && { max }) })}
              />
            ) : (
              <EnumFilter
                key={path}
                def={def}
                chips={chips(def, view.scoped, withoutFilter(view.scoped, state, index, path), state.filters.get(path))}
                value={state.filters.get(path)}
                onRemove={onRemove}
                onChange={(values) => setFilter(path, { kind: 'enum', values })}
              />
            );
          })}
          <AddFilter
            options={addable}
            onAdd={(path) => {
              setShown([...shown, path]);
              // Move focus into the new group once it renders.
              requestAnimationFrame(() => document.getElementById(idFor(path))?.querySelector<HTMLElement>('.chip, input')?.focus());
            }}
          />
          {state.filters.size > 0 && (
            <button
              type="button"
              class="gallery__clear"
              onClick={() =>
                update((next) => {
                  next.filters.clear();
                })
              }
            >
              Clear filters
            </button>
          )}
        </section>

        <section class="gallery__results" aria-label="Results">
          <div class="gallery__summary">
            <p role="status" class="gallery__count">
              {resultText(view.results.length)}
            </p>
            {view.byRelevance && <p class="gallery__note">Sorted by relevance while searching.</p>}
            {selected.size > 0 && (
              <p class="gallery__selection">
                {selected.size} selected{' '}
                <button type="button" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              </p>
            )}
            <SetActions target={setTarget(records, view.results, selected)} base={base} />
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
                    selected={selected.has(record.url)}
                    onSelect={(on) => {
                      const next = new Set(selected);
                      if (on) next.add(record.url);
                      else next.delete(record.url);
                      setSelected(next);
                    }}
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
