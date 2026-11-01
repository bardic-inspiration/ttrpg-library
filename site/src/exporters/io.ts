// Default browser IO for exporters: fetch, a Blob download through a
// temporary link, the clock, opening a page, and a DOM capture of the detail page's capture
// source (loaded only when a capture runs).
import type { ExportFile, ExportIO, ExportOptions } from './types.ts';

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
