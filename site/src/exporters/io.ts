// Default browser IO for exporters: fetch, a Blob download through a
// temporary link, the clock, opening a page, and a DOM capture of the detail page's capture
// source (loaded only when a capture runs).
import type { ExportFile, ExportIO, ExportItem, ExportOptions } from './types.ts';

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
    fetch: (url) => fetch(url),
    download: downloadFile,
    now: () => new Date(),
    capture: async (request) => (await import('../lib/capture.ts')).captureEntry(request),
    open: openPage,
    ...options.io,
  };
}

/** The URL of an entry's raw file, copied by build:index (§9.1 step 2). */
export const rawFileUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}data/${entry.ruleset}/${entry.type}/${entry.id}.json`;

/** The URL of an entry's export bundle, `{ entry, derived }`, written by build:index (§9.1 step 2). */
export const bundleUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}data/${entry.ruleset}/${entry.type}/${entry.id}.export.json`;

/**
 * Fetches the export bundles for these entries, in order, so a set action can
 * hand exporters real items (§10.1). Rejects if any bundle fails to load, so
 * the action runs on all of them or none.
 */
export async function loadExportItems(
  base: string,
  entries: Array<{ ruleset: string; type: string; id: string }>,
  fetchFn: ExportIO['fetch'] = (url) => fetch(url),
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
