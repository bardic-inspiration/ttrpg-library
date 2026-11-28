import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
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
  await copyLibraryDiagrams(repo, entries.map((i) => ('path' in i && 'entry' in i ? i.entry : i) as Record<string, any>));
  return { repo, content };
}

const PROJECT = join(import.meta.dirname, '..');

/**
 * The library's entries of one ruleset minus the types a test's own fixtures stand in for
 * (AGENTS.md "Dev workflow" step 3), then `fixtures`. A library entry that links to a library entry
 * that is removed and that the fixtures don't replace, directly or through another dropped entry, goes too, so the rest still
 * resolve: encounters and modules link to maps, modules to encounters, characters to classes. A
 * link to a class `tempLibrary` adds for the spells that name it stays.
 */
export async function libraryWithout<T extends Record<string, any>>(standIn: string[], fixtures: Record<string, any>[] = [], ruleset = 'dnd-5e-2024'): Promise<T[]> {
  const root = join(PROJECT, 'content', ruleset);
  const types = await readdir(root);
  const whole = (await Promise.all(types.map((t) => readDir(join(root, t))))).flat() as T[];
  const kept = whole.filter((e) => !standIn.includes(e.type));
  const existed = new Set(whole.map((e) => `${e.type}/${e.id}`));
  const isRef = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(v) && types.includes(v.split('/')[0]!);
  const refsOf = (v: unknown): string[] => (isRef(v) ? [v] : Array.isArray(v) ? v.flatMap(refsOf) : v && typeof v === 'object' ? Object.values(v).flatMap(refsOf) : []);
  const present = new Set([...kept, ...fixtures].map((e) => `${e.type}/${e.id}`));
  for (let dropped = true; dropped; ) {
    dropped = false;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (!refsOf(kept[i]!.stats).some((r) => existed.has(r) && !present.has(r) && !SRD_CASTERS.includes(r))) continue;
      present.delete(`${kept[i]!.type}/${kept[i]!.id}`);
      kept.splice(i, 1);
      dropped = true;
    }
  }
  return kept;
}

/** Copies the library's diagrams for the map entries in `repo`, beside its content (docs/content-model.md#map-diagrams); a fixture's own diagram overwrites it. */
export async function copyLibraryDiagrams(repo: string, entries: Record<string, any>[]): Promise<void> {
  for (const e of entries.filter((x) => x.type === 'map')) {
    const from = join(PROJECT, 'assets/images', e.ruleset, 'map', `${e.id}.svg`);
    const to = join(repo, 'assets/images', e.ruleset, 'map', `${e.id}.svg`);
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to).catch(() => {});
  }
}
