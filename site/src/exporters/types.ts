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

/** An entry's capture source to render as an image (SPEC.md §10.3). */
export interface CaptureRequest {
  /** The entry `id`, naming the detail page's capture source. */
  id: string;
  /** CSS width in pixels. */
  width: number;
  /** Device pixel ratio of the image. */
  scale: number;
}

/** The browser calls an exporter makes, injectable so tests run without a DOM. */
export interface ExportIO {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  download: (file: ExportFile) => void;
  now: () => Date;
  /** Renders the entry's capture source off-screen and returns it as a PNG. */
  capture: (request: CaptureRequest) => Promise<Blob>;
  /** Opens a page of the site, such as the print view. */
  open: (url: string) => void;
}

export interface ExportOptions {
  scope: ExportScope;
  /** The site base URL, ending in `/` (`url()` in site/src/lib/url.ts). */
  base: string;
  /** A page size id from config/export.json, for exporters that take one. */
  pageSize?: string;
  /** Defaults to the browser's fetch, a Blob download, the current time, an html-to-image capture, and a new tab. */
  io?: Partial<ExportIO>;
}

export interface Exporter {
  id: string;
  label: string;
  scopes: ExportScope[];
  /** Whether the exporter takes a page size, so its control comes with a page size selector. */
  pageSize?: boolean;
  run(items: ExportItem[], options: ExportOptions): Promise<void>;
}
