// The index builder (docs/site.md#index-build): validates every entry, then writes
// library.json, a raw copy of each entry, and each entry's export bundle. Derived values, refs,
// and back-refs come from the validator, which computes them with the ruleset
// module and scripts/validate/refs.ts, so nothing here recomputes a rule.

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { thumbnailDiagram } from '../../lib/diagram.ts';
import { SITE_BASE } from '../../lib/site.ts';
import { validateLibrary, type ValidationError, type ValidEntry, type ValidateOptions } from '../validate/index.ts';
import { diagramPath } from '../validate/diagram.ts';
import { MAP_TYPE } from '../validate/library.ts';
import { entryZones, type Link } from '../validate/refs.ts';
import { loadRegistry, loadRuleset, RULESETS_ROOT } from '../validate/schema.ts';
import { cardedPrimitives, ruleKey, rulePaths, ruleNames, type Primitive } from '../../lib/rules.ts';
import { isFlag, type Schema, type SchemaSet } from './schema-walk.ts';
import { PUBLISHER } from '../../rulesets/module.ts';

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
  /** Empty for a ruleset primitive, which has no summary. */
  summary: string;
  /** The detail page, or a primitive's section on its rules page, under the site base. */
  url: string;
  image: string | null;
  /** A map's diagram as its card's thumbnail (docs/site.md#gallery "Cards"), checked and rewritten; null for any other type. */
  diagram: string | null;
  facets: Record<string, unknown>;
  /** Null for a ruleset primitive, which has no `meta`. */
  createdAt: string | null;
  refs: Link[];
  refBy: Link[];
}

export interface BuildResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  /** Sorted by ruleset, type, then id, so the output never depends on file order. */
  records: LibraryRecord[];
  /**
   * Each record's raw file, in record order: an entry's under the content root, such as
   * `dnd-5e-2024/creature/cinder-hound.json`, and a primitive's as an absolute path in its ruleset's `rules/`.
   */
  files: string[];
  /** Each entry's export bundle (docs/site.md#index-build step 2), in record order. */
  bundles: ExportBundle[];
}

/** `data/<ruleset>/<type>/<id>.export.json`: the entry and its derived values, as an exporter receives them (docs/export.md#exporter-interface). */
export interface ExportBundle {
  /** The entry, or a primitive with its ruleset: `ruleset`, `type`, `id`, `name`, and `stats`. */
  entry: ValidEntry['entry'] | (Primitive & { ruleset: string });
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

/**
 * The value at a dotted path such as `stats.abilities.str`, or undefined. Through an array of objects
 * the rest of the path reads each item, `stats.classes.class` giving every class's `class`: nested
 * arrays flatten, each value once in first-seen order, and undefined when no item has it.
 */
function at(value: unknown, path: string): unknown {
  return walk(value, path.split('.'));
}

function walk(current: unknown, keys: string[]): unknown {
  if (keys.length === 0) return current;
  if (Array.isArray(current)) {
    const values = current.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
      const value = walk(item, keys);
      return value === undefined ? [] : Array.isArray(value) ? value : [value];
    });
    const unique = values.filter((v, i) => values.findIndex((w) => JSON.stringify(w) === JSON.stringify(v)) === i);
    return unique.length > 0 ? unique : undefined;
  }
  if (typeof current !== 'object' || current === null) return undefined;
  return walk((current as Record<string, unknown>)[keys[0]!], keys.slice(1));
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
function facetValues(item: { stats: unknown; derived: Record<string, unknown> }, facets: Facet[], schemas: SchemaSet): Record<string, unknown> {
  const source = { stats: item.stats, derived: item.derived };
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
  const { errors, warnings, entries, components, rules, ruleLinks } = await validateLibrary(root, options);
  if (errors.length > 0) return { errors, warnings, records: [], files: [], bundles: [] };
  const registry = options.registry ?? (await loadRegistry());
  const rulesetsRoot = options.rulesetsRoot ?? RULESETS_ROOT;
  const assetsRoot = options.assetsRoot ?? dirname(resolve(root));
  // A map's card shows its diagram, which validation has checked (docs/content-model.md#map-diagrams).
  const diagramOf = async (entry: ValidEntry['entry']): Promise<string | null> =>
    entry.type === MAP_TYPE
      ? thumbnailDiagram(
          await readFile(join(assetsRoot, diagramPath(entry)), 'utf8'),
          (entryZones(entry.stats) ?? []).map((zone) => zone.id),
          `${entry.type}/${entry.id}`,
        )
      : null;

  // The names of the entries and rules an entry links to, for its export bundle.
  const nameOf = new Map([
    ...rules.flatMap((data) => [...ruleNames(data)]),
    ...[...entries, ...components].map(({ entry }) => [`${entry.type}/${entry.id}`, entry.name] as [string, string]),
  ]);
  const schemaFiles = new Map<string, Map<string, Schema>>();
  const schemasFor = async (ruleset: string, type: string): Promise<SchemaSet> => {
    let files = schemaFiles.get(ruleset);
    if (!files) schemaFiles.set(ruleset, (files = (await loadSchemas(ruleset, rulesetsRoot)).files));
    return { root: files.get(`${type}.schema.json`) ?? {}, files };
  };
  const namesOf = (refs: Link[]) => Object.fromEntries(refs.flatMap(({ key }) => (nameOf.has(key) ? [[key, nameOf.get(key)!]] : [])));

  const rows: { record: LibraryRecord; file: string; bundle: ExportBundle }[] = [];
  for (const item of entries) {
    const { entry } = item;
    const config = registry[entry.ruleset]?.types[entry.type];
    const meta = entry.meta as { createdAt: string };
    rows.push({
      record: {
        id: entry.id,
        ruleset: entry.ruleset,
        source: typeof entry.source === 'string' ? entry.source : null,
        author: entry.author as string,
        type: entry.type,
        name: entry.name,
        summary: entry.summary,
        url: `${SITE_BASE}${entry.ruleset}/${entry.type}/${entry.id}/`,
        image: typeof entry.image === 'string' ? entry.image : null,
        diagram: await diagramOf(entry),
        facets: facetValues({ stats: entry.stats, derived: item.derived }, config?.facets ?? [], await schemasFor(entry.ruleset, entry.type)),
        createdAt: meta.createdAt,
        refs: item.refs,
        refBy: item.refBy,
      },
      file: item.file,
      bundle: { entry, derived: item.derived, names: namesOf(item.refs) },
    });
  }

  // A rules type that takes extensions has a card for each primitive beside its custom entries (docs/site.md#index-build).
  for (const data of rules) {
    const config = registry[data.ruleset];
    const carded = cardedPrimitives(data, (type) => config?.types[type] !== undefined);
    if (carded.length === 0) continue;
    const module = (await loadRuleset(data.ruleset, rulesetsRoot))?.module;
    const paths = rulePaths(data);
    for (const primitive of carded) {
      const key = ruleKey(primitive);
      const derived = module?.derive(primitive.type, primitive.stats, data) ?? {};
      const links = ruleLinks.get(key) ?? { refs: [], refBy: [] };
      rows.push({
        record: {
          id: primitive.id,
          ruleset: data.ruleset,
          source: null,
          author: PUBLISHER,
          type: primitive.type,
          name: primitive.name,
          summary: '',
          url: `${SITE_BASE}${paths.get(key)}`,
          image: null,
          diagram: null,
          facets: facetValues({ stats: primitive.stats, derived }, config!.types[primitive.type]!.facets, await schemasFor(data.ruleset, primitive.type)),
          createdAt: null,
          refs: links.refs,
          refBy: links.refBy,
        },
        file: resolve(rulesetsRoot, data.ruleset, 'rules', primitive.type, `${primitive.id}.json`),
        bundle: { entry: { ruleset: data.ruleset, ...primitive }, derived, names: namesOf(links.refs) },
      });
    }
  }

  rows.sort(
    (a, b) => compare(a.record.ruleset, b.record.ruleset) || compare(a.record.type, b.record.type) || compare(a.record.id, b.record.id),
  );
  return {
    errors,
    warnings,
    records: rows.map((row) => row.record),
    files: rows.map((row) => row.file),
    bundles: rows.map((row) => row.bundle),
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
    await copyFile(resolve(root, result.files[i] ?? ''), target);
    await writeFile(join(dirname(target), `${record.id}.export.json`), `${JSON.stringify(result.bundles[i])}\n`);
  }
  await writeFile(join(out, 'library.json'), `${JSON.stringify(result.records)}\n`);
}
