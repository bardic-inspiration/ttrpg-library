// Ruleset rules data (docs/rulesets.md#rules-data): loads and checks a ruleset's primitives,
// groups, and rules pages. Primitives are validated like entries; groups and
// pages by their own schemas; and every primitive and group must appear on
// exactly one rules page.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TermMatcher } from '../../lib/text.ts';
import { GroupTree, placeRules, ruleKey, type Primitive, type RulesData, type RulesGroup, type RulesPage } from '../../lib/rules.ts';
import type { EntryHead, FileIssue } from './library.ts';
import { REF_TOKEN, collectRefs, textRefs, type RefEntry } from './refs.ts';
import { formatErrors, validateWithText, type LoadedRuleset, type RulesValidators } from './schema.ts';
import { checkBlocklist, checkMarkdown, checkPlaceholders, stringsIn } from './text.ts';

export interface LoadedRules {
  data: RulesData;
  issues: FileIssue[];
  /** Primitives and groups, for the uniqueness checks; they are SRD rules. */
  heads: EntryHead[];
  /** Primitives and groups, as link targets and sources. */
  linkable: RefEntry[];
  /** Every markdown-subset string in each primitive, by key. */
  texts: Map<string, { path: string; text: string }[]>;
}

async function readJsonFile(path: string): Promise<{ data?: unknown; error?: string }> {
  try {
    return { data: JSON.parse(await readFile(path, 'utf8')) };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return err.code === 'ENOENT' ? {} : { error: `invalid JSON: ${err.message}` };
  }
}

async function listJson(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

/** A {ref:…} token outside a text field, which would show as typed (docs/content-model.md#references). */
function tokensOutsideText(value: unknown, path: string, textPaths: Set<string>): string[] {
  return stringsIn(value, path)
    .filter((s) => !textPaths.has(s.path) && new RegExp(REF_TOKEN.source).test(s.text))
    .map((s) => `${s.path}: a {ref:…} token works only in text fields (rules text and description)`);
}

/**
 * Loads `rulesets/<id>/rules/` and checks it. `rel` is the folder as reports
 * name it, such as `rulesets/dnd-5e-2024`.
 */
export async function loadRules(
  dir: string,
  rel: string,
  ruleset: LoadedRuleset,
  validators: RulesValidators,
  blocklist: TermMatcher,
): Promise<LoadedRules> {
  const id = ruleset.module.definition.id;
  const types = ruleset.module.definition.rules ?? [];
  const issues: FileIssue[] = [];
  const error = (file: string, message: string) => issues.push({ level: 'error', file, message });
  const heads: EntryHead[] = [];
  const linkable: RefEntry[] = [];
  const texts = new Map<string, { path: string; text: string }[]>();
  const primitives: Primitive[] = [];
  const groups = new Map<string, GroupTree>();
  const rulesDir = join(dir, 'rules');

  for (const { type } of types) {
    const validateStats = ruleset.stats.get(type);
    if (!validateStats) error(`${rel}/ruleset.json`, `rules: "${type}" has no schemas/${type}.schema.json`);

    // Groups first, so a primitive's group can be checked.
    const groupsFile = `${rel}/rules/${type}-groups.json`;
    const read = await readJsonFile(join(rulesDir, `${type}-groups.json`));
    if (read.error) error(groupsFile, read.error);
    else if (read.data !== undefined) {
      const tree = checkGroups(read.data, type, groupsFile, validators, blocklist, issues);
      if (tree) {
        groups.set(type, tree);
        for (const g of tree.groups) {
          heads.push({ file: groupsFile, ruleset: id, type, id: g.id, name: g.name, srd: true });
          linkable.push({ file: groupsFile, ruleset: id, type, id: g.id, ...(g.text ? { stats: g.text, statsPath: `${g.id}.text` } : { stats: {} }) });
        }
      }
    }

    for (const name of await listJson(join(rulesDir, type))) {
      const file = `${rel}/rules/${type}/${name}`;
      const { data, error: bad } = await readJsonFile(join(rulesDir, type, name));
      if (bad) {
        error(file, bad);
        continue;
      }
      if (!validators.primitive(data)) {
        for (const message of formatErrors(validators.primitive.errors)) error(file, message);
        continue;
      }
      const primitive = data as Primitive;
      if (primitive.type !== type || `${primitive.id}.json` !== name) {
        error(file, `file path must be ${rel}/rules/${primitive.type}/${primitive.id}.json to match type and id`);
        continue;
      }
      heads.push({ file, ruleset: id, type, id: primitive.id, name: primitive.name, srd: true });
      const entryLike = { name: primitive.name, summary: '', stats: primitive.stats };
      for (const message of checkBlocklist(entryLike, blocklist)) error(file, message);
      for (const message of checkPlaceholders(entryLike)) error(file, message);
      const link: RefEntry = { file, ruleset: id, type, id: primitive.id };
      linkable.push(link);
      if (!validateStats) continue;
      const result = validateWithText(validateStats, primitive.stats, 'stats');
      if (!result.valid) {
        for (const message of formatErrors(validateStats.errors, 'stats')) error(file, message);
        continue;
      }
      for (const { path, text } of result.texts) for (const message of checkMarkdown(path, text)) error(file, message);
      const textPaths = new Set(result.texts.map((t) => t.path));
      for (const message of [
        ...tokensOutsideText(primitive.name, 'name', textPaths),
        ...tokensOutsideText(primitive.stats, 'stats', textPaths),
      ]) {
        error(file, message);
      }
      // A primitive is an SRD rule, literal like an SRD entry: the ruleset's review warnings are skipped.
      // Checks read the groups, which load before a type's primitives.
      const sofar: RulesData = { ruleset: id, types, primitives: [...primitives], groups, pages: [] };
      for (const issue of ruleset.module.check(type, primitive.stats, sofar)) {
        if (issue.level === 'error') error(file, `${issue.path}: ${issue.message}`);
      }
      link.stats = primitive.stats;
      texts.set(ruleKey(primitive), result.texts);
      primitives.push(primitive);
    }
  }

  for (const primitive of primitives) {
    const message = groupProblem(groups.get(primitive.type), primitive);
    if (message) error(`${rel}/rules/${primitive.type}/${primitive.id}.json`, message);
  }

  const pagesFile = `${rel}/rules/pages.json`;
  let pages: RulesPage[] = [];
  const readPages = await readJsonFile(join(rulesDir, 'pages.json'));
  if (readPages.error) error(pagesFile, readPages.error);
  else if (readPages.data !== undefined) {
    const result = validateWithText(validators.pages, readPages.data);
    if (!result.valid) for (const message of formatErrors(validators.pages.errors)) error(pagesFile, message);
    else {
      pages = readPages.data as RulesPage[];
      for (const { path, text } of result.texts) for (const message of checkMarkdown(path, text)) error(pagesFile, message);
      for (const message of checkBlocklist({ name: '', summary: '', stats: pages }, blocklist)) error(pagesFile, message.replace(/^stats/, ''));
      issues.push(...checkPages(pages, types, groups, pagesFile));
    }
  } else if (primitives.length > 0 || groups.size > 0) {
    error(pagesFile, 'missing: every primitive and group must appear on a rules page');
  }

  const data: RulesData = { ruleset: id, types, primitives, groups, pages };
  if (pages.length > 0) {
    const placement = placeRules(data);
    for (const { key, pages: on } of placement.twice) error(pagesFile, `${key} appears on more than one page: ${on.join(', ')}`);
    for (const key of placement.unplaced) error(pagesFile, `${key} appears on no page; add a block that shows it`);
  }
  issues.push(...checkRulesLinks(data, linkable, rel));
  return { data, issues, heads, linkable, texts };
}

/** Why a member's `stats.group` doesn't fit its type's groups, if it doesn't. */
export function groupProblem(tree: GroupTree | undefined, member: { stats: unknown }): string | undefined {
  if (!tree) return undefined;
  const group = (member.stats as { group?: unknown }).group;
  if (typeof group !== 'string') return `stats.group: missing; name one of the ${tree.type} groups`;
  if (!tree.byId.has(group)) return `stats.group: "${group}" is not a ${tree.type} group`;
  if (!tree.isLeaf(group)) return `stats.group: "${group}" has groups in it; name a group with none`;
  return undefined;
}

function checkGroups(
  data: unknown,
  type: string,
  file: string,
  validators: RulesValidators,
  blocklist: TermMatcher,
  issues: FileIssue[],
): GroupTree | undefined {
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const result = validateWithText(validators.groups, data);
  if (!result.valid) {
    for (const message of formatErrors(validators.groups.errors)) error(message);
    return undefined;
  }
  const groups = data as RulesGroup[];
  for (const { path, text } of result.texts) for (const message of checkMarkdown(path, text)) error(message);
  for (const message of checkBlocklist({ name: '', summary: '', stats: groups }, blocklist)) error(message.replace(/^stats/, ''));
  const ids = new Set(groups.map((g) => g.id));
  let ok = true;
  for (const group of groups) {
    if (group.parent !== undefined && !ids.has(group.parent)) {
      error(`${group.id}: parent "${group.parent}" is not a ${type} group`);
      ok = false;
    }
    for (const part of group.union ?? []) {
      if (!ids.has(part)) {
        error(`${group.id}: union names "${part}", which is not a ${type} group`);
        ok = false;
      }
    }
    // A cycle of parents would nest a group in itself.
    const seen = new Set<string>();
    for (let at: RulesGroup | undefined = group; at?.parent !== undefined; at = groups.find((g) => g.id === at!.parent)) {
      if (seen.has(at.id)) {
        error(`${group.id}: its parents loop back to it`);
        ok = false;
        break;
      }
      seen.add(at.id);
    }
  }
  for (const group of groups) {
    if (group.union && groups.some((g) => g.parent === group.id)) {
      error(`${group.id}: a union group can't have groups nested in it`);
      ok = false;
    }
  }
  return ok ? new GroupTree(type, groups) : undefined;
}

function checkPages(pages: RulesPage[], types: { type: string }[], groups: Map<string, GroupTree>, file: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const ids = new Set<string>();
  const known = new Set(types.map((t) => t.type));
  for (const page of pages) {
    if (ids.has(page.id)) error(`page "${page.id}" is listed twice`);
    ids.add(page.id);
    for (const block of page.blocks) {
      if (block.kind === 'primitives') {
        if (!known.has(block.type)) error(`${page.id}: "${block.type}" is not a rules type of this ruleset`);
        else if (groups.has(block.type)) error(`${page.id}: "${block.type}" has groups; show it with group blocks`);
        for (const other of block.crossList ?? []) {
          if (!known.has(other)) error(`${page.id}: cross-listed "${other}" is not a rules type of this ruleset`);
          else if (other === block.type) error(`${page.id}: "${other}" can't be cross-listed among its own primitives`);
        }
      }
      if (block.kind === 'group') {
        const slash = block.group.indexOf('/');
        const tree = groups.get(block.group.slice(0, slash));
        if (!tree?.byId.has(block.group.slice(slash + 1))) error(`${page.id}: "${block.group}" is not a group`);
      }
    }
  }
  return issues;
}

/**
 * Rules data links only to rules data (docs/rulesets.md#rules-data): a primitive's, group's, or
 * page's link to a content entry would make the ruleset depend on the library. A page's links are
 * checked here too, since pages aren't link ends: each must name a primitive or group.
 */
function checkRulesLinks(data: RulesData, linkable: RefEntry[], rel: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const rulesTypes = new Set(data.types.map((t) => t.type));
  const keys = new Set(linkable.map((l) => `${l.type}/${l.id}`));
  for (const l of linkable) {
    if (l.stats === undefined) continue;
    for (const { path, ref } of collectRefs(l.stats, l.statsPath ?? 'stats')) {
      const type = ref.slice(0, ref.indexOf('/'));
      if (!rulesTypes.has(type)) issues.push({ level: 'error', file: l.file, message: `${path}: rules data links only to rules data; "${ref}" is a ${type} entry` });
    }
  }
  const visit = (texts: { path: string; text: string }[]) => {
    for (const { path, text } of texts) {
      for (const { ref } of textRefs(text, path).refs) {
        const type = ref.slice(0, ref.indexOf('/'));
        const file = `${rel}/rules/pages.json`;
        if (!rulesTypes.has(type)) issues.push({ level: 'error', file, message: `${path}: rules data links only to rules data; "${ref}" is a ${type} entry` });
        else if (!keys.has(ref)) issues.push({ level: 'error', file, message: `${path}: ref "${ref}" does not resolve` });
      }
    }
  };
  const proseTexts = (blocks: { title?: string; text?: string; sections?: unknown[] }[], at: string): { path: string; text: string }[] =>
    blocks.flatMap((b, i) => [
      ...(b.text ? [{ path: `${at}[${i}].text`, text: b.text }] : []),
      ...proseTexts((b.sections ?? []) as { text?: string; sections?: unknown[] }[], `${at}[${i}].sections`),
    ]);
  data.pages.forEach((page) => visit(proseTexts(page.blocks as { text?: string; sections?: unknown[] }[], `${page.id}.blocks`)));
  return issues;
}
