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
}

export interface ExportOptions {
  scope: ExportScope;
  /** The site base URL, ending in `/` (`url()` in site/src/lib/url.ts). */
  base: string;
  /** Defaults to the browser's fetch, a Blob download, the current time, and an html-to-image capture. */
  io?: Partial<ExportIO>;
}

export interface Exporter {
  id: string;
  label: string;
  scopes: ExportScope[];
  run(items: ExportItem[], options: ExportOptions): Promise<void>;
}
