import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { checkImage, checkPath, checkUniqueness, type EntryHead, type FileIssue } from './library.ts';
import { formatErrors, loadEnvelopeValidator, loadRegistry, loadRuleset, type LoadedRuleset } from './schema.ts';
import { listEntryFiles } from './walk.ts';

export interface ValidationError {
  file: string;
  message: string;
}

/** An entry that passed the schema stage, with its derived values. */
export interface ValidEntry {
  file: string;
  entry: EntryHead & { summary: string; stats: unknown; [key: string]: unknown };
  derived: Record<string, unknown>;
}

export interface ValidationResult {
  files: string[];
  errors: ValidationError[];
  warnings: ValidationError[];
  entries: ValidEntry[];
}

export interface ValidateOptions {
  /** Where `image` paths resolve. Defaults to the content root's parent (the repo root). */
  assetsRoot?: string;
}

/**
 * Validates every entry under `root` (SPEC.md §6.8): JSON, the envelope and
 * `stats` schemas, a known ruleset and type, then the ruleset-independent and
 * ruleset consistency checks. Errors fail; warnings are reported only.
 */
export async function validateLibrary(root: string, options: ValidateOptions = {}): Promise<ValidationResult> {
  const assetsRoot = options.assetsRoot ?? dirname(resolve(root));
  const files = await listEntryFiles(root);
  const issues: FileIssue[] = [];
  const error = (file: string, message: string) => issues.push({ level: 'error', file, message });
  const envelope = await loadEnvelopeValidator();
  const registry = await loadRegistry();
  const rulesets = new Map<string, LoadedRuleset | undefined>();
  const heads: EntryHead[] = [];
  const entries: ValidEntry[] = [];

  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(join(root, file), 'utf8'));
    } catch (e) {
      error(file, `invalid JSON: ${(e as Error).message}`);
      continue;
    }
    if (!envelope(data)) {
      for (const message of formatErrors(envelope.errors)) error(file, message);
      continue;
    }
    const entry = data as ValidEntry['entry'];
    heads.push({ file, ruleset: entry.ruleset, type: entry.type, id: entry.id, name: entry.name, ...(entry.image ? { image: entry.image } : {}) });
    const pathError = checkPath({ ...entry, file });
    if (pathError) error(file, pathError);
    issues.push(...(await checkImage({ ...entry, file }, assetsRoot)));

    if (!rulesets.has(entry.ruleset)) {
      rulesets.set(entry.ruleset, registry[entry.ruleset] ? await loadRuleset(entry.ruleset) : undefined);
    }
    const ruleset = rulesets.get(entry.ruleset);
    if (!ruleset) {
      error(file, `ruleset: unknown ruleset "${entry.ruleset}"; it needs a rulesets/${entry.ruleset}/ folder and a config/types.json entry`);
      continue;
    }
    const validateStats = ruleset.stats.get(entry.type);
    if (!ruleset.module.definition.types.includes(entry.type) || !validateStats || !registry[entry.ruleset]?.types[entry.type]) {
      error(file, `type: unknown type "${entry.type}" for ${entry.ruleset}; it must be listed in ruleset.json, have a schema, and have a config/types.json entry`);
      continue;
    }
    if (!validateStats(entry.stats)) {
      for (const message of formatErrors(validateStats.errors, 'stats')) error(file, message);
      continue;
    }
    for (const issue of ruleset.module.check(entry.type, entry.stats)) {
      issues.push({ level: issue.level, file, message: `${issue.path}: ${issue.message}` });
    }
    entries.push({ file, entry, derived: ruleset.module.derive(entry.type, entry.stats) });
  }

  issues.push(...checkUniqueness(heads));
  const pick = (level: FileIssue['level']) =>
    issues.filter((i) => i.level === level).map(({ file, message }) => ({ file, message }));
  return { files, errors: pick('error'), warnings: pick('warning'), entries };
}
