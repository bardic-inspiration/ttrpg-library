// The index builder (SPEC.md §9.1): validates every entry, then writes
// library.json and a raw copy of each entry for export. Derived values, refs,
// and back-refs come from the validator, which computes them with the ruleset
// module and scripts/validate/refs.ts, so nothing here recomputes a rule.

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SITE_BASE } from '../../lib/site.ts';
import { validateLibrary, type ValidationError, type ValidEntry, type ValidateOptions } from '../validate/index.ts';
import type { Link } from '../validate/refs.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { plainText } from '../validate/text.ts';
import { isFlag, refOrTextValues, type Schema, type SchemaSet } from './schema-walk.ts';

/** One facet in config/types.json (§7). */
export interface Facet {
  path: string;
  label: string;
  kind: 'range' | 'enum';
  format?: string;
  order?: string[];
}

export interface TypeConfig {
  label: string;
  plural: string;
  template: string;
  facets: Facet[];
  [key: string]: unknown;
}

/** config/types.json (§7). */
export type Registry = Record<string, { label: string; attribution: string; types: Record<string, TypeConfig> }>;

/** One record of library.json, in the §9.1 shape and key order. */
export interface LibraryRecord {
  id: string;
  ruleset: string;
  type: string;
  name: string;
  summary: string;
  url: string;
  image: string | null;
  facets: Record<string, unknown>;
  tags: Record<string, unknown>;
  createdAt: string;
  refs: Link[];
  refBy: Link[];
  search: string;
}

export interface BuildResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  /** Sorted by ruleset, type, then id, so the output never depends on file order. */
  records: LibraryRecord[];
  /** Each entry's file under the content root, such as `dnd-5e-2024/creature/cinder-hound.json`, in record order. */
  files: string[];
}

export interface BuildOptions extends ValidateOptions {
  registry?: Registry;
}

export const loadRegistryFile = async (): Promise<Registry> =>
  JSON.parse(await readFile(join(PROJECT_ROOT, 'config/types.json'), 'utf8')) as Registry;

/** A ruleset's raw schemas, for the facets and search text that read them. */
async function loadSchemas(ruleset: string): Promise<{ files: Map<string, Schema> }> {
  const dir = join(PROJECT_ROOT, 'rulesets', ruleset, 'schemas');
  const files = new Map<string, Schema>();
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.schema.json'))) {
    files.set(file, JSON.parse(await readFile(join(dir, file), 'utf8')) as Schema);
  }
  return { files };
}

/** The value at a dotted path such as `stats.abilities.str`, or undefined. */
function at(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * The registry's facets for one entry, in registry order (§7). A missing value
 * is left out, except an omitted optional flag, which reads as `false` (§5.8).
 */
function facetValues(item: ValidEntry, facets: Facet[], schemas: SchemaSet): Record<string, unknown> {
  const source = { stats: item.entry.stats, derived: item.derived };
  const out: Record<string, unknown> = {};
  for (const { path } of facets) {
    const value = at(source, path);
    if (value !== undefined) out[path] = value;
    else if (path.startsWith('stats.') && isFlag(path.slice('stats.'.length), schemas)) out[path] = false;
  }
  return out;
}

/** Every `name` string in `stats`, at any depth, in document order: actions, traits, and the like. */
function names(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => (key === 'name' && typeof child === 'string' ? [child] : names(child)));
}

/** A ruleset text token such as `{dmg:1d4:fire}` (§6.4): markup, not words. */
const TOKEN = /\{[^{}]*\}/g;

/**
 * The §9.1 `search` text: action, trait, and spell names (a ref names its
 * target), then `description` and the rules text, with markup stripped.
 */
function searchText(item: ValidEntry, schemas: SchemaSet, nameOf: Map<string, string>): string {
  const refNames = refOrTextValues(item.entry.stats, schemas).flatMap((value) => {
    if (typeof value === 'string') return [value];
    const ref = (value as { ref?: unknown }).ref;
    const name = typeof ref === 'string' ? nameOf.get(ref) : undefined;
    return name ? [name] : [];
  });
  const texts = item.texts.map(({ text }) => plainText(text.replace(TOKEN, ' ')));
  return [...names(item.entry.stats), ...refNames, ...texts].join(' ').replace(/\s+/g, ' ').trim();
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Validates `root` and builds the library.json records. Records are empty
 * whenever validation fails, so a broken library never produces an index.
 */
export async function buildIndex(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const { errors, warnings, entries } = await validateLibrary(root, options);
  if (errors.length > 0) return { errors, warnings, records: [], files: [] };
  const registry = options.registry ?? (await loadRegistryFile());

  const nameOf = new Map(entries.map(({ entry }) => [`${entry.type}/${entry.id}`, entry.name]));
  const schemaFiles = new Map<string, { files: Map<string, Schema> }>();
  const sorted = [...entries].sort(
    (a, b) => compare(a.entry.ruleset, b.entry.ruleset) || compare(a.entry.type, b.entry.type) || compare(a.entry.id, b.entry.id),
  );

  const records: LibraryRecord[] = [];
  for (const item of sorted) {
    const { entry } = item;
    let loaded = schemaFiles.get(entry.ruleset);
    if (!loaded) schemaFiles.set(entry.ruleset, (loaded = await loadSchemas(entry.ruleset)));
    const root = loaded.files.get(`${entry.type}.schema.json`) ?? {};
    const schemas: SchemaSet = { root, files: loaded.files };
    const config = registry[entry.ruleset]?.types[entry.type];
    const meta = entry.meta as { createdAt: string };
    records.push({
      id: entry.id,
      ruleset: entry.ruleset,
      type: entry.type,
      name: entry.name,
      summary: entry.summary,
      url: `${SITE_BASE}${entry.ruleset}/${entry.type}/${entry.id}/`,
      image: typeof entry.image === 'string' ? entry.image : null,
      facets: facetValues(item, config?.facets ?? [], schemas),
      tags: (entry.tags as Record<string, unknown> | undefined) ?? {},
      createdAt: meta.createdAt,
      refs: item.refs,
      refBy: item.refBy,
      search: searchText(item, schemas, nameOf),
    });
  }
  return { errors, warnings, records, files: sorted.map((item) => item.file) };
}

/**
 * Writes `<out>/library.json` and copies each entry's raw file to
 * `<out>/data/<ruleset>/<type>/<id>.json` (§9.1 step 2). `data/` is cleared
 * first, so a deleted entry leaves no stale copy behind.
 */
export async function writeIndex(root: string, out: string, result: BuildResult): Promise<void> {
  await mkdir(out, { recursive: true });
  await rm(join(out, 'data'), { recursive: true, force: true });
  for (const [i, record] of result.records.entries()) {
    const target = join(out, 'data', record.ruleset, record.type, `${record.id}.json`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, result.files[i] ?? ''), target);
  }
  await writeFile(join(out, 'library.json'), `${JSON.stringify(result.records)}\n`);
}
