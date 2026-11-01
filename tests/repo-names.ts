import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// SPEC.md §8.4 and §8.7: the generate skill and docs/routines.md may name only
// repo paths, npm scripts, and config/defaults.json keys that exist.
export const ROOT = join(import.meta.dirname, '..');
export const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

export const ENTRY_PATH = 'content/<ruleset>/<type>/<id>.json';
/** Built by `npm run build:index` and git-ignored (§4), so absent from a clean checkout. */
export const GENERATED = new Set(['site/public/library.json']);

/** Top-level directories and files a code span must start with to count as a repo path. */
const PATH = /^(?:(?:\.claude|\.github|config|content|docs|lib|rulesets|schemas|scripts|site|tests)\/|[A-Z]+\.md$)/;

type Registry = Record<string, { types: Record<string, unknown> }>;

export interface Repo {
  registry: Registry;
  defaults: Record<string, unknown>;
  scripts: Record<string, string>;
  exists: (path: string) => boolean;
}

export const codeSpans = (markdown: string): string[] => [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);

/** Every concrete path a span stands for, with `<ruleset>` and `<type>` expanded over the registry. */
function expand(span: string, registry: Registry): string[] {
  return Object.entries(registry).flatMap(([ruleset, { types }]) => {
    const withRuleset = span.replaceAll('<ruleset>', ruleset);
    if (!withRuleset.includes('<type>')) return [withRuleset];
    return Object.keys(types).map((type) => withRuleset.replaceAll('<type>', type));
  });
}

const lookup = (object: unknown, path: string): boolean =>
  path.split('.').reduce<{ found: boolean; value: unknown }>(
    ({ found, value }, key) =>
      found && typeof value === 'object' && value !== null && key in value
        ? { found: true, value: (value as Record<string, unknown>)[key] }
        : { found: false, value: undefined },
    { found: true, value: object },
  ).found;

/** One message per path, npm script, or defaults key the text names that doesn't resolve. */
export function unresolved(markdown: string, repo: Repo): string[] {
  const problems: string[] = [];
  for (const span of new Set(codeSpans(markdown))) {
    const defaultsKey = /^defaults\.([A-Za-z.]+)$/.exec(span);
    if (defaultsKey) {
      if (!lookup(repo.defaults, defaultsKey[1]!)) problems.push(`${span}: not a key of config/defaults.json`);
      continue;
    }
    const script = /^npm run ([\w:-]+)$/.exec(span);
    if (script) {
      if (!(script[1]! in repo.scripts)) problems.push(`${span}: not an npm script`);
      continue;
    }
    if (!PATH.test(span)) continue;
    if (span === ENTRY_PATH) continue; // where new entries are written (§5.1)
    if (GENERATED.has(span)) continue;
    for (const path of expand(span, repo.registry)) {
      if (/<[^>]+>/.test(path)) problems.push(`${span}: unknown placeholder`);
      else if (!repo.exists(path.replace(/\/$/, ''))) problems.push(`${span}: ${path} does not exist`);
    }
  }
  return problems;
}

/** This repository, as `unresolved` sees it. */
export const repo: Repo = {
  registry: JSON.parse(read('config/types.json')) as Registry,
  defaults: JSON.parse(read('config/defaults.json')) as Record<string, unknown>,
  scripts: (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts,
  exists: (path) => existsSync(join(ROOT, path)),
};
