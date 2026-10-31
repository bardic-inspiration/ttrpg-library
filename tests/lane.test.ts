import { describe, expect, it } from 'vitest';
import { checkLane, laneOf } from '../scripts/lane/index.ts';

describe('laneOf', () => {
  it.each([
    ['gen/12-20261102', 'content'],
    ['revise/14-20261102', 'content'],
    ['manual/frost-wyrm', 'content'],
    ['dev/lane-ci', 'dev'],
    ['dependabot/npm_and_yarn/astro-7.5.0', 'dev'],
  ])('puts %s in the %s lane', (branch, lane) => {
    expect(laneOf(branch)).toBe(lane);
  });

  it.each(['bardic-inspiration-patch-1', 'claude/magical-cori', 'main', 'gen', 'Dev/x'])(
    'puts the unprefixed %s in the dev lane',
    (branch) => {
      expect(laneOf(branch)).toBe('dev');
    },
  );

  it('gives a spike branch no lane', () => {
    expect(laneOf('spike/question')).toBeUndefined();
  });
});

describe('checkLane', () => {
  it('fails a spike branch', () => {
    const result = checkLane({ branch: 'spike/x', paths: ['README.md'], labels: [] });
    expect(result.lane).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('spike/');
  });

  it('passes an unprefixed branch that touches no content', () => {
    const result = checkLane({ branch: 'user-patch-1', paths: ['README.md'], labels: [] });
    expect(result).toEqual({ lane: 'dev', contentChanged: false, errors: [] });
  });

  it('fails an unprefixed branch that touches content without the migration label', () => {
    const result = checkLane({
      branch: 'user-patch-1',
      paths: ['content/dnd-5e-2024/creature/a.json'],
      labels: [],
    });
    expect(result.lane).toBe('dev');
    expect(result.errors[0]).toContain('migration');
  });

  it('passes a content PR that touches only content paths', () => {
    const result = checkLane({
      branch: 'gen/12-20261102',
      paths: ['content/dnd-5e-2024/creature/cinder-hound.json', 'assets/images/x.png'],
      labels: [],
    });
    expect(result).toEqual({ lane: 'content', contentChanged: true, errors: [] });
  });

  it('fails a content PR that touches site/', () => {
    const result = checkLane({
      branch: 'gen/12-20261102',
      paths: ['content/dnd-5e-2024/creature/cinder-hound.json', 'site/src/pages/index.astro'],
      labels: [],
    });
    expect(result.lane).toBe('content');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('site/src/pages/index.astro');
  });

  it('does not treat look-alike paths as content', () => {
    const result = checkLane({
      branch: 'revise/14-20261102',
      paths: ['contents/x.json', 'assets/other/x.png'],
      labels: [],
    });
    expect(result.contentChanged).toBe(false);
    expect(result.errors[0]).toContain('contents/x.json');
    expect(result.errors[0]).toContain('assets/other/x.png');
  });

  it('passes a dev PR that touches no content', () => {
    const result = checkLane({ branch: 'dev/lane-ci', paths: ['SPEC.md'], labels: [] });
    expect(result).toEqual({ lane: 'dev', contentChanged: false, errors: [] });
  });

  it('fails a dev PR that touches content without the migration label', () => {
    const result = checkLane({
      branch: 'dev/rename-field',
      paths: ['rulesets/dnd-5e-2024/schemas/creature.schema.json', 'content/dnd-5e-2024/creature/a.json'],
      labels: ['dev', 'ruleset'],
    });
    expect(result.contentChanged).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('migration');
    expect(result.errors[0]).toContain('content/dnd-5e-2024/creature/a.json');
  });

  it('passes a dev PR that touches content with the migration label', () => {
    const result = checkLane({
      branch: 'dev/rename-field',
      paths: ['content/dnd-5e-2024/creature/a.json'],
      labels: ['dev', 'migration'],
    });
    expect(result).toEqual({ lane: 'dev', contentChanged: true, errors: [] });
  });
});
