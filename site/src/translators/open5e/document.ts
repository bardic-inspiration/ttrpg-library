// What every exported Open5e record shares (docs/export.md#open5e): the library as its document,
// and keys under that document.

import { SITE_BASE } from '../../../../lib/site.ts';

export type Record5e = Record<string, any>;

/** The library's Open5e document key; every record's key starts with it. */
export const DOCUMENT_KEY = 'ttrpg-library';

export const DOCUMENT = {
  name: 'TTRPG Content Library',
  key: DOCUMENT_KEY,
  type: 'SOURCE',
  display_name: 'TTRPG Content Library',
  publisher: { name: 'TTRPG Content Library', key: DOCUMENT_KEY },
  gamesystem: { name: '5th Edition 2024', key: '5e-2024' },
  permalink: `https://bardic-inspiration.github.io${SITE_BASE}`,
};

/** The Open5e key of a library entry or rule, `<type>/<id>`: `ttrpg-library_<id>`, as Open5e keys a document's records. */
export const keyOf = (ref: string): string => `${DOCUMENT_KEY}_${ref.slice(ref.indexOf('/') + 1)}`;

/** A `{ key, name }` summary, Open5e's form for a related record. */
export const summary = (key: string, name: string): { key: string; name: string } => ({ key, name });
