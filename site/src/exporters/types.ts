// The exporter interface (SPEC.md §10.1). Each exporter is a module in this
// folder, listed by id in config/export.json; the detail page and the gallery
// build their export controls from that list, so adding an exporter needs no
// gallery code.
import type { Entry } from '../lib/library.ts';

export type ExportScope = 'entry' | 'set';

export interface ExportItem {
  entry: Entry;
  derived: Record<string, unknown>;
}

/** A file handed to the browser to save. */
export interface ExportFile {
  name: string;
  type: string;
  data: string | Blob;
}

/** The browser calls an exporter makes, injectable so tests run without a DOM. */
export interface ExportIO {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  download: (file: ExportFile) => void;
  now: () => Date;
}

export interface ExportOptions {
  scope: ExportScope;
  /** The site base URL, ending in `/` (`url()` in site/src/lib/url.ts). */
  base: string;
  /** Defaults to the browser's fetch, a Blob download, and the current time. */
  io?: Partial<ExportIO>;
}

export interface Exporter {
  id: string;
  label: string;
  scopes: ExportScope[];
  run(items: ExportItem[], options: ExportOptions): Promise<void>;
}
