// Which pages `npm run snapshots` captures (SPEC.md §9.8), read from the built
// library.json: the home page, the style guide, and the first detail page of
// each type that has an entry. Also the rules for the output folder's label.

import { detailPath, firstOfEachType, type IndexRecord } from '../a11y/index.ts';

export interface SnapshotPage {
  /** File name stem; the theme and `.png` are appended. */
  file: string;
  /** Path under the site base. */
  path: string;
}

export function snapshotPages(records: IndexRecord[]): SnapshotPage[] {
  return [
    { file: 'home', path: '' },
    { file: 'styleguide', path: 'styleguide/' },
    ...firstOfEachType(records).map((r) => ({ file: `${r.ruleset}-${r.type}`, path: detailPath(r) })),
  ];
}

/** A label is one plain folder name under `snapshots/`: no separators, not hidden. */
export function isValidLabel(label: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label);
}

/** The label used when none is given: the UTC time, such as `2026-11-01T09-05-03Z`. */
export function defaultLabel(now: Date = new Date()): string {
  return now.toISOString().replace(/\.\d+Z$/, 'Z').replaceAll(':', '-');
}
