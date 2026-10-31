import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * Lists every entry file under `root` (content/<ruleset>/<type>/<id>.json,
 * SPEC.md §4), as sorted paths relative to `root` with `/` separators. A
 * missing `root` is an empty library.
 */
export async function listEntryFiles(root: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(root, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => relative(root, join(root, name)).split(sep).join('/'))
    .sort();
}
