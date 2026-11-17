// Links and lines for the detail page (docs/site.md#detail-page) that aren't the type
// template: tag chips into the Library filtered to the type and tag, and provenance.

import licenses from '../../../config/licenses.json' with { type: 'json' };
import type { Licenses } from '../../../lib/licenses.ts';
import { REPO_URL } from '../../../lib/site.ts';
import type { Entry } from './library.ts';

export interface TagChip {
  key: string;
  value: string;
  /** Path under the site base: the Library filtered to the entry's ruleset, type, and this tag (docs/site.md#gallery URL state). */
  path: string;
}

/** One chip per tag value; an array tag gives one per item. */
export function tagChips(entry: Entry): TagChip[] {
  return Object.entries(entry.tags ?? {}).flatMap(([key, raw]) =>
    (Array.isArray(raw) ? raw : [raw]).map((item) => {
      const value = String(item);
      return {
        key,
        value,
        path: `?f.ruleset=${encodeURIComponent(entry.ruleset)}&f.type=${encodeURIComponent(entry.type)}&${encodeURIComponent(`f.tags.${key}`)}=${encodeURIComponent(value)}`,
      };
    }),
  );
}

export interface Provenance {
  createdAt: string;
  updatedAt?: string;
  issues: { number: number; url: string }[];
  /** An imported entry's credit (docs/content-model.md#meta): the author, the source, and the license by name. */
  credit?: { author: string; source: string; license: string; licenseUrl: string };
}

export const provenance = (entry: Entry): Provenance => ({
  createdAt: entry.meta.createdAt,
  ...(entry.meta.updatedAt ? { updatedAt: entry.meta.updatedAt } : {}),
  issues: (entry.meta.source.issues ?? []).map((number) => ({ number, url: `${REPO_URL}/issues/${number}` })),
  ...(entry.meta.source.license ? { credit: creditOf(entry.meta.source.license) } : {}),
});

function creditOf({ id, author, url }: { id: string; author: string; url: string }): NonNullable<Provenance['credit']> {
  const license = (licenses as Licenses).licenses[id];
  return { author, source: url, license: license?.name ?? id, licenseUrl: license?.url ?? url };
}
