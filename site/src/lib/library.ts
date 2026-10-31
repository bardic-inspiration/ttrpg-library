// Reads every entry under content/ at build time and derives its values with
// its ruleset module (SPEC.md §9.1 step 3). Validation has already run in
// build:index, so entries here are known good.

import type { RulesetModule } from '../../../rulesets/module.ts';

export interface Entry {
  ruleset: string;
  type: string;
  id: string;
  name: string;
  summary: string;
  description?: string;
  stats: unknown;
  tags?: Record<string, unknown>;
  meta: { createdAt: string; updatedAt?: string; source: { kind: string; issues?: number[] } };
}

export interface LoadedEntry {
  entry: Entry;
  derived: Record<string, unknown>;
}

const files = import.meta.glob<Entry>('../../../content/**/*.json', { eager: true, import: 'default' });
const modules = import.meta.glob<{ ruleset: RulesetModule }>('../../../rulesets/*/index.ts', { eager: true });

export function rulesetModule(id: string): RulesetModule {
  const module = modules[`../../../rulesets/${id}/index.ts`];
  if (!module) throw new Error(`No ruleset module for "${id}"`);
  return module.ruleset;
}

export function loadEntries(): LoadedEntry[] {
  return Object.values(files)
    .map((entry) => ({ entry, derived: rulesetModule(entry.ruleset).derive(entry.type, entry.stats) }))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

export const entryPath = (entry: Entry): string => `${entry.ruleset}/${entry.type}/${entry.id}/`;
