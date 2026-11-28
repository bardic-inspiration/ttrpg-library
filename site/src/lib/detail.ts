// Lines for the detail page (docs/site.md#detail-page) that aren't the type template:
// provenance. Source issues aren't shown: an entry page links nothing on GitHub but Contribute.

import licenses from '../../../config/licenses.json' with { type: 'json' };
import type { Licenses } from '../../../lib/licenses.ts';
import { isOfficial } from '../../../rulesets/module.ts';
import type { Entry } from './library.ts';

export interface SourceChip {
  kind: 'source' | 'author' | 'status';
  text: string;
}

/**
 * The chips after the type on a detail page (docs/site.md#detail-page): the source if it has one,
 * the author (an author of `"publisher"` reads as the ruleset's publisher), and whether the entry
 * is official or homebrew.
 */
export function sourceChips(entry: Entry, publisher: string | undefined): SourceChip[] {
  const official = isOfficial(entry);
  return [
    ...(entry.source ? [{ kind: 'source' as const, text: entry.source }] : []),
    { kind: 'author', text: official ? (publisher ?? entry.author) : entry.author },
    { kind: 'status', text: official ? 'Official' : 'Homebrew' },
  ];
}

export interface Provenance {
  createdAt: string;
  updatedAt?: string;
  /** An imported entry's credit (docs/content-model.md#meta): the author, the source, and the license by name. */
  credit?: { author: string; source: string; license: string; licenseUrl: string };
}

export const provenance = (entry: Entry): Provenance => ({
  createdAt: entry.meta.createdAt,
  ...(entry.meta.updatedAt ? { updatedAt: entry.meta.updatedAt } : {}),
  ...(entry.meta.source.license ? { credit: creditOf(entry.meta.source.license) } : {}),
});

function creditOf({ id, author, url }: { id: string; author: string; url: string }): NonNullable<Provenance['credit']> {
  const license = (licenses as Licenses).licenses[id];
  return { author, source: url, license: license?.name ?? id, licenseUrl: license?.url ?? url };
}
