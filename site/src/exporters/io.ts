// Default browser IO for exporters: fetch, a Blob download through a
// temporary link, the clock, and a DOM capture of the detail page's capture
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

export function resolveIO(options: ExportOptions): ExportIO {
  return {
    fetch: (url) => fetch(url),
    download: downloadFile,
    now: () => new Date(),
    capture: async (request) => (await import('../lib/capture.ts')).captureEntry(request),
    ...options.io,
  };
}

/** The URL of an entry's raw file, copied by build:index (§9.1 step 2). */
export const rawFileUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}data/${entry.ruleset}/${entry.type}/${entry.id}.json`;
