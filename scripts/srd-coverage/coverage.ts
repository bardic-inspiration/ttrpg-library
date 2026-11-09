// SRD coverage (docs/content-model.md#srd-manifest-and-coverage): which records of a ruleset's SRD manifest have
// no SRD entry in the library yet, and which SRD entries the manifest lacks; and the same for the
// rules data's primitives and equipment groups (docs/rulesets.md#rules-data).

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { listEntryFiles } from '../validate/walk.ts';

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

/** `rulesets/<ruleset>/srd-manifest.json`. */
export interface Manifest {
  ruleset: string;
  source: string;
  entries: ManifestRecord[];
  /** The ruleset's primitives and groups. */
  rules?: RulesRecord[];
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
export function checkManifest(manifest: Manifest, ruleset: string, types: string[], rulesTypes: string[] = []): string[] {
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
  return problems;
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

/** The report `npm run srd-coverage` prints: entries, then the rules data when given. */
export function formatReport(result: Coverage, rules?: RulesCoverage): string {
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

/** Reads the type, name, and SRD marker of every entry under `content/<ruleset>/`. */
export async function loadEntryHeads(root: string, ruleset: string): Promise<EntryHead[]> {
  const dir = join(root, 'content', ruleset);
  const files = await listEntryFiles(dir);
  return Promise.all(
    files.map(async (file) => {
      const entry = JSON.parse(await readFile(join(dir, file), 'utf8')) as {
        type: string;
        name: string;
        meta?: { source?: { srd?: boolean } };
      };
      return { type: entry.type, name: entry.name, srd: entry.meta?.source?.srd === true };
    }),
  );
}

/** The ruleset's rules types, from its ruleset.json. */
export async function loadRulesTypes(root: string, ruleset: string): Promise<string[]> {
  const definition = JSON.parse(await readFile(join(root, 'rulesets', ruleset, 'ruleset.json'), 'utf8')) as { rules?: { type: string }[] };
  return (definition.rules ?? []).map((r) => r.type);
}

/** The type and name of every primitive and group under `rulesets/<ruleset>/rules/`. */
export async function loadRuleHeads(root: string, ruleset: string): Promise<RuleHead[]> {
  const dir = join(root, 'rulesets', ruleset, 'rules');
  const heads: RuleHead[] = [];
  for (const type of await loadRulesTypes(root, ruleset)) {
    const files = (await readdir(join(dir, type)).catch(() => [] as string[])).filter((f) => f.endsWith('.json')).sort();
    for (const file of files) heads.push({ type, name: (JSON.parse(await readFile(join(dir, type, file), 'utf8')) as { name: string }).name });
    const groups = await readFile(join(dir, `${type}-groups.json`), 'utf8').catch(() => undefined);
    if (groups) for (const g of JSON.parse(groups) as { name: string }[]) heads.push({ type, name: g.name, group: true });
  }
  return heads;
}
