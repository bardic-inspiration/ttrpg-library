// SRD coverage (docs/content-model.md#srd-manifest-and-coverage): which records of a ruleset's SRD manifest have
// no SRD entry in the library yet, and which SRD entries the manifest lacks.

import { readFile } from 'node:fs/promises';
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

/** `rulesets/<ruleset>/srd-manifest.json`. */
export interface Manifest {
  ruleset: string;
  source: string;
  entries: ManifestRecord[];
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

/**
 * Problems with a manifest, one message per problem; empty when it is valid.
 * `types` are the ruleset's types (config/types.json).
 */
export function checkManifest(manifest: Manifest, ruleset: string, types: string[]): string[] {
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
  return problems;
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

/** The report `npm run srd-coverage` prints. */
export function formatReport(result: Coverage): string {
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
