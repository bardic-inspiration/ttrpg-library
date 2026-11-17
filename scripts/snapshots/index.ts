// Which pages `npm run snapshots` captures (docs/styling.md#refinement-workflow), read from the built
// library.json: the home page, the style guide, and the first detail page of
// each type that has an entry, each at the phone, tablet, and desktop widths a
// UI PR shows (docs/workflow.md#ui-screenshots). Also the rules for the output folder's label.

import { detailPath, firstOfEachType, type IndexRecord } from '../a11y/index.ts';

export interface SnapshotPage {
  /** File name stem; `.png` is appended. */
  file: string;
  /** Path under the site base. */
  path: string;
}

/** Viewport widths in CSS px: phone, tablet, desktop. */
export const SNAPSHOT_WIDTHS = [390, 820, 1440] as const;

/** The PNG file name for one page at one width, such as `home-390.png`. */
export function snapshotFile(page: SnapshotPage, width: number): string {
  return `${page.file}-${width}.png`;
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
