// SRD coverage (docs/content-model.md#srd-manifest-and-coverage): which records of a ruleset's SRD manifest have
// no SRD entry in the library yet, and which SRD entries the manifest lacks; and the same for the
// rules data's primitives and equipment groups (docs/rulesets.md#rules-data), and the page types'
// components by parent (docs/content-model.md#components).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { typedGroups } from '../../lib/rules.ts';
import { validateLibrary, type ValidationError } from '../validate/index.ts';
import { loadRuleset, PROJECT_ROOT } from '../validate/schema.ts';

export const TIERS = ['complex', 'simple'] as const;
export type Tier = (typeof TIERS)[number];

/** One SRD entry the library should hold: its type, exact SRD name, and tier. */
export interface ManifestRecord {
  type: string;
  name: string;
  tier: Tier;
}

/** One SRD primitive or group the rules data should hold: its rules type and exact SRD name. Rules records have no tier. */
export interface RulesRecord {
  type: string;
  name: string;
  /** A group (`rules/<type>-groups.json`) rather than a primitive. */
  group?: true;
}

/**
 * One SRD component the library should hold: its component type, exact SRD name, and its parent's
 * key. Components have no tier. A name the parent prints twice (Improved Brutal Strike) is listed
 * twice.
 */
export interface ComponentRecord {
  type: string;
  name: string;
  /** The parent entry, as `<type>/<id>`. */
  parent: string;
}

/** A component in the library, as coverage reads it: its parent is the entry that lists it. */
export type ComponentHead = ComponentRecord;

export interface ComponentGroupReport {
  type: string;
  total: number;
  missing: ComponentRecord[];
}

export interface ComponentCoverage {
  /** One group per component type, in the order types first appear in the manifest. */
  groups: ComponentGroupReport[];
  /** SRD components with no manifest record of the same type, name, and parent, or more of them than records. */
  unlisted: ComponentHead[];
}

/** `rulesets/<ruleset>/srd-manifest.json`. */
export interface Manifest {
  ruleset: string;
  source: string;
  entries: ManifestRecord[];
  /** The ruleset's primitives and groups. */
  rules?: RulesRecord[];
  /** The page types' components. */
  components?: ComponentRecord[];
}

/** A primitive or group in the rules data, as coverage reads it. */
export type RuleHead = RulesRecord;

export interface RulesGroupReport {
  type: string;
  total: number;
  missing: RulesRecord[];
}

export interface RulesCoverage {
  /** One group per rules type, in the order types first appear in the manifest. */
  groups: RulesGroupReport[];
  /** Primitives and groups with no manifest record of the same type, name, and kind. */
  unlisted: RuleHead[];
}

/** The parts of a library entry coverage reads. */
export interface EntryHead {
  type: string;
  name: string;
  srd: boolean;
}

/** Limits a report to one type, one tier, or both. */
export interface Filter {
  type?: string;
  tier?: Tier;
}

export interface Group {
  type: string;
  tier: Tier;
  total: number;
  missing: ManifestRecord[];
}

export interface Coverage {
  /** One group per type and tier, in the order types first appear in the manifest, complex before simple. */
  groups: Group[];
  /** SRD entries with no manifest record of the same type and name. */
  unlisted: EntryHead[];
}

const key = (type: string, name: string) => `${type}\u0000${name}`;
const ruleKey = (r: RulesRecord) => `${key(r.type, r.name)}\u0000${r.group === true ? 'group' : 'primitive'}`;

/**
 * Problems with a manifest, one message per problem; empty when it is valid.
 * `types` are the ruleset's types (config/types.json), and `rulesTypes` its rules types (ruleset.json).
 */
export function checkManifest(
  manifest: Manifest,
  ruleset: string,
  types: string[],
  rulesTypes: string[] = [],
  componentTypes: { type: string; parents: string[] }[] = [],
): string[] {
  const problems: string[] = [];
  if (manifest.ruleset !== ruleset) problems.push(`ruleset: "${manifest.ruleset}" is not "${ruleset}"`);
  if (!Array.isArray(manifest.entries)) return [...problems, 'entries: must be an array'];
  const seen = new Set<string>();
  manifest.entries.forEach((record, i) => {
    const where = `entries[${i}]`;
    if (!types.includes(record.type)) problems.push(`${where}: type "${record.type}" is not a type of ${ruleset}`);
    if (typeof record.name !== 'string' || record.name.trim() !== record.name || record.name === '') {
      problems.push(`${where}: name must be a non-empty string without surrounding spaces`);
    }
    if (!(TIERS as readonly string[]).includes(record.tier)) problems.push(`${where}: tier must be complex or simple`);
    const k = key(record.type, record.name);
    if (seen.has(k)) problems.push(`${where}: duplicate ${record.type} "${record.name}"`);
    seen.add(k);
  });
  if (manifest.rules !== undefined && !Array.isArray(manifest.rules)) return [...problems, 'rules: must be an array'];
  const seenRules = new Set<string>();
  (manifest.rules ?? []).forEach((record, i) => {
    const where = `rules[${i}]`;
    if (!rulesTypes.includes(record.type)) problems.push(`${where}: type "${record.type}" is not a rules type of ${ruleset}`);
    if (typeof record.name !== 'string' || record.name.trim() !== record.name || record.name === '') {
      problems.push(`${where}: name must be a non-empty string without surrounding spaces`);
    }
    if ('tier' in record) problems.push(`${where}: a rules record has no tier`);
    if (record.group !== undefined && record.group !== true) problems.push(`${where}: group must be true when present`);
    // One key space per rules type (docs/rulesets.md#rules-data): a name is unique across primitives and groups.
    const k = key(record.type, record.name);
    if (seenRules.has(k)) problems.push(`${where}: duplicate ${record.type} "${record.name}"`);
    seenRules.add(k);
  });
  if (manifest.components !== undefined && !Array.isArray(manifest.components)) return [...problems, 'components: must be an array'];
  (manifest.components ?? []).forEach((record, i) => {
    const where = `components[${i}]`;
    const component = componentTypes.find((c) => c.type === record.type);
    if (!component) problems.push(`${where}: type "${record.type}" is not a component type of ${ruleset}`);
    if (typeof record.name !== 'string' || record.name.trim() !== record.name || record.name === '') {
      problems.push(`${where}: name must be a non-empty string without surrounding spaces`);
    }
    if ('tier' in record) problems.push(`${where}: a component record has no tier`);
    const parentType = typeof record.parent === 'string' ? /^([a-z0-9-]+)\/[a-z0-9]+(-[a-z0-9]+)*$/.exec(record.parent)?.[1] : undefined;
    if (parentType === undefined) problems.push(`${where}: parent must be a key, <type>/<id>`);
    else if (component && !component.parents.includes(parentType)) problems.push(`${where}: a ${record.type} has no ${parentType} parent`);
  });
  return problems;
}

const componentKey = (c: ComponentRecord) => `${key(c.type, c.name)}\u0000${c.parent}`;

/**
 * Matches the library's SRD components to the manifest's component records by type, exact name,
 * and parent, counting repeats, grouped by component type.
 */
export function componentCoverage(manifest: Manifest, components: ComponentHead[], filter: Pick<Filter, 'type'> = {}): ComponentCoverage {
  const records = (manifest.components ?? []).filter((r) => !filter.type || r.type === filter.type);
  const heads = components.filter((c) => !filter.type || c.type === filter.type);
  // Each head uses up one record of its key; what's left over on either side is missing or unlisted.
  const left = new Map<string, number>();
  for (const r of records) left.set(componentKey(r), (left.get(componentKey(r)) ?? 0) + 1);
  const unlisted = heads.filter((c) => {
    const n = left.get(componentKey(c)) ?? 0;
    if (n === 0) return true;
    left.set(componentKey(c), n - 1);
    return false;
  });
  const groups = [...new Set(records.map((r) => r.type))].map((type) => {
    const own = records.filter((r) => r.type === type);
    const missing = own.filter((r) => {
      const n = left.get(componentKey(r)) ?? 0;
      if (n === 0) return false;
      left.set(componentKey(r), n - 1);
      return true;
    });
    return { type, total: own.length, missing };
  });
  return { groups, unlisted };
}

/**
 * Matches the rules data's primitives and groups to the manifest's rules records by type, exact
 * name, and kind, grouped by rules type.
 */
export function rulesCoverage(manifest: Manifest, rules: RuleHead[], filter: Filter = {}): RulesCoverage {
  const records = (manifest.rules ?? []).filter((r) => !filter.type || r.type === filter.type);
  const present = new Set(rules.map(ruleKey));
  const listed = new Set(records.map(ruleKey));
  const groups = [...new Set(records.map((r) => r.type))].map((type) => {
    const own = records.filter((r) => r.type === type);
    return { type, total: own.length, missing: own.filter((r) => !present.has(ruleKey(r))) };
  });
  const unlisted = rules.filter((r) => (!filter.type || r.type === filter.type) && !listed.has(ruleKey(r)));
  return { groups, unlisted };
}

/**
 * Matches SRD entries (`meta.source.srd: true`) to manifest records by type and
 * exact name, and groups the unmatched records by type and tier.
 */
export function coverage(manifest: Manifest, entries: EntryHead[], filter: Filter = {}): Coverage {
  const srd = entries.filter((entry) => entry.srd && (!filter.type || entry.type === filter.type));
  const present = new Set(srd.map((entry) => key(entry.type, entry.name)));
  const listed = new Set(manifest.entries.map((record) => key(record.type, record.name)));

  const types = [...new Set(manifest.entries.map((record) => record.type))];
  const groups: Group[] = [];
  for (const type of types) {
    if (filter.type && type !== filter.type) continue;
    for (const tier of TIERS) {
      if (filter.tier && tier !== filter.tier) continue;
      const records = manifest.entries.filter((record) => record.type === type && record.tier === tier);
      if (records.length === 0) continue;
      const missing = records.filter((record) => !present.has(key(record.type, record.name)));
      groups.push({ type, tier, total: records.length, missing });
    }
  }
  const unlisted = srd.filter((entry) => !listed.has(key(entry.type, entry.name)));
  return { groups, unlisted };
}

/** The report `npm run srd-coverage` prints: entries, then the components and the rules data when given. */
export function formatReport(result: Coverage, rules?: RulesCoverage, components?: ComponentCoverage): string {
  const lines: string[] = [];
  const missing = result.groups.reduce((n, g) => n + g.missing.length, 0);
  const total = result.groups.reduce((n, g) => n + g.total, 0);
  lines.push(`${missing} of ${total} SRD records missing.`, '');
  for (const group of result.groups) {
    lines.push(`${group.type} ${group.tier}: ${group.missing.length} missing of ${group.total}`);
    for (const record of group.missing) lines.push(`  ${record.name}`);
  }
  lines.push('');
  if (result.unlisted.length === 0) {
    lines.push('Every SRD entry is in the manifest.');
  } else {
    lines.push(`${result.unlisted.length} SRD entries not in the manifest:`);
    for (const entry of result.unlisted) lines.push(`  ${entry.type} ${entry.name}`);
  }
  if (components) {
    const missingComponents = components.groups.reduce((n, g) => n + g.missing.length, 0);
    const totalComponents = components.groups.reduce((n, g) => n + g.total, 0);
    lines.push('', `${missingComponents} of ${totalComponents} SRD component records missing.`, '');
    for (const group of components.groups) {
      lines.push(`${group.type}: ${group.missing.length} missing of ${group.total}`);
      for (const record of group.missing) lines.push(`  ${record.parent} › ${record.name}`);
    }
    lines.push('');
    if (components.unlisted.length === 0) lines.push('Every SRD component is in the manifest.');
    else {
      lines.push(`${components.unlisted.length} SRD components not in the manifest:`);
      for (const c of components.unlisted) lines.push(`  ${c.type} ${c.parent} › ${c.name}`);
    }
  }
  if (rules) {
    const missingRules = rules.groups.reduce((n, g) => n + g.missing.length, 0);
    const totalRules = rules.groups.reduce((n, g) => n + g.total, 0);
    const label = (r: RulesRecord) => (r.group ? `${r.name} (group)` : r.name);
    lines.push('', `${missingRules} of ${totalRules} SRD rules records missing.`, '');
    for (const group of rules.groups) {
      lines.push(`${group.type} rules: ${group.missing.length} missing of ${group.total}`);
      for (const record of group.missing) lines.push(`  ${label(record)}`);
    }
    lines.push('');
    if (rules.unlisted.length === 0) lines.push('Every primitive and group is in the manifest.');
    else {
      lines.push(`${rules.unlisted.length} primitives or groups not in the manifest:`);
      for (const r of rules.unlisted) lines.push(`  ${r.type} ${label(r)}`);
    }
  }
  return lines.join('\n');
}

/** Reads `rulesets/<ruleset>/srd-manifest.json`. */
export async function loadManifest(root: string, ruleset: string): Promise<Manifest> {
  return JSON.parse(await readFile(join(root, 'rulesets', ruleset, 'srd-manifest.json'), 'utf8')) as Manifest;
}

/** What coverage reads from the library, all through the validator, as the import does (docs/generation.md#imports). */
export interface LibraryHeads {
  /** The ruleset's entries, without components. */
  entries: EntryHead[];
  /** The ruleset's SRD components, each with its parent: the entry whose stats list it by ref. */
  components: ComponentHead[];
  /** The ruleset's primitives and groups. */
  rules: RuleHead[];
  /** The validator's errors. An entry that fails isn't counted, so coverage is read only without them. */
  errors: ValidationError[];
}

const isSrd = (meta: unknown) => (meta as { source?: { srd?: unknown } } | undefined)?.source?.srd === true;

/** Validates the library under `content` and reads what coverage matches from the result. */
export async function loadLibraryHeads(ruleset: string, content = join(PROJECT_ROOT, 'content')): Promise<LibraryHeads> {
  const { errors, entries, components, rules } = await validateLibrary(content);
  const data = rules.find((r) => r.ruleset === ruleset);
  return {
    entries: entries.filter(({ entry }) => entry.ruleset === ruleset).map(({ entry }) => ({ type: entry.type, name: entry.name, srd: isSrd(entry.meta) })),
    components: components
      .filter(({ entry }) => entry.ruleset === ruleset && isSrd(entry.meta))
      .map(({ entry, parent }) => ({ type: entry.type, name: entry.name, parent })),
    rules: data
      ? [...data.primitives.map(({ type, name }) => ({ type, name })), ...typedGroups(data).map(({ type, name }) => ({ type, name, group: true as const }))]
      : [],
    errors,
  };
}

/** The ruleset's rules types and component types (with their parent types), from its module's definition. */
export async function loadRulesetTypes(ruleset: string): Promise<{ rulesTypes: string[]; componentTypes: { type: string; parents: string[] }[] }> {
  const definition = (await loadRuleset(ruleset))?.module.definition;
  return { rulesTypes: (definition?.rules ?? []).map((r) => r.type), componentTypes: definition?.components ?? [] };
}
