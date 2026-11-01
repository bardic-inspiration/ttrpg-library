import { describe, expect, it } from 'vitest';
import { read, repo, unresolved } from './repo-names.ts';

// SPEC.md §8.4 (The generate skill); issue #64. The skill may name only repo
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
