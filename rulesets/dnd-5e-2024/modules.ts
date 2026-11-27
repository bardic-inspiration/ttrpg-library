// Module checks a JSON schema can't express (docs/rulesets.md#modules, docs/rulesets.md#consistency-checks).
// The kit parts' shapes are the schema's (docs/content-model.md#arrangements); refs resolve by the ref
// check (docs/content-model.md#references), so an unresolved arrangement adds nothing here.

import type { Issue, LinkTarget } from '../module.ts';
import { checkTableParts } from './encounters.ts';
import type { ModuleStats } from './types.ts';

/** The modules a module's `arrangement` parts contain, with each part's index. */
const containedModules = (stats: ModuleStats): { index: number; ref: string }[] =>
  stats.parts.flatMap((part, index) => (part.part === 'arrangement' && part.arrangement.ref.startsWith('module/') ? [{ index, ref: part.arrangement.ref }] : []));

/** A table part holds one table, and the levels run from `min` up to `max`. */
export function checkModule(stats: ModuleStats): Issue[] {
  const issues = checkTableParts(stats.parts);
  const { min, max } = stats.levels;
  if (min > max) issues.push({ level: 'error', path: 'stats.levels', message: `levels ${min}–${max} run backward; \`min\` is at most \`max\`` });
  return issues;
}

/**
 * No module contains itself, directly or through others: each `arrangement` part that leads back to
 * this module is an error, naming the chain. A cycle below this module that doesn't pass through it is
 * reported by its own modules.
 */
export function checkModuleLinks(key: string, stats: ModuleStats, target: LinkTarget): Issue[] {
  const issues: Issue[] = [];
  for (const { index, ref } of containedModules(stats)) {
    const chain = pathBack(ref, key, target, new Set());
    if (chain) {
      issues.push({ level: 'error', path: `stats.parts[${index}].arrangement`, message: `a module can't contain itself: ${[key, ...chain].join(' › ')}` });
    }
  }
  return issues;
}

/** The chain of modules from `from` down to `to`, through contained modules, or undefined if none reaches it. */
function pathBack(from: string, to: string, target: LinkTarget, seen: Set<string>): string[] | undefined {
  if (from === to) return [from];
  if (seen.has(from)) return undefined;
  seen.add(from);
  const found = target(from);
  if (!found || found.type !== 'module') return undefined;
  for (const { ref } of containedModules(found.stats as ModuleStats)) {
    const rest = pathBack(ref, to, target, seen);
    if (rest) return [from, ...rest];
  }
  return undefined;
}
