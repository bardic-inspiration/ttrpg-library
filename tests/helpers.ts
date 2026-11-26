import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const FIXTURES = join(import.meta.dirname, 'fixtures');

/** A fresh copy of the example cinder hound. */
export async function cinderHound(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(join(FIXTURES, 'library/valid/dnd-5e-2024/creature/cinder-hound.json'), 'utf8'));
}

/** A fresh copy of the example Frost Lance. */
export async function frostLance(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(join(FIXTURES, 'library/valid/dnd-5e-2024/spell/frost-lance.json'), 'utf8'));
}

/** A fresh copy of the example Wand of Frost Lances. */
export async function wandOfFrostLances(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(join(FIXTURES, 'library/valid/dnd-5e-2024/item/wand-of-frost-lances.json'), 'utf8'));
}

const EXAMPLE = join(FIXTURES, 'library/valid/dnd-5e-2024');

const readDir = async (dir: string): Promise<Record<string, any>[]> =>
  Promise.all((await readdir(dir)).filter((f) => f.endsWith('.json')).sort().map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'))));

/** The classes SRD spells name; any other missing class stays missing, so its ref fails as it would. */
const SRD_CASTERS = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'].map((id) => `class/${id}`);

/**
 * The SRD classes, with their features, that a spell in `entries` names but `entries` lacks: a spell's
 * classes are refs that must resolve, so a library built around a spell gets them as its
 * dependencies, as a batch would. Each is the example library's abbreviated Sorcerer with the
 * missing class's id and name, so it brings no refs of its own.
 */
async function missingClasses(entries: (Record<string, any> | { path: string; entry: Record<string, any> })[]): Promise<Record<string, any>[]> {
  const plain = entries.map((e) => ('path' in e && 'entry' in e ? e.entry : e) as Record<string, any>);
  const present = new Set(plain.map((e) => `${e.type}/${e.id}`));
  const named = new Set(plain.filter((e) => e.type === 'spell').flatMap((e) => (e.stats?.classes ?? []).map((c: { ref?: string }) => c.ref)));
  const wanted = [...named].filter((ref): ref is string => typeof ref === 'string' && SRD_CASTERS.includes(ref) && !present.has(ref));
  if (wanted.length === 0) return [];
  const [sorcerer] = (await readDir(join(EXAMPLE, 'class'))).filter((c) => c.id === 'sorcerer');
  const [feature] = (await readDir(join(EXAMPLE, 'class-feature'))).filter((f) => f.id === 'sorcerer-spellcasting');
  return wanted.flatMap((ref) => {
    const id = ref.slice('class/'.length);
    const name = id.replace(/(^|-)(\w)/g, (_, dash: string, c: string) => (dash ? ' ' : '') + c.toUpperCase());
    const featureId = `${id}-spellcasting`;
    return [
      { ...structuredClone(sorcerer), id, name, stats: { ...structuredClone(sorcerer!.stats), features: [{ ref: `class-feature/${featureId}` }] } },
      { ...structuredClone(feature), id: featureId },
    ];
  });
}

/**
 * Writes entries into a temporary repo: `<repo>/content/<path>`. Each entry is
 * placed at `<ruleset>/<type>/<id>.json` unless a path is given.
 */
export async function tempLibrary(
  entries: (Record<string, any> | { path: string; entry: Record<string, any> })[],
): Promise<{ repo: string; content: string }> {
  entries = [...entries, ...(await missingClasses(entries))];
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
