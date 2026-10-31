// Ruleset-independent checks across the library (SPEC.md §5.2, §5.6, §6.8 "All types").

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface EntryHead {
  file: string;
  ruleset: string;
  type: string;
  id: string;
  name: string;
  image?: string;
}

export interface FileIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

const IMAGE_WARN_BYTES = 500 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** The file must sit at `<ruleset>/<type>/<id>.json` under the content root. */
export function checkPath(entry: EntryHead): string | undefined {
  const expected = `${entry.ruleset}/${entry.type}/${entry.id}.json`;
  return entry.file === expected ? undefined : `file path must be content/${expected} to match ruleset, type, and id`;
}

/** Lowercased, ASCII-folded, with everything but letters and digits removed. */
export function normalizeName(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Unique IDs and names (errors), and near-duplicate names (warnings). */
export function checkUniqueness(entries: EntryHead[]): FileIssue[] {
  const issues: FileIssue[] = [];
  const byId = new Map<string, EntryHead>();
  const byName = new Map<string, EntryHead>();
  for (const entry of entries) {
    const sameId = byId.get(entry.id);
    if (sameId) issues.push({ level: 'error', file: entry.file, message: `id "${entry.id}" is already used by ${sameId.file}` });
    else byId.set(entry.id, entry);
    const key = entry.name.toLowerCase();
    const sameName = byName.get(key);
    if (sameName) issues.push({ level: 'error', file: entry.file, message: `name "${entry.name}" is already used by ${sameName.file}` });
    else byName.set(key, entry);
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [a, b] = [entries[i], entries[j]];
      if (!a || !b || a.name.toLowerCase() === b.name.toLowerCase()) continue;
      if (editDistance(normalizeName(a.name), normalizeName(b.name)) <= 2) {
        issues.push({ level: 'warning', file: b.file, message: `name "${b.name}" is close to "${a.name}" (${a.file})` });
      }
    }
  }
  return issues;
}

/** `image` names this entry's art and the file exists within the size limits (§5.6). */
export async function checkImage(entry: EntryHead, assetsRoot: string): Promise<FileIssue[]> {
  if (entry.image === undefined) return [];
  const pattern = new RegExp(`^assets/images/${entry.ruleset}/${entry.type}/${entry.id}\\.(png|jpg|webp)$`);
  if (!pattern.test(entry.image)) {
    return [{ level: 'error', file: entry.file, message: `image must be assets/images/${entry.ruleset}/${entry.type}/${entry.id}.(png|jpg|webp)` }];
  }
  let size: number;
  try {
    size = (await stat(join(assetsRoot, entry.image))).size;
  } catch {
    return [{ level: 'error', file: entry.file, message: `image ${entry.image} does not exist` }];
  }
  const kb = Math.round(size / 1024);
  if (size > IMAGE_MAX_BYTES) return [{ level: 'error', file: entry.file, message: `image is ${kb} KB, above the 2 MB limit` }];
  if (size > IMAGE_WARN_BYTES) return [{ level: 'warning', file: entry.file, message: `image is ${kb} KB, above 500 KB` }];
  return [];
}
