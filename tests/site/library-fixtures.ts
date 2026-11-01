// The §6.9 fixture library, derived and linked as the site loads content.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { entryNames, loadLibrary, refTargets, type Entry, type LoadedEntry } from '../../site/src/lib/library.ts';
import { FIXTURES } from '../helpers.ts';

export async function fixtureLibrary() {
  const root = join(FIXTURES, 'library/valid');
  const files = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.json'));
  const entries = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(root, f), 'utf8')) as Entry));
  const all = loadLibrary(entries);
  const byId = (id: string): LoadedEntry => all.find(({ entry }) => entry.id === id)!;
  return { all, byId, names: entryNames(all), targets: refTargets(all) };
}

/** Text of rendered HTML: tags dropped, whitespace collapsed. */
export const textOf = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/ ([.,;:)])/g, '$1');
