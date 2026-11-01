// The exporter registry (SPEC.md §10.1, §10.5): config/export.json lists the
// exporters, in button order, by id.
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

export type { CaptureRequest, ExportItem, ExportOptions, ExportScope, Exporter } from './types.ts';
