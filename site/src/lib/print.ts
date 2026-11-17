// The print view's URLs and page rules (docs/export.md#print): the query a `/print/`
// URL carries, the page size it asks for, where each entry's print fragment is
// served, and the `@page` rules injected at runtime. Pure functions, light
// enough for the export controls; lib/print-run.ts resolves and loads entries.

import config from '../../../config/export.json' with { type: 'json' };

export interface PageSize {
  id: string;
  label: string;
  width: string;
  height: string;
  margin: string;
  columns: number;
  default?: boolean;
}

export const pageSizes: PageSize[] = config.pageSizes;

/** The short SRD attribution (docs/licensing.md#srd-attribution) each printed page carries in its footer. */
export const SHORT_ATTRIBUTION = 'Includes adapted SRD 5.2 material, CC-BY-4.0';

/** The page size with this id, or the configured default for a missing or unknown id. */
export function resolveSize(id: string | null | undefined, sizes: PageSize[] = pageSizes): PageSize {
  const fallback = sizes.find((size) => size.default) ?? sizes[0];
  if (!fallback) throw new Error('config/export.json lists no page sizes');
  return sizes.find((size) => size.id === id) ?? fallback;
}

export interface PrintQuery {
  /** Entry keys (`<type>/<id>`) from `ids`, in order and without repeats, or undefined for the gallery-query form. */
  ids?: string[];
  size: PageSize;
  /** The query string without `ids` and `size`, read as a gallery query when `ids` is absent. */
  gallery: string;
}

/** Reads a `/print/` query string: `?ids=spell/a,creature/b&size=letter` or `?<gallery query>&size=letter`. */
export function parsePrintQuery(search: string, sizes: PageSize[] = pageSizes): PrintQuery {
  const params = new URLSearchParams(search);
  const rawIds = params.get('ids');
  const ids = rawIds === null ? undefined : [...new Set(rawIds.split(',').map((id) => id.trim()).filter((id) => id !== ''))];
  const size = resolveSize(params.get('size'), sizes);
  const gallery = search
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => pair !== '' && !/^(ids|size)(=|$)/.test(pair))
    .join('&');
  return { ...(ids !== undefined && { ids }), size, gallery };
}

/** Where an entry's print fragment is served, under the site base (ending in `/`). */
export const fragmentUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}print/${entry.ruleset}/${entry.type}/${entry.id}/`;

/** The print view URL for these entries (`<type>/<id>` keys) at a page size. The slash stays readable. */
export const printUrl = (base: string, keys: string[], size?: string): string =>
  `${base}print/?ids=${keys.map((key) => encodeURIComponent(key).replace(/%2F/g, '/')).join(',')}${size ? `&size=${encodeURIComponent(size)}` : ''}`;

/** A CSS string literal. */
export const cssString = (text: string): string =>
  `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\f]/g, ' ')}"`;

const FOOTER_BOX = 'font-family: var(--font-ui); font-size: var(--print-footer-size); color: var(--color-text-muted);';

/**
 * The `@page` rule for a print run: the chosen size and margin, with the short
 * attribution in every page's footer. Entries stack onto shared pages, so the
 * footer names no entry; the site footer, with the full attribution, prints
 * after the last entry.
 */
export function pageRules(size: PageSize): string {
  return (
    `@page { size: ${size.width} ${size.height}; margin: ${size.margin}; ` +
    `@bottom-right { content: ${cssString(SHORT_ATTRIBUTION)}; ${FOOTER_BOX} } }`
  );
}
