import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { checkImage, checkPath, checkUniqueness, type EntryHead, type FileIssue } from './library.ts';
import { entryKey, linkEntries, type Link, type RefEntry } from './refs.ts';
import { PROJECT_ROOT, formatErrors, loadEnvelopeValidator, loadRegistry, loadRuleset, validateWithText, type LoadedRuleset } from './schema.ts';
import { termMatcher } from '../../lib/text.ts';
import { checkBlocklist, checkMarkdown, loadBlocklist } from './text.ts';
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
  /** Resolved refs out of this entry, in document order (SPEC.md §5.7). */
  refs: Link[];
  /** Resolved refs into this entry from other entries. */
  refBy: Link[];
  /** Every markdown-subset string in the entry (§5.5), `description` first, then `stats` in document order. */
  texts: { path: string; text: string }[];
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
  const blocklist = termMatcher(await loadBlocklist(PROJECT_ROOT));
  const rulesets = new Map<string, LoadedRuleset | undefined>();
  const heads: EntryHead[] = [];
  const entries: Omit<ValidEntry, 'refs' | 'refBy'>[] = [];
  const linkable: RefEntry[] = [];

  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(join(root, file), 'utf8'));
    } catch (e) {
      error(file, `invalid JSON: ${(e as Error).message}`);
      continue;
    }
    const envelopeResult = validateWithText(envelope, data);
    if (!envelopeResult.valid) {
      for (const message of formatErrors(envelope.errors)) error(file, message);
      continue;
    }
    const entry = data as ValidEntry['entry'];
    for (const { path, text } of envelopeResult.texts) for (const message of checkMarkdown(path, text)) error(file, message);
    for (const message of checkBlocklist(entry, blocklist)) error(file, message);
    heads.push({ file, ruleset: entry.ruleset, type: entry.type, id: entry.id, name: entry.name, ...(entry.image ? { image: entry.image } : {}) });
    const linked: RefEntry = { file, ruleset: entry.ruleset, type: entry.type, id: entry.id };
    linkable.push(linked);
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
    const statsResult = validateWithText(validateStats, entry.stats, 'stats');
    if (!statsResult.valid) {
      for (const message of formatErrors(validateStats.errors, 'stats')) error(file, message);
      continue;
    }
    for (const { path, text } of statsResult.texts) for (const message of checkMarkdown(path, text)) error(file, message);
    for (const issue of ruleset.module.check(entry.type, entry.stats)) {
      issues.push({ level: issue.level, file, message: `${issue.path}: ${issue.message}` });
    }
    linked.stats = entry.stats;
    entries.push({
      file,
      entry,
      derived: ruleset.module.derive(entry.type, entry.stats),
      texts: [...envelopeResult.texts, ...statsResult.texts],
    });
  }

  issues.push(...checkUniqueness(heads));
  const { links, issues: refIssues } = linkEntries(linkable);
  for (const { file, message } of refIssues) error(file, message);
  const pick = (level: FileIssue['level']) =>
    issues.filter((i) => i.level === level).map(({ file, message }) => ({ file, message }));
  const withLinks = entries.map((e) => {
    const { refs, refBy } = links.get(entryKey(e.entry)) ?? { refs: [], refBy: [] };
    return { ...e, refs, refBy };
  });
  return { files, errors: pick('error'), warnings: pick('warning'), entries: withLinks };
}
