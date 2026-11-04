import { describe, expect, it } from 'vitest';
import { read, repo, unresolved } from './repo-names.ts';

// SPEC.md §8.7 (Schedule), §8.2 (Routine run order); issue #65.
const DOC = 'docs/routines.md';
const doc = read(DOC);

/** The body of the `##` section with this heading, up to the next `##`. */
const section = (heading: string): string => {
  const start = doc.indexOf(`\n## ${heading}\n`);
  if (start === -1) return '';
  const next = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, next === -1 ? undefined : next);
};

/** The contents of each fenced code block in a section. */
const fences = (markdown: string): string[] => [...markdown.matchAll(/^```\w*\n([\s\S]*?)^```$/gm)].map((m) => m[1]!);

describe(DOC, () => {
  it('names only repo paths, npm scripts, and defaults keys that exist', () => {
    expect(unresolved(doc, repo)).toEqual([]);
  });

  it('records the §8.7 schedule', () => {
    const schedule = section('Schedule');
    expect(schedule).toMatch(/weekly/i);
    expect(schedule).toMatch(/Monday morning/);
    expect(schedule).toContain('`defaults.count`');
    expect(schedule).not.toContain('maxBatch');
  });

  it('has one canonical prompt each for the scheduled and on-demand routines', () => {
    const scheduled = fences(section('Scheduled prompt'));
    const onDemand = fences(section('On-demand prompt'));
    expect(scheduled).toHaveLength(1);
    expect(onDemand.length).toBeGreaterThanOrEqual(1);
    // The on-demand routine is the same prompt (§8.7), with its inputs added.
    for (const prompt of onDemand) expect(prompt.startsWith(scheduled[0]!.trimEnd())).toBe(true);
  });

  it('lists the seven §8.2 steps in order', () => {
    const steps = [...section('Run order').matchAll(/^### (\d)\. (.+)$/gm)].map((m) => `${m[1]}. ${m[2]}`);
    expect(steps).toEqual([
      '1. Sync',
      '2. Revisions first',
      '3. Revise requests',
      '4. Content requests',
      '5. Gap-fill',
      '6. Ambiguity',
      '7. Stale claims',
    ]);
  });

  /** The body of the run-order step with this number, up to the next `###`. */
  const step = (n: number): string => {
    const order = section('Run order');
    const start = order.search(new RegExp(`^### ${n}\\. `, 'm'));
    if (start === -1) return '';
    const next = order.indexOf('\n### ', start + 1);
    return order.slice(start, next === -1 ? undefined : next);
  };

  it('wires content requests to the generate skill', () => {
    expect(step(4)).toContain('`.claude/skills/generate/SKILL.md`');
  });

  it('wires revisions and revise requests to the revise skill', () => {
    expect(step(2)).toContain('`.claude/skills/revise/SKILL.md`');
    expect(step(3)).toContain('`.claude/skills/revise/SKILL.md`');
  });

  it('wires gap-fill to the picker and the generate skill', () => {
    expect(step(5)).toContain('`npm run gap-fill`');
    expect(step(5)).toContain('`.claude/skills/generate/SKILL.md`');
    expect(step(5)).toContain('`defaults.gapFill.enabled`');
    expect(step(5)).toContain('`defaults.gapFill.count`');
  });

  it('marks no step unavailable', () => {
    expect(doc).not.toMatch(/not yet available/i);
  });

  it('pushes only to content-lane routine branches', () => {
    const branches = new Set([...doc.matchAll(/`((?:gen|revise|manual|dev|spike)\/)[^`]*`/g)].map((m) => m[1]));
    expect([...branches].sort()).toEqual(['gen/', 'revise/']);
  });
});
