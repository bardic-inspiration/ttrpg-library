// The print view's URLs and page rules (docs/export.md#print): the query a `/print/`
// URL carries, where each entry's print fragment is served, and the `@page`
// footer injected at runtime. The print view takes no page size: the reader
// picks the paper in the print dialog, and tokens/print.css sets the layout
// and margins by its width (docs/export.md#print-layout). Pure functions, light
// enough for the export controls; lib/print-run.ts resolves and loads entries.

/** The short SRD attribution (docs/licensing.md#srd-attribution) each printed page carries in its footer. */
export const SHORT_ATTRIBUTION = 'Includes adapted SRD 5.2 material, CC-BY-4.0';

export interface PrintQuery {
  /** Entry keys (`<type>/<id>`) from `ids`, in order and without repeats, or undefined for the gallery-query form. */
  ids?: string[];
  /** The query string without `ids`, read as a gallery query when `ids` is absent. */
  gallery: string;
}

/** Reads a `/print/` query string: `?ids=spell/a,creature/b` or `?<gallery query>`. */
export function parsePrintQuery(search: string): PrintQuery {
  const params = new URLSearchParams(search);
  const rawIds = params.get('ids');
  const ids = rawIds === null ? undefined : [...new Set(rawIds.split(',').map((id) => id.trim()).filter((id) => id !== ''))];
  const gallery = search
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => pair !== '' && !/^ids(=|$)/.test(pair))
    .join('&');
  return { ...(ids !== undefined && { ids }), gallery };
}

/** Where an entry's print fragment is served, under the site base (ending in `/`). */
export const fragmentUrl = (base: string, entry: { ruleset: string; type: string; id: string }): string =>
  `${base}print/${entry.ruleset}/${entry.type}/${entry.id}/`;

/** The print view URL for these entries (`<type>/<id>` keys). The slash stays readable. */
export const printUrl = (base: string, keys: string[]): string =>
  `${base}print/?ids=${keys.map((key) => encodeURIComponent(key).replace(/%2F/g, '/')).join(',')}`;

/** A CSS string literal. */
export const cssString = (text: string): string =>
  `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\f]/g, ' ')}"`;

const FOOTER_BOX = 'font-family: var(--font-ui); font-size: var(--print-footer-size); color: var(--color-text-muted);';

/**
 * The `@page` rule for a print run: the short attribution in every page's
 * footer. It sets no size, so the paper chosen in the print dialog holds, and
 * no margin, which tokens/print.css sets by page width. Entries stack onto
 * shared pages, so the footer names no entry; the site footer, with the full
 * attribution, prints after the last entry.
 */
export function pageRules(): string {
  return `@page { @bottom-right { content: ${cssString(SHORT_ATTRIBUTION)}; ${FOOTER_BOX} } }`;
}
