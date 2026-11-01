// Links and lines for the detail page (SPEC.md §9.4) that aren't the type
// template: tag chips into the filtered type gallery, and provenance.

import { REPO_URL } from '../../../lib/site.ts';
import type { Entry } from './library.ts';

export interface TagChip {
  key: string;
  value: string;
  /** Path under the site base: the type gallery filtered by this tag (§9.3 URL state). */
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
        path: `${entry.ruleset}/${entry.type}/?${encodeURIComponent(`f.tags.${key}`)}=${encodeURIComponent(value)}`,
      };
    }),
  );
}

export interface Provenance {
  createdAt: string;
  updatedAt?: string;
  issues: { number: number; url: string }[];
}

export const provenance = (entry: Entry): Provenance => ({
  createdAt: entry.meta.createdAt,
  ...(entry.meta.updatedAt ? { updatedAt: entry.meta.updatedAt } : {}),
  issues: (entry.meta.source.issues ?? []).map((number) => ({ number, url: `${REPO_URL}/issues/${number}` })),
});
