import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// SPEC.md §8.4 (The generate skill); issue #64. The skill may name only repo
// paths, npm scripts, and config/defaults.json keys that exist.
const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const SKILL = '.claude/skills/generate/SKILL.md';
const ENTRY_PATH = 'content/<ruleset>/<type>/<id>.json';

/** Top-level directories and files a code span must start with to count as a repo path. */
const PATH = /^(?:(?:\.claude|\.github|config|content|docs|lib|rulesets|schemas|scripts|site|tests)\/|[A-Z]+\.md$)/;

type Registry = Record<string, { types: Record<string, unknown> }>;

interface Repo {
  registry: Registry;
  defaults: Record<string, unknown>;
  scripts: Record<string, string>;
  exists: (path: string) => boolean;
}

const codeSpans = (markdown: string): string[] => [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);

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
function unresolved(markdown: string, repo: Repo): string[] {
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
    for (const path of expand(span, repo.registry)) {
      if (/<[^>]+>/.test(path)) problems.push(`${span}: unknown placeholder`);
      else if (!repo.exists(path.replace(/\/$/, ''))) problems.push(`${span}: ${path} does not exist`);
    }
  }
  return problems;
}

const repo: Repo = {
  registry: JSON.parse(read('config/types.json')) as Registry,
  defaults: JSON.parse(read('config/defaults.json')) as Record<string, unknown>,
  scripts: (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts,
  exists: (path) => existsSync(join(ROOT, path)),
};

describe('unresolved', () => {
  const fake: Repo = {
    registry: { r: { types: { a: {}, b: {} } } },
    defaults: { count: 5, gapFill: { count: 3 } },
    scripts: { validate: 'x' },
    exists: (path) => ['config/x.json', 'rulesets/r/a.md', 'content'].includes(path),
  };

  it('accepts names that resolve', () => {
    const text = '`config/x.json` `content/` `defaults.gapFill.count` `npm run validate` `content/<ruleset>/<type>/<id>.json`';
    expect(unresolved(text, fake)).toEqual([]);
  });

  it('reports a missing path, defaults key, or npm script', () => {
    const text = '`config/y.json` `defaults.gapFill.size` `defaults.retries` `npm run lint`';
    expect(unresolved(text, fake)).toHaveLength(4);
  });

  it('expands <ruleset> and <type> over the registry', () => {
    expect(unresolved('`rulesets/<ruleset>/<type>.md`', fake)).toEqual([
      'rulesets/<ruleset>/<type>.md: rulesets/r/b.md does not exist',
    ]);
  });

  it('reports an unknown placeholder', () => {
    expect(unresolved('`content/<ruleset>/<slug>.json`', fake)).toEqual([
      'content/<ruleset>/<slug>.json: unknown placeholder',
    ]);
  });

  it('ignores spans that are not paths', () => {
    expect(unresolved('`gen/12-14-20261102` `stats.cr=2..4` `in-progress`', fake)).toEqual([]);
  });
});

describe(SKILL, () => {
  const skill = read(SKILL);

  it('has a name and description in its frontmatter', () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
    expect(front).toMatch(/^name: generate$/m);
    expect(front).toMatch(/^description: \S/m);
  });

  it('names only repo paths, npm scripts, and defaults keys that exist', () => {
    expect(unresolved(skill, repo)).toEqual([]);
  });

  it('names every config/defaults.json key it depends on', () => {
    for (const key of ['ruleset', 'count', 'maxBatch', 'tags', 'gapFill.count', 'validateRetries']) {
      expect(skill).toContain(`\`defaults.${key}\``);
    }
  });
});

describe('.github/PULL_REQUEST_TEMPLATE/content.md', () => {
  const template = read('.github/PULL_REQUEST_TEMPLATE/content.md');

  it('has every body section §8.4 asks for', () => {
    expect(template).toMatch(/^## Entries$/m);
    expect(template).toMatch(/^\| Name \| Type \| Summary field \| Summary \|$/m);
    expect(template).toMatch(/^## Warnings$/m);
    expect(template).toMatch(/^## Gap fill$/m);
    expect(template).toMatch(/^Closes #/m);
  });
});
