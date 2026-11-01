// Loading a print run (SPEC.md §10.4): resolves a `/print/` query's entries
// against library.json, reusing the gallery's filtering for the gallery-query
// form, and fetches each entry's print fragment.

import { galleryConfig, type LibraryRecord, type Registry } from './gallery/config.ts';
import { parseQuery } from './gallery/state.ts';
import { computeView, searchIndex } from './gallery/view.ts';
import { fragmentUrl, parsePrintQuery, type PageSize, type PrintQuery } from './print.ts';

export interface PrintSelection {
  /** The records to print, in print order. */
  records: LibraryRecord[];
  /** Ids from `ids` that no record has. */
  missing: string[];
}

/**
 * The entries a print query names. The `ids` form keeps the given order. The
 * gallery-query form reads the rest of the query as the home gallery's (`/`,
 * §9.3), so `f.type` narrows by type, and prints its results in its order.
 */
export function selectEntries(query: PrintQuery, records: LibraryRecord[], registry: Registry): PrintSelection {
  if (query.ids) {
    const byId = new Map(records.map((record) => [record.id, record]));
    return {
      records: query.ids.map((id) => byId.get(id)).filter((r): r is LibraryRecord => r !== undefined),
      missing: query.ids.filter((id) => !byId.has(id)),
    };
  }
  const gallery = galleryConfig(registry, {});
  const view = computeView(records, gallery, parseQuery(query.gallery, gallery), searchIndex(records));
  return { records: view.results, missing: [] };
}

export interface PrintFragment {
  record: LibraryRecord;
  /** The entry's print fragment markup, built by the site. */
  html: string;
}

export type PrintRun = { ok: true; size: PageSize; fragments: PrintFragment[] } | { ok: false; size: PageSize; message: string };

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Loads a print run: reads the query, resolves its entries against
 * library.json, and fetches each entry's fragment. Any unknown id or failed
 * fetch fails the run with a message, so the print dialog never opens on a
 * partial set.
 */
export async function loadPrintRun(search: string, base: string, registry: Registry, fetch: Fetch): Promise<PrintRun> {
  const query = parsePrintQuery(search);
  const { size } = query;
  const fail = (message: string): PrintRun => ({ ok: false, size, message });
  const index = await fetch(`${base}library.json`).catch(() => undefined);
  if (!index?.ok) return fail('The library couldn’t be loaded. Try reloading the page.');
  const { records, missing } = selectEntries(query, JSON.parse(await index.text()) as LibraryRecord[], registry);
  if (missing.length > 0) return fail(`No entry has the id ${missing.map((id) => `“${id}”`).join(', ')}.`);
  if (records.length === 0) return fail('No entries to print.');
  const fragments = await Promise.all(
    records.map(async (record) => {
      const response = await fetch(fragmentUrl(base, record)).catch(() => undefined);
      return response?.ok ? { record, html: await response.text() } : undefined;
    }),
  );
  const failed = records.filter((_, i) => fragments[i] === undefined);
  if (failed.length > 0) return fail(`${failed.map((r) => r.name).join(', ')} couldn’t be loaded. Try reloading the page.`);
  return { ok: true, size, fragments: fragments as PrintFragment[] };
}
