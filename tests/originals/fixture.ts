// The original-ruleset fixtures (docs/rulesets.md#fixture-rulesets): Starships & Galaxies and Elementals,
// two small rulesets with their own rules data and content, so ruleset-generic code is tested against
// more than dnd-5e-2024. Tests validate, index, and load them in place, or copy them to a temporary
// folder to break one thing.
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RulesData } from '../../lib/rules.ts';
import type { RulesetDefinition, RulesetModule } from '../../rulesets/module.ts';
import { buildIndex } from '../../scripts/build-index/index.ts';
import { validateLibrary } from '../../scripts/validate/index.ts';
import type { Registry } from '../../site/src/lib/gallery/config.ts';
import { loadLibrary, type Entry } from '../../site/src/lib/library.ts';
import { rulesData } from '../../site/src/lib/rules.ts';
import type { PhraseBook } from '../../lib/wording/book.ts';
import { FIXTURES } from '../helpers.ts';

export const ORIGINALS = join(FIXTURES, 'originals');
export const RULESETS = ['starships-and-galaxies', 'elementals'] as const;
export type OriginalRuleset = (typeof RULESETS)[number];

const readJson = async (path: string): Promise<any> => JSON.parse(await readFile(path, 'utf8'));

/** The fixtures' registry, their own config/types.json. */
export const originalsRegistry = (root = ORIGINALS): Promise<Registry> => readJson(join(root, 'types.json'));

const options = async (root: string) => ({ rulesetsRoot: join(root, 'rulesets'), registry: await originalsRegistry(root) });

/** Validates the fixtures (or a copy) as the build would. */
export const validateOriginals = async (root = ORIGINALS) => validateLibrary(join(root, 'content'), await options(root));

/** Validates and indexes the fixtures (or a copy) as `build:index` would. */
export const buildOriginals = async (root = ORIGINALS) => buildIndex(join(root, 'content'), await options(root));

/** Each fixture ruleset's module, loaded from its folder. */
export async function originalModules(root = ORIGINALS): Promise<Map<string, RulesetModule>> {
  const modules = new Map<string, RulesetModule>();
  for (const id of RULESETS) {
    modules.set(id, ((await import(pathToFileURL(join(root, 'rulesets', id, 'index.ts')).href)) as { ruleset: RulesetModule }).ruleset);
  }
  return modules;
}

/** A fixture ruleset's phrase book, or undefined for any other ruleset. */
export const originalPhrases = (modules: Map<string, RulesetModule>) => (ruleset: string): PhraseBook | undefined => modules.get(ruleset)?.phrases;

/** Each fixture ruleset's rules data, as the site reads it. */
export async function originalRules(root = ORIGINALS): Promise<RulesData[]> {
  return Promise.all(
    RULESETS.map(async (id) => {
      const dir = join(root, 'rulesets', id, 'rules');
      const files: Record<string, unknown> = {};
      for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.json'))) {
        files[file.split('\\').join('/')] = await readJson(join(dir, file));
      }
      return rulesData((await readJson(join(root, 'rulesets', id, 'ruleset.json'))) as RulesetDefinition, files);
    }),
  );
}

/** The fixtures as the site loads them: rules data, and every entry derived and linked by its own module. */
export async function originalsSite(root = ORIGINALS) {
  const rules = await originalRules(root);
  const modules = await originalModules(root);
  const contentDir = join(root, 'content');
  const entries: Entry[] = [];
  for (const file of (await readdir(contentDir, { recursive: true })).filter((f) => f.endsWith('.json')).sort()) {
    entries.push((await readJson(join(contentDir, file))) as Entry);
  }
  const all = loadLibrary(entries, rules, (id) => modules.get(id)!);
  return { rules, modules, all, entries };
}

/**
 * A temporary copy of the fixtures, with `changes` applied to the files named by their path inside it
 * (`null` deletes one). The fixture modules import the repo by relative paths; in the copy, they point back.
 */
export async function brokenOriginals(changes: Record<string, unknown | null>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ttrpg-originals-'));
  await cp(ORIGINALS, root, { recursive: true });
  const repo = join(import.meta.dirname, '../..');
  for (const id of RULESETS) {
    const index = join(root, 'rulesets', id, 'index.ts');
    await writeFile(index, (await readFile(index, 'utf8')).replaceAll("'../../../../../", `'${repo}/`));
  }
  for (const [path, value] of Object.entries(changes)) {
    const file = join(root, path);
    if (value === null) await rm(file);
    else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    }
  }
  return root;
}

/** A JSON file of the fixtures, parsed. */
export const originalsJson = (path: string): Promise<any> => readJson(join(ORIGINALS, path));
