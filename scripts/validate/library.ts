// Ruleset-independent checks across the library (docs/content-model.md#ids-and-names, docs/content-model.md#images, docs/content-model.md#validation "All types").

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { foldDiacritics } from '../../lib/text.ts';

export interface EntryHead {
  file: string;
  ruleset: string;
  type: string;
  id: string;
  name: string;
  image?: string;
  /** `meta.source.srd` is true (docs/content-model.md#srd-and-custom-entries). */
  srd?: boolean;
  /** A component, whose name is unique within its parent rather than its type (docs/content-model.md#components). */
  component?: boolean;
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
  return foldDiacritics(name).toLowerCase().replace(/[^a-z0-9]/g, '');
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

/**
 * Unique IDs and names within a type (errors), and near-duplicate names within
 * a type (warnings) (docs/content-model.md#ids-and-names). A spell and a creature may share a name. Two SRD
 * entries are never warned about, since neither name can change. A component's name is checked
 * within its parent instead (`checkComponents`).
 */
export function checkUniqueness(entries: EntryHead[]): FileIssue[] {
  const issues: FileIssue[] = [];
  const byId = new Map<string, EntryHead>();
  const byName = new Map<string, EntryHead>();
  for (const entry of entries) {
    const idKey = `${entry.type}/${entry.id}`;
    const sameId = byId.get(idKey);
    if (sameId) issues.push({ level: 'error', file: entry.file, message: `id "${entry.id}" is already used by ${sameId.file}` });
    else byId.set(idKey, entry);
    if (entry.component) continue;
    const key = `${entry.type}/${entry.name.toLowerCase()}`;
    const sameName = byName.get(key);
    if (sameName) issues.push({ level: 'error', file: entry.file, message: `name "${entry.name}" is already used by ${sameName.file}` });
    else byName.set(key, entry);
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [a, b] = [entries[i], entries[j]];
      if (!a || !b || a.type !== b.type || a.component || a.name.toLowerCase() === b.name.toLowerCase() || (a.srd && b.srd)) continue;
      if (editDistance(normalizeName(a.name), normalizeName(b.name)) <= 2) {
        issues.push({ level: 'warning', file: b.file, message: `name "${b.name}" is close to "${a.name}" (${a.file})` });
      }
    }
  }
  return issues;
}

/** `image` names this entry's art and the file exists within the size limits (docs/content-model.md#images). */
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

/** A component and the entries whose stats list it, by `{ ref }` object (docs/content-model.md#components). */
export interface ComponentListing {
  file: string;
  type: string;
  id: string;
  name: string;
  /** The types that may list it, from ruleset.json `components`. */
  parents: string[];
  listedBy: { file: string; type: string; id: string }[];
}

/**
 * Each component is listed by exactly one entry, of a type that may list it,
 * and its id starts with its parent's id and a hyphen. Within one parent, a
 * name repeats only where the later id adds a number (a level) to the earlier
 * one: "Improved Brutal Strike" at 13 and 17. Errors.
 */
export function checkComponents(components: ComponentListing[]): FileIssue[] {
  const issues: FileIssue[] = [];
  const error = (file: string, message: string) => issues.push({ level: 'error', file, message });
  const byParent = new Map<string, ComponentListing[]>();
  for (const c of components) {
    const parents = [...new Map(c.listedBy.map((p) => [`${p.type}/${p.id}`, p])).values()];
    const key = `${c.type}/${c.id}`;
    if (parents.length === 0) {
      error(c.file, `${key} is listed by no parent; a ${c.parents.join(' or ')} lists it by ref in its stats`);
      continue;
    }
    if (parents.length > 1) {
      error(c.file, `${key} is listed by ${parents.map((p) => `${p.type}/${p.id}`).join(' and ')}; a component has exactly one parent`);
      continue;
    }
    const parent = parents[0]!;
    const parentKey = `${parent.type}/${parent.id}`;
    if (c.listedBy.length > 1) error(c.file, `${key} is listed more than once by ${parentKey}`);
    if (!c.parents.includes(parent.type)) {
      error(c.file, `${key} is listed by ${parentKey}, but only a ${c.parents.join(' or ')} may list a ${c.type}`);
      continue;
    }
    if (!c.id.startsWith(`${parent.id}-`)) error(c.file, `id "${c.id}" must start with its parent's id, "${parent.id}-"`);
    const siblings = byParent.get(parentKey) ?? [];
    byParent.set(parentKey, [...siblings, c]);
  }
  for (const siblings of byParent.values()) {
    const byName = new Map<string, ComponentListing[]>();
    for (const c of siblings) byName.set(`${c.type}/${c.name.toLowerCase()}`, [...(byName.get(`${c.type}/${c.name.toLowerCase()}`) ?? []), c]);
    for (const same of byName.values()) {
      // The shortest id is the first printing; each later one is it plus a level.
      const [first, ...later] = [...same].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));
      for (const c of later) {
        if (!new RegExp(`^${first!.id}-\\d+$`).test(c.id)) {
          error(c.file, `name "${c.name}" is already used by ${first!.file} in the same parent; a name printed again at a later level adds the level to its id ("${first!.id}-17")`);
        }
      }
    }
  }
  return issues;
}
