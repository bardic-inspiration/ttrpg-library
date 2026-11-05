import { describe, expect, it } from 'vitest';
import { read, repo, unresolved } from './repo-names.ts';

// docs/generation.md#srd-import (SRD import stages). The skill may name only repo paths, npm
// scripts, and config/defaults.json keys that exist.
const SKILL = '.claude/skills/srd-import/SKILL.md';

describe(SKILL, () => {
  const skill = read(SKILL);

  it('has a name and description in its frontmatter', () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
    expect(front).toMatch(/^name: srd-import$/m);
    expect(front).toMatch(/^description: \S/m);
  });

  it('names only repo paths, npm scripts, and defaults keys that exist', () => {
    expect(unresolved(skill, repo)).toEqual([]);
  });

  it('defers to the generate and revise skills and names the branch formats', () => {
    expect(skill).toContain('`.claude/skills/generate/SKILL.md`');
    expect(skill).toContain('`.claude/skills/revise/SKILL.md`');
    expect(skill).toContain('gen/srd-<stage>-<type>-<YYYYMMDD>');
    expect(skill).toContain('revise/<stage>-<YYYYMMDD>');
  });
});
