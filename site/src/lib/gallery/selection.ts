// What a gallery set action runs on (SPEC.md §9.3 "Selection", §10.1): the
// selection when anything is selected, otherwise the whole filtered set.
// Selection lives in the page as record URLs, not in the query string.
import type { LibraryRecord } from './config.ts';

export interface SetTarget {
  /** The entries the action receives, in order. */
  records: LibraryRecord[];
  /** Whether they are the selection (true) or the filtered set (false). */
  selection: boolean;
}

/**
 * The entries a set action receives. With a selection: the selected results in
 * the gallery's current order, then selected entries the filters hide, in
 * index order. Without one: every result, in the gallery's current order.
 */
export function setTarget(all: LibraryRecord[], results: LibraryRecord[], selected: ReadonlySet<string>): SetTarget {
  if (selected.size === 0) return { records: results, selection: false };
  const shown = results.filter((record) => selected.has(record.url));
  const shownUrls = new Set(shown.map((record) => record.url));
  const hidden = all.filter((record) => selected.has(record.url) && !shownUrls.has(record.url));
  return { records: [...shown, ...hidden], selection: true };
}

/** Says what a set action targets: "3 selected", "1 entry", "12 entries". */
export function targetText({ records, selection }: SetTarget): string {
  const n = records.length;
  if (selection) return `${n} selected`;
  return n === 1 ? '1 entry' : `${n} entries`;
}
