// The exporter interface (docs/export.md#exporter-interface). Each exporter is a module in this
// folder, listed by id in config/export.json; the detail page and the gallery
// build their Print and Download controls from that list, so adding an
// exporter needs no gallery code.
import type { Entry } from '../lib/library.ts';
import type { Skip } from '../translators/types.ts';

export type ExportScope = 'entry' | 'set';

export interface ExportItem {
  entry: Entry;
  derived: Record<string, unknown>;
  /** The names of the entries and rules it links to, by `<type>/<id>`, for formats that write links as names. */
  names?: Record<string, string>;
}

/** What a download left out (docs/export.md#translators), shown on the site after it. */
export interface ExportReport {
  /** False when nothing in the scope could be exported, so no file downloaded. */
  downloaded: boolean;
  skipped: Skip[];
}

/** A file handed to the browser to save. */
export interface ExportFile {
  name: string;
  type: string;
  data: string | Blob;
}

/** An entry's capture source to render as an image (docs/export.md#png). */
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
  /** Defaults to the browser's fetch, a Blob download, the current time, an html-to-image capture, and a new tab. */
  io?: Partial<ExportIO>;
}

/**
 * `print` is the Print button; each `download` exporter is a format in the
 * Download button's menu (docs/export.md#controls).
 */
export type ExportKind = 'print' | 'download';

export interface Exporter {
  id: string;
  kind: ExportKind;
  /** The Print button's text, or the format's name in the Download menu ("PNG", "JSON"). */
  label: string;
  scopes: ExportScope[];
  /** The entry types it offers on an entry's page; every type when absent. A set export skips and reports the rest. */
  types?: string[];
  /** Resolves with a report when the format can't carry everything (docs/export.md#translators). */
  run(items: ExportItem[], options: ExportOptions): Promise<ExportReport | void>;
}
