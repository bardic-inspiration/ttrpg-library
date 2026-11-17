// Print export (docs/export.md#print). Opens the print view for the entries; the
// print view loads them, injects the `@page` footer, and opens the browser's
// print dialog, where the reader picks the paper and can save a PDF. Entry
// and set scope.
import { printUrl } from '../lib/print.ts';
import { resolveIO } from './io.ts';
import type { Exporter } from './types.ts';

export const print: Exporter = {
  id: 'print',
  label: 'Print',
  scopes: ['entry', 'set'],
  async run(items, options) {
    if (items.length === 0) throw new Error('Print takes at least one entry');
    if (options.scope === 'entry' && items.length !== 1) throw new Error('Entry export takes exactly one entry');
    resolveIO(options).open(printUrl(options.base, items.map((item) => `${item.entry.type}/${item.entry.id}`)));
  },
};
