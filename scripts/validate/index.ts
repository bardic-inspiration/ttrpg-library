import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { checkImage, checkPath, checkUniqueness, type EntryHead, type FileIssue } from './library.ts';
import { entryKey, linkEntries, REF_TOKEN, type Link, type RefEntry } from './refs.ts';
import {
  PROJECT_ROOT,
  RULESETS_ROOT,
  formatErrors,
  loadEnvelopeValidator,
  loadRegistry,
  loadRuleset,
  loadRulesValidators,
  validateWithText,
  type LoadedRuleset,
} from './schema.ts';
import type { RulesData } from '../../lib/rules.ts';
import { groupProblem, loadRules } from './rules.ts';
import { termMatcher } from '../../lib/text.ts';
import { checkBlocklist, checkMarkdown, checkPlaceholders, loadBlocklist, stringsIn } from './text.ts';
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
  /** Resolved refs out of this entry, in document order (docs/content-model.md#references). */
  refs: Link[];
  /** Resolved refs into this entry from other entries. */
  refBy: Link[];
  /** Every markdown-subset string in the entry (docs/content-model.md#text-fields), `description` first, then `stats` in document order. */
  texts: { path: string; text: string }[];
}

export interface ValidationResult {
  files: string[];
  errors: ValidationError[];
  warnings: ValidationError[];
  entries: ValidEntry[];
  /** The rules data of each ruleset that has rules types (docs/rulesets.md#rules-data). */
  rules: RulesData[];
}

export interface ValidateOptions {
  /** Where `image` paths resolve. Defaults to the content root's parent (the repo root). */
  assetsRoot?: string;
  /** Where ruleset folders live. Defaults to the repo's rulesets/; tests point it at a fixture ruleset. */
  rulesetsRoot?: string;
  /** The registry (config/types.json). Defaults to the repo's. */
  registry?: Record<string, { types: Record<string, unknown> }>;
}

/**
 * Validates every entry under `root` (docs/rulesets.md#consistency-checks): JSON, the envelope and
 * `stats` schemas, a known ruleset and type, then the ruleset-independent and
 * ruleset consistency checks. Errors fail; warnings are reported only.
 */
export async function validateLibrary(root: string, options: ValidateOptions = {}): Promise<ValidationResult> {
  const assetsRoot = options.assetsRoot ?? dirname(resolve(root));
  const files = await listEntryFiles(root);
  const issues: FileIssue[] = [];
  const error = (file: string, message: string) => issues.push({ level: 'error', file, message });
  const envelope = await loadEnvelopeValidator();
  const registry = options.registry ?? (await loadRegistry());
  const rulesetsRoot = options.rulesetsRoot ?? RULESETS_ROOT;
  const blocklist = termMatcher(await loadBlocklist(PROJECT_ROOT));
  const rulesets = new Map<string, LoadedRuleset | undefined>();
  const heads: EntryHead[] = [];
  const entries: Omit<ValidEntry, 'refs' | 'refBy'>[] = [];
  const linkable: RefEntry[] = [];

  // Every registered ruleset's rules data, whether or not any entry uses it (docs/rulesets.md#rules-data).
  const rules: RulesData[] = [];
  const rulesValidators = await loadRulesValidators();
  for (const id of Object.keys(registry)) {
    const ruleset = await loadRuleset(id, rulesetsRoot);
    rulesets.set(id, ruleset);
    if (!ruleset?.module.definition.rules?.length) continue;
    const loaded = await loadRules(join(rulesetsRoot, id), `rulesets/${id}`, ruleset, rulesValidators, blocklist);
    issues.push(...loaded.issues);
    heads.push(...loaded.heads);
    linkable.push(...loaded.linkable);
    rules.push(loaded.data);
  }

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
    for (const message of checkPlaceholders(entry)) error(file, message);
    const srd = (entry.meta as { source?: { srd?: true } }).source?.srd === true;
    heads.push({
      file,
      ruleset: entry.ruleset,
      type: entry.type,
      id: entry.id,
      name: entry.name,
      ...(entry.image ? { image: entry.image } : {}),
      ...(srd ? { srd } : {}),
    });
    const linked: RefEntry = { file, ruleset: entry.ruleset, type: entry.type, id: entry.id };
    if (typeof entry.description === 'string') linked.description = entry.description;
    linkable.push(linked);
    const pathError = checkPath({ ...entry, file });
    if (pathError) error(file, pathError);
    issues.push(...(await checkImage({ ...entry, file }, assetsRoot)));

    if (!rulesets.has(entry.ruleset)) {
      rulesets.set(entry.ruleset, registry[entry.ruleset] ? await loadRuleset(entry.ruleset, rulesetsRoot) : undefined);
    }
    const ruleset = rulesets.get(entry.ruleset);
    if (!ruleset) {
      error(file, `ruleset: unknown ruleset "${entry.ruleset}"; it needs a rulesets/${entry.ruleset}/ folder and a config/types.json entry`);
      continue;
    }
    const validateStats = ruleset.stats.get(entry.type);
    // An extension is an entry of a rules type that takes them (docs/rulesets.md#rules-data).
    const rulesType = ruleset.module.definition.rules?.find((r) => r.type === entry.type);
    if (rulesType && !rulesType.extensions) {
      error(file, `type: "${entry.type}" is a rules type that takes no extensions; its rules are kept in rulesets/${entry.ruleset}/rules/`);
      continue;
    }
    if ((!ruleset.module.definition.types.includes(entry.type) && !rulesType) || !validateStats || !registry[entry.ruleset]?.types[entry.type]) {
      error(file, `type: unknown type "${entry.type}" for ${entry.ruleset}; it must be listed in ruleset.json, have a schema, and have a config/types.json entry`);
      continue;
    }
    if (rulesType && srd) error(file, 'meta.source.srd: an extension is custom; the SRD rules are kept in the ruleset as primitives');
    const statsResult = validateWithText(validateStats, entry.stats, 'stats');
    if (!statsResult.valid) {
      for (const message of formatErrors(validateStats.errors, 'stats')) error(file, message);
      continue;
    }
    for (const { path, text } of statsResult.texts) for (const message of checkMarkdown(path, text)) error(file, message);
    // A {ref:…} token renders only in text fields (docs/content-model.md#references); anywhere else it would show as typed.
    const textPaths = new Set(statsResult.texts.map((t) => t.path));
    const plain = [
      { path: 'name', text: entry.name },
      { path: 'summary', text: entry.summary },
      ...stringsIn(entry.stats, 'stats').filter((s) => !textPaths.has(s.path)),
    ];
    for (const { path } of plain.filter(({ text }) => new RegExp(REF_TOKEN.source).test(text))) {
      error(file, `${path}: a {ref:…} token works only in text fields (rules text and description)`);
    }
    // An SRD entry is literal (docs/content-model.md#srd-and-custom-entries): its deviations and authored
    // numbers match the SRD, so the ruleset's review warnings are skipped.
    const rulesData = rules.find((r) => r.ruleset === entry.ruleset);
    for (const issue of ruleset.module.check(entry.type, entry.stats, rulesData)) {
      if (srd && issue.level === 'warning') continue;
      issues.push({ level: issue.level, file, message: `${issue.path}: ${issue.message}` });
    }
    if (rulesType) {
      const tree = rules.find((r) => r.ruleset === entry.ruleset)?.groups.get(entry.type);
      const problem = groupProblem(tree, entry);
      if (problem) error(file, problem);
    }
    linked.stats = entry.stats;
    entries.push({
      file,
      entry,
      derived: ruleset.module.derive(entry.type, entry.stats, rulesData),
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
  return { files, errors: pick('error'), warnings: pick('warning'), entries: withLinks, rules };
}
