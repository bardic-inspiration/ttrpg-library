import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const FIXTURES = join(import.meta.dirname, 'fixtures');

/** A fresh copy of the §6.9 cinder hound. */
export async function cinderHound(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(join(FIXTURES, 'library/valid/dnd-5e-2024/creature/cinder-hound.json'), 'utf8'));
}

/**
 * Writes entries into a temporary repo: `<repo>/content/<path>`. Each entry is
 * placed at `<ruleset>/<type>/<id>.json` unless a path is given.
 */
export async function tempLibrary(
  entries: (Record<string, any> | { path: string; entry: Record<string, any> })[],
): Promise<{ repo: string; content: string }> {
  const repo = await mkdtemp(join(tmpdir(), 'ttrpg-lib-'));
  const content = join(repo, 'content');
  await mkdir(content, { recursive: true });
  for (const item of entries) {
    const { path, entry } =
      'path' in item && 'entry' in item
        ? (item as { path: string; entry: Record<string, any> })
        : { path: `${item.ruleset}/${item.type}/${item.id}.json`, entry: item };
    await mkdir(dirname(join(content, path)), { recursive: true });
    await writeFile(join(content, path), JSON.stringify(entry, null, 2));
  }
  return { repo, content };
}
