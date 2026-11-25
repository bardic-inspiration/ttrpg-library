// The index builder (docs/site.md#index-build): validates every entry, then writes
// library.json, a raw copy of each entry, and each entry's export bundle. Derived values, refs,
// and back-refs come from the validator, which computes them with the ruleset
// module and scripts/validate/refs.ts, so nothing here recomputes a rule.

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SITE_BASE } from '../../lib/site.ts';
import { validateLibrary, type ValidationError, type ValidEntry, type ValidateOptions } from '../validate/index.ts';
import type { Link } from '../validate/refs.ts';
import { loadRegistry, RULESETS_ROOT } from '../validate/schema.ts';
import { ruleNames } from '../../lib/rules.ts';
import { isFlag, type Schema, type SchemaSet } from './schema-walk.ts';

/** One facet in config/types.json (docs/site.md#type-registry). */
export interface Facet {
  path: string;
  label: string;
  kind: 'range' | 'enum';
  format?: string;
  /** A phrase book vocabulary whose display names the values read with (docs/site.md#wording). */
  vocabulary?: string;
  order?: string[];
  /** Its values are refs (docs/content-model.md#references), lifted as keys and read by their targets' names. */
  ref?: boolean;
  /** Its values are the type's leaf groups (docs/rulesets.md#rules-groups), offered nested and matched by group. */
  groups?: boolean;
}

export interface TypeConfig {
  label: string;
  plural: string;
  template: string;
  facets: Facet[];
  [key: string]: unknown;
}

/** config/types.json (docs/site.md#type-registry). */
export type Registry = Record<string, { label: string; types: Record<string, TypeConfig> }>;

/** One record of library.json, in the docs/site.md#index-build shape and key order. */
export interface LibraryRecord {
  id: string;
  ruleset: string;
  /** The work the entry belongs to, or null (docs/content-model.md#source-and-author). */
  source: string | null;
  author: string;
  type: string;
  name: string;
  summary: string;
  url: string;
  image: string | null;
  facets: Record<string, unknown>;
  createdAt: string;
  refs: Link[];
  refBy: Link[];
}

export interface BuildResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  /** Sorted by ruleset, type, then id, so the output never depends on file order. */
  records: LibraryRecord[];
  /** Each entry's file under the content root, such as `dnd-5e-2024/creature/cinder-hound.json`, in record order. */
  files: string[];
  /** Each entry's export bundle (docs/site.md#index-build step 2), in record order. */
  bundles: ExportBundle[];
}

/** `data/<ruleset>/<type>/<id>.export.json`: the entry and its derived values, as an exporter receives them (docs/export.md#exporter-interface). */
export interface ExportBundle {
  entry: ValidEntry['entry'];
  derived: Record<string, unknown>;
  /** The names of the entries and rules the entry links to, by `<type>/<id>`, for translators that write links as names. */
  names: Record<string, string>;
}

export interface BuildOptions extends ValidateOptions {
  registry?: Registry;
}

/** A ruleset's raw schemas, for the facets that read them. */
async function loadSchemas(ruleset: string, rulesetsRoot: string): Promise<{ files: Map<string, Schema> }> {
  const dir = join(rulesetsRoot, ruleset, 'schemas');
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

/** A ref facet's value as keys: a ref object reads as its `ref`, an array item by item. */
function refKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(refKeys);
  const ref = typeof value === 'object' && value !== null ? (value as { ref?: unknown }).ref : undefined;
  return typeof ref === 'string' ? ref : value;
}

/**
 * The registry's facets for one entry, in registry order (docs/site.md#type-registry). A missing value
 * is left out, except an omitted optional flag, which reads as `false` (docs/content-model.md#situational-fields).
 * A ref facet holds its refs' keys.
 */
function facetValues(item: ValidEntry, facets: Facet[], schemas: SchemaSet): Record<string, unknown> {
  const source = { stats: item.entry.stats, derived: item.derived };
  const out: Record<string, unknown> = {};
  for (const { path, ref } of facets) {
    const value = at(source, path);
    if (value !== undefined) out[path] = ref ? refKeys(value) : value;
    else if (path.startsWith('stats.') && isFlag(path.slice('stats.'.length), schemas)) out[path] = false;
  }
  return out;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Validates `root` and builds the library.json records. Records are empty
 * whenever validation fails, so a broken library never produces an index.
 */
export async function buildIndex(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const { errors, warnings, entries, components, rules } = await validateLibrary(root, options);
  if (errors.length > 0) return { errors, warnings, records: [], files: [], bundles: [] };
  const registry = options.registry ?? (await loadRegistry());
  const rulesetsRoot = options.rulesetsRoot ?? RULESETS_ROOT;

  // The names of the entries and rules an entry links to, for its export bundle.
  const nameOf = new Map([
    ...rules.flatMap((data) => [...ruleNames(data)]),
    ...[...entries, ...components].map(({ entry }) => [`${entry.type}/${entry.id}`, entry.name] as [string, string]),
  ]);
  const schemaFiles = new Map<string, { files: Map<string, Schema> }>();
  const sorted = [...entries].sort(
    (a, b) => compare(a.entry.ruleset, b.entry.ruleset) || compare(a.entry.type, b.entry.type) || compare(a.entry.id, b.entry.id),
  );

  const records: LibraryRecord[] = [];
  for (const item of sorted) {
    const { entry } = item;
    let loaded = schemaFiles.get(entry.ruleset);
    if (!loaded) schemaFiles.set(entry.ruleset, (loaded = await loadSchemas(entry.ruleset, rulesetsRoot)));
    const files = loaded.files;
    const schemasOf = (type: string): SchemaSet => ({ root: files.get(`${type}.schema.json`) ?? {}, files });
    const schemas = schemasOf(entry.type);
    const config = registry[entry.ruleset]?.types[entry.type];
    const meta = entry.meta as { createdAt: string };
    records.push({
      id: entry.id,
      ruleset: entry.ruleset,
      source: typeof entry.source === 'string' ? entry.source : null,
      author: entry.author as string,
      type: entry.type,
      name: entry.name,
      summary: entry.summary,
      url: `${SITE_BASE}${entry.ruleset}/${entry.type}/${entry.id}/`,
      image: typeof entry.image === 'string' ? entry.image : null,
      facets: facetValues(item, config?.facets ?? [], schemas),
      createdAt: meta.createdAt,
      refs: item.refs,
      refBy: item.refBy,
    });
  }
  return {
    errors,
    warnings,
    records,
    files: sorted.map((item) => item.file),
    bundles: sorted.map(({ entry, derived, refs }) => ({
      entry,
      derived,
      names: Object.fromEntries(refs.flatMap(({ key }) => (nameOf.has(key) ? [[key, nameOf.get(key)!]] : []))),
    })),
  };
}

/**
 * Writes `<out>/library.json`, copies each entry's raw file to
 * `<out>/data/<ruleset>/<type>/<id>.json`, and writes its export bundle beside
 * it as `<id>.export.json` (docs/site.md#index-build step 2). `data/` is cleared first, so a
 * deleted entry leaves no stale file behind.
 */
export async function writeIndex(root: string, out: string, result: BuildResult): Promise<void> {
  await mkdir(out, { recursive: true });
  await rm(join(out, 'data'), { recursive: true, force: true });
  for (const [i, record] of result.records.entries()) {
    const target = join(out, 'data', record.ruleset, record.type, `${record.id}.json`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, result.files[i] ?? ''), target);
    await writeFile(join(dirname(target), `${record.id}.export.json`), `${JSON.stringify(result.bundles[i])}\n`);
  }
  await writeFile(join(out, 'library.json'), `${JSON.stringify(result.records)}\n`);
}
