// Default browser IO for exporters: fetch, a Blob download through a
// temporary link, the clock, opening a page, and a DOM capture of the detail page's capture
// source (loaded only when a capture runs).
import { fetchFresh } from '../lib/fetch-fresh.ts';
import type { EntryKey, ExportFile, ExportIO, ExportItem, ExportOptions, ExportReport, Exporter } from './types.ts';
import { zoneKey } from '../../../scripts/validate/refs.ts';

export function downloadFile(file: ExportFile): void {
  const blob = typeof file.data === 'string' ? new Blob([file.data], { type: file.type }) : file.data;
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = file.name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

/** Opens a site page in a new tab, or in this one when the browser blocks the tab. */
export function openPage(url: string): void {
  if (!window.open(url, '_blank')) window.location.assign(url);
}

export function resolveIO(options: ExportOptions): ExportIO {
  return {
    fetch: fetchFresh,
    download: downloadFile,
    now: () => new Date(),
    capture: async (request) => (await import('../lib/capture.ts')).captureEntry(request),
    open: openPage,
    ...options.io,
  };
}

/** The URL of an entry's raw file, copied by build:index (docs/site.md#index-build step 2). */
export const rawFileUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}data/${entry.ruleset}/${entry.type}/${entry.id}.json`;

/** The URL of an entry's export bundle, `{ entry, derived }`, written by build:index (docs/site.md#index-build step 2). */
export const bundleUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}data/${entry.ruleset}/${entry.type}/${entry.id}.export.json`;

/**
 * Fetches the export bundles for these entries, in order, so a set action can
 * hand exporters real items (docs/export.md#exporter-interface). Rejects if any bundle fails to load, so
 * the action runs on all of them or none.
 */
export async function loadExportItems(
  base: string,
  entries: Array<{ ruleset: string; type: string; id: string }>,
  fetchFn: ExportIO['fetch'] = fetchFresh,
): Promise<ExportItem[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const url = bundleUrl(base, entry);
      const response = await fetchFn(url);
      if (!response.ok) throw new Error(`Fetching ${url} failed with status ${response.status}`);
      return JSON.parse(await response.text()) as ExportItem;
    }),
  );
}

/**
 * Runs a set export on these entries (docs/export.md#exporter-interface): a keys-only exporter on
 * their keys alone, any other on their export bundles, fetched first, so it runs on all or none.
 */
export async function runSetExport(exporter: Exporter, entries: EntryKey[], options: ExportOptions): Promise<ExportReport | void> {
  if (exporter.keysOnly) return exporter.run(entries.map(({ ruleset, type, id }) => ({ entry: { ruleset, type, id } })), options);
  return exporter.run(await loadExportItems(options.base, entries, resolveIO(options).fetch), options);
}

/**
 * The names of the entries and rules `refs` link to, by `<type>/<id>`, as an export bundle carries
 * them, and of a map zone a ref names, by `<type>/<id>#<zone-id>`.
 */
export const linkNames = (refs: { key: string; zone?: string }[], names: Map<string, string>): Record<string, string> =>
  Object.fromEntries(
    refs.flatMap(({ key, zone }) => [key, ...(zone === undefined ? [] : [zoneKey(key, zone)])]).flatMap((key) => (names.has(key) ? [[key, names.get(key)!]] : [])),
  );
