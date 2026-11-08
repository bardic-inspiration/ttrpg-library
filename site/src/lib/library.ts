// Reads every entry under content/ at build time, derives its values with its
// ruleset module, and links its refs (docs/content-model.md#references, docs/site.md#index-build step 3). Validation
// has already run in build:index, so entries here are known good.

import type { RulesetModule } from '../../../rulesets/module.ts';
import type { RefTarget } from './refs.ts';
import { entryKey, linkEntries, type Link, type Links, type RefEntry } from '../../../scripts/validate/refs.ts';
import { ruleKey, rulePaths, typedGroups, type RulesData } from '../../../lib/rules.ts';

export interface Entry {
  ruleset: string;
  type: string;
  id: string;
  name: string;
  summary: string;
  description?: string;
  stats: unknown;
  tags?: Record<string, unknown>;
  image?: string;
  meta: { createdAt: string; updatedAt?: string; source: { kind: string; issues?: number[]; gapFill?: string; srd?: true } };
}

export interface LoadedEntry {
  entry: Entry;
  derived: Record<string, unknown>;
  /** Refs out of this entry, keyed `<type>/<id>`. */
  refs: Link[];
  /** Refs into this entry from other entries. */
  refBy: Link[];
}

const files = import.meta.glob<Entry>('../../../content/**/*.json', { eager: true, import: 'default' });
const modules = import.meta.glob<{ ruleset: RulesetModule }>('../../../rulesets/*/index.ts', { eager: true });

export function rulesetModule(id: string): RulesetModule {
  const module = modules[`../../../rulesets/${id}/index.ts`];
  if (!module) throw new Error(`No ruleset module for "${id}"`);
  return module.ruleset;
}

/** Every entry under content/, derived and linked, sorted by name. */
export const loadEntries = (rules: RulesData[] = []): LoadedEntry[] => loadLibrary(Object.values(files), rules);

/** The primitives and groups of rules data as link ends (docs/rulesets.md#rules-data). */
export const ruleLinkables = (rules: RulesData[]): RefEntry[] =>
  rules.flatMap((data) => [
    ...data.primitives.map((p) => ({ file: ruleKey(p), ruleset: data.ruleset, type: p.type, id: p.id, stats: p.stats })),
    ...typedGroups(data).map((g) => ({
      file: ruleKey(g),
      ruleset: data.ruleset,
      type: g.type,
      id: g.id,
      ...(g.text ? { stats: g.text, statsPath: `${g.id}.text` } : { stats: {} }),
    })),
  ]);

/** Links among entries, primitives, and groups, by key. */
export function linkAll(entries: Entry[], rules: RulesData[] = []): Map<string, Links> {
  return linkEntries([...entries.map((entry) => ({ ...entry, file: entryPath(entry) })), ...ruleLinkables(rules)]).links;
}

/**
 * Derives and links a set of entries, sorted by name. Refs to rules data
 * resolve when it's given. `moduleFor` defaults to the repo's rulesets.
 */
export function loadLibrary(
  entries: Entry[],
  rules: RulesData[] = [],
  moduleFor: (id: string) => RulesetModule = rulesetModule,
): LoadedEntry[] {
  const links = linkAll(entries, rules);
  return entries
    .map((entry) => ({
      entry,
      derived: moduleFor(entry.ruleset).derive(entry.type, entry.stats),
      ...(links.get(entryKey(entry)) ?? { refs: [], refBy: [] }),
    }))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

export const entryPath = (entry: Entry): string => `${entry.ruleset}/${entry.type}/${entry.id}/`;

/** `<type>/<id>` → name of an entry, primitive, or group, for rendering refs as names. */
export const entryNames = (all: LoadedEntry[], rules: RulesData[] = []): Map<string, string> =>
  new Map([
    ...rules.flatMap((data) => [
      ...data.primitives.map((p) => [ruleKey(p), p.name] as [string, string]),
      ...typedGroups(data).map((g) => [ruleKey(g), g.name] as [string, string]),
    ]),
    ...all.map(({ entry }) => [entryKey(entry), entry.name] as [string, string]),
  ]);

/** Primitive and group key → path of its anchor on its rules page; an entry's path needs no lookup. */
export const refPaths = (rules: RulesData[]): Map<string, string> => new Map(rules.flatMap((data) => [...rulePaths(data)]));

/** `<type>/<id>` → link target, for the detail page's refs and back-refs: an entry's page, or a primitive's or group's anchor. */
export function refTargets(all: LoadedEntry[], rules: RulesData[] = []): Map<string, RefTarget> {
  const paths = refPaths(rules);
  const names = entryNames([], rules);
  return new Map([
    ...[...paths].map(([key, path]) => [key, { type: key.slice(0, key.indexOf('/')), name: names.get(key) ?? key, path }] as [string, RefTarget]),
    ...all.map(({ entry }) => [entryKey(entry), { type: entry.type, name: entry.name, path: entryPath(entry) }] as [string, RefTarget]),
  ]);
}
