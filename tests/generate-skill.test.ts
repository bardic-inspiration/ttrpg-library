import { describe, expect, it } from 'vitest';
import { read, repo, unresolved } from './repo-names.ts';

interface TypeEntry {
  gapBuckets?: unknown;
}

// docs/generation.md#the-generate-skill (The generate skill); issue #64. The skill may name only repo
// paths, npm scripts, and config/defaults.json keys that exist.
const SKILL = '.claude/skills/generate/SKILL.md';

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
    for (const key of ['ruleset', 'count', 'gapFill.count', 'validateRetries']) {
      expect(skill).toContain(`\`defaults.${key}\``);
    }
  });

  // docs/generation.md#procedures: the skill routes each registered type to exactly one procedure.
  const routes = (): Map<string, string> => {
    const table = /^## Procedures\n([\s\S]*?)\n## /m.exec(skill)?.[1] ?? '';
    const map = new Map<string, string>();
    for (const row of table.matchAll(/^\| \[([^\]]+)\]\(#[^)]+\) \| (.+) \|$/gm)) {
      for (const type of row[2]!.matchAll(/`([a-z-]+)`/g)) {
        expect(map.has(type[1]!), `${type[1]} is routed twice`).toBe(false);
        map.set(type[1]!, row[1]!);
      }
    }
    return map;
  };

  it('routes every registered type to exactly one procedure, each with its own section', () => {
    const map = routes();
    const registered = Object.values(repo.registry).flatMap(({ types }) => Object.keys(types));
    expect([...map.keys()].sort()).toEqual([...new Set(registered)].sort());
    for (const procedure of new Set(map.values())) expect(skill).toMatch(new RegExp(`^### Procedure: ${procedure}$`, 'm'));
  });

  // The character, map, and encounter procedures take requests only, so no type they generate has gap buckets.
  const BY_REQUEST = ['Characters', 'Maps', 'Encounters'];

  it('routes to the by-request procedures only types without gap buckets', () => {
    const map = routes();
    expect(map.get('character')).toBe('Characters');
    expect(map.get('encounter')).toBe('Encounters');
    for (const { types } of Object.values(repo.registry)) {
      for (const [type, entry] of Object.entries(types as Record<string, TypeEntry>)) {
        if (BY_REQUEST.includes(map.get(type) ?? '')) expect(entry.gapBuckets, type).toBeUndefined();
      }
    }
  });

  // docs/generation.md#procedures "Encounters": the procedure has steps, writes counts, dice, and E, and
  // writes dependencies before the encounter.
  it('gives the encounter procedure its steps', () => {
    const section = /^### Procedure: Encounters\n([\s\S]*?)\n## /m.exec(skill)?.[1] ?? '';
    expect(section).not.toMatch(/no steps yet/);
    expect(section).toMatch(/^\d+\. \*\*/m);
    expect(section).toContain('never XP');
    expect(section).toContain('xpBudgetPerCharacter');
    expect(section).toContain('`environment`');
    expect(section).toContain('Dependencies before the encounter');
  });
});

describe('.github/PULL_REQUEST_TEMPLATE/content.md', () => {
  const template = read('.github/PULL_REQUEST_TEMPLATE/content.md');

  it('has every body section docs/generation.md#the-generate-skill asks for', () => {
    expect(template).toMatch(/^## Entries$/m);
    expect(template).toMatch(/^\| Name \| Type \| Summary field \| Summary \|$/m);
    expect(template).toMatch(/^## Warnings$/m);
    expect(template).toMatch(/^## Gap fill$/m);
    expect(template).toMatch(/^## Skipped on import$/m);
    expect(template).toMatch(/^Closes #/m);
  });

  it('has one Self-review item per item of docs/generation.md#self-review, and both skills cite it', () => {
    const doc = read('docs/generation.md');
    const section = /^### Self-review\n([\s\S]*?)\n### /m.exec(doc)?.[1] ?? '';
    const items = section.match(/^\d+\. \*\*/gm) ?? [];
    expect(items.length).toBeGreaterThan(0);
    const review = /^## Self-review\n([\s\S]*?)\n## /m.exec(template)?.[1] ?? '';
    expect(review.match(/^- \[ \] /gm)?.length).toBe(items.length);
    for (const skill of [SKILL, '.claude/skills/revise/SKILL.md']) expect(read(skill)).toContain('docs/generation.md#self-review');
  });

  it('runs import batches through the import script (docs/generation.md#imports)', () => {
    const skill = read(SKILL);
    expect(skill).toContain('`npm run import -- --issue <n>');
    expect(skill).toContain('`gen/import-<issue-numbers>-<YYYYMMDD>`');
    expect(skill).toContain('`ATTRIBUTION.md`');
    expect(skill).toContain('SRD proper noun');
  });
});
