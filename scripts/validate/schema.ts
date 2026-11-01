// The schema stage (SPEC.md §5.1, §6.2): Ajv with JSON Schema draft 2020-12.

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { RulesetModule } from '../../rulesets/module.ts';

// ajv-formats ships CommonJS; under NodeNext its default import is the module object.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

/**
 * The repo root, where schemas/, rulesets/, and config/ live: the nearest
 * directory above this module that holds config/types.json. Searching rather
 * than counting `..` keeps it right when Astro bundles this module into
 * site/dist (the style guide builds the fixtures at build time).
 */
export const PROJECT_ROOT = findRoot(import.meta.dirname);

function findRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'config/types.json'))) return dir;
    if (dirname(dir) === dir) return join(import.meta.dirname, '../..');
  }
}

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));

/** Markdown-subset strings seen by the validation in progress, by JSON pointer. */
let markdownTexts: Map<string, string> | undefined;

function newAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  addFormats(ajv, ['date']);
  // `"markdownSubset": true` marks a string as markdown-subset text (§5.5). It
  // never fails; it records where those strings are so the text check can run
  // after the schema stage passes (§6.8).
  ajv.addKeyword({
    keyword: 'markdownSubset',
    schemaType: 'boolean',
    validate: (on: boolean, data: unknown, _parent?: unknown, cxt?: { instancePath: string }) => {
      if (on && typeof data === 'string' && cxt) markdownTexts?.set(cxt.instancePath, data);
      return true;
    },
  });
  return ajv;
}

/**
 * Runs `validate` on `data` and returns whether it passed, with every string
 * the schema marks `markdownSubset`, as paths rooted at `prefix`.
 */
export function validateWithText(
  validate: ValidateFunction,
  data: unknown,
  prefix = '',
): { valid: boolean; texts: { path: string; text: string }[] } {
  markdownTexts = new Map();
  try {
    const valid = validate(data) as boolean;
    return { valid, texts: [...markdownTexts].map(([pointer, text]) => ({ path: toPath(prefix, pointer), text })) };
  } finally {
    markdownTexts = undefined;
  }
}

/** `/stats/actions/0/range` → `stats.actions[0].range`. */
function toPath(prefix: string, pointer: string): string {
  let path = prefix;
  for (const part of pointer.split('/').slice(1)) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    path += /^\d+$/.test(key) ? `[${key}]` : path ? `.${key}` : key;
  }
  return path;
}

/** Ajv errors as readable messages, rooted at `prefix` (such as `stats`). */
export function formatErrors(errors: ErrorObject[] | null | undefined, prefix = ''): string[] {
  const messages = new Set<string>();
  for (const error of errors ?? []) {
    // `if` only says the `then` branch failed; the branch's own errors say why.
    if (error.keyword === 'if') continue;
    const path = toPath(prefix, error.instancePath);
    const at = (p: string) => p || '(entry)';
    switch (error.keyword) {
      case 'additionalProperties': {
        const key = String(error.params.additionalProperty);
        messages.add(`${at(path ? `${path}.${key}` : key)}: unknown key`);
        break;
      }
      case 'required':
        messages.add(`${at(path)}: missing required key "${String(error.params.missingProperty)}"`);
        break;
      case 'enum':
        messages.add(`${at(path)}: must be one of ${(error.params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ')}`);
        break;
      case 'false schema':
        messages.add(`${at(path)}: not allowed here`);
        break;
      default:
        messages.add(`${at(path)}: ${error.message ?? error.keyword}`);
    }
  }
  return [...messages];
}

export async function loadEnvelopeValidator(): Promise<ValidateFunction> {
  return newAjv().compile((await readJson(join(PROJECT_ROOT, 'schemas/envelope.schema.json'))) as object);
}

export interface LoadedRuleset {
  module: RulesetModule;
  /** `stats` validators by type, for types with a schema file. */
  stats: Map<string, ValidateFunction>;
}

/**
 * Loads `rulesets/<id>/`: its module and every `schemas/<type>.schema.json`.
 * Returns undefined when the folder or its index.ts is missing.
 */
export async function loadRuleset(id: string): Promise<LoadedRuleset | undefined> {
  const dir = join(PROJECT_ROOT, 'rulesets', id);
  let schemaFiles: string[];
  try {
    schemaFiles = await readdir(join(dir, 'schemas'));
  } catch {
    return undefined;
  }
  const { ruleset } = (await import(`../../rulesets/${id}/index.ts`)) as { ruleset: RulesetModule };
  const ajv = newAjv();
  const schemas = await Promise.all(
    schemaFiles.filter((f) => f.endsWith('.schema.json')).map(async (f) => ({ file: f, schema: (await readJson(join(dir, 'schemas', f))) as object })),
  );
  for (const { schema } of schemas) ajv.addSchema(schema);
  const stats = new Map<string, ValidateFunction>();
  for (const { file, schema } of schemas) {
    const type = file.replace(/\.schema\.json$/, '');
    if (type === 'common') continue;
    const validate = ajv.getSchema((schema as { $id: string }).$id);
    if (validate) stats.set(type, validate);
  }
  return { module: ruleset, stats };
}

/** config/types.json: which rulesets and types the registry knows (SPEC.md §7). */
export async function loadRegistry(): Promise<Record<string, { types: Record<string, unknown> }>> {
  return (await readJson(join(PROJECT_ROOT, 'config/types.json'))) as Record<string, { types: Record<string, unknown> }>;
}
