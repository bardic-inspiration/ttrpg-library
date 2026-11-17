// The exporter registry (docs/export.md#exporter-interface, docs/export.md#export-config): config/export.json lists the
// exporters, in menu order, by id. Exporting places show Print and Download (docs/export.md#controls).
import config from '../../../config/export.json' with { type: 'json' };
import { json } from './json.ts';
import { png } from './png.ts';
import { print } from './print.ts';
import type { ExportScope, Exporter } from './types.ts';

export const modules: Record<string, Exporter> = { json, png, print };

/** The exporters named by `ids`, in order. An unknown id is a build error. */
export function exportersFor(ids: string[], scope?: ExportScope): Exporter[] {
  return ids
    .map((id) => {
      const exporter = modules[id];
      if (!exporter) throw new Error(`config/export.json lists unknown exporter "${id}"`);
      return exporter;
    })
    .filter((exporter) => !scope || exporter.scopes.includes(scope));
}

/** The configured exporters, optionally only those offering `scope`. */
export const configuredExporters = (scope?: ExportScope): Exporter[] => exportersFor(config.exporters, scope);

/** What an exporting place shows: at most a Print button and a Download menu (docs/export.md#controls). */
export interface ExportControlSet {
  print?: Exporter;
  /** The formats in Download's menu, in config order; empty means no Download button. */
  downloads: Exporter[];
}

/**
 * Splits `exporters` into the Print button and the Download menu's formats.
 * `download: false` leaves Download out, as on a page type's page.
 */
export function controlsFor(exporters: Exporter[], { download = true }: { download?: boolean } = {}): ExportControlSet {
  return {
    print: exporters.find((exporter) => exporter.kind === 'print'),
    downloads: download ? exporters.filter((exporter) => exporter.kind === 'download') : [],
  };
}

/** The configured controls for `scope`. */
export const configuredControls = (scope: ExportScope, options?: { download?: boolean }): ExportControlSet =>
  controlsFor(configuredExporters(scope), options);

export type { CaptureRequest, ExportItem, ExportKind, ExportOptions, ExportScope, Exporter } from './types.ts';
