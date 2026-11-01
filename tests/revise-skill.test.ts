import { describe, expect, it } from 'vitest';
import { read, repo, unresolved } from './repo-names.ts';

// SPEC.md §8.5 (The revise skill); issue #71. The skill may name only repo
// paths, npm scripts, and config/defaults.json keys that exist.
const SKILL = '.claude/skills/revise/SKILL.md';

describe(SKILL, () => {
  const skill = read(SKILL);

  it('has a name and description in its frontmatter', () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
    expect(front).toMatch(/^name: revise$/m);
    expect(front).toMatch(/^description: \S/m);
  });

  it('names only repo paths, npm scripts, and defaults keys that exist', () => {
    expect(unresolved(skill, repo)).toEqual([]);
  });

  it('names every config/defaults.json key it depends on', () => {
    expect(skill).toContain('`defaults.validateRetries`');
  });

  it('uses the §8.5 handled marker, commands, and naming', () => {
    expect(skill).toContain('`<!-- routine:handled -->`');
    expect(skill).toContain('`drop <id>`');
    expect(skill).toContain('`regenerate <id>`');
    expect(skill).toContain('`Revise <ids>: <short reason>`');
    expect(skill).toContain('`revise/<issue>-<YYYYMMDD>`');
    expect(skill).toContain('`meta.updatedAt`');
  });
});
