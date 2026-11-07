import { describe, expect, it } from 'vitest';
import { checkLane, isDocsPath, isTestTextPath, laneOf, needsMigrationLabel, waitForLabel } from '../scripts/lane/index.ts';

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
    expect(result).toEqual({ lane: 'dev', contentChanged: false, docsOnly: true, textOnly: false, milestone: false, errors: [] });
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
    expect(result).toEqual({ lane: 'content', contentChanged: true, docsOnly: false, textOnly: false, milestone: false, errors: [] });
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
    expect(result).toEqual({ lane: 'dev', contentChanged: false, docsOnly: true, textOnly: false, milestone: false, errors: [] });
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
    expect(result).toEqual({ lane: 'dev', contentChanged: true, docsOnly: false, textOnly: false, milestone: false, errors: [] });
  });
});

describe('isDocsPath (docs/workflow.md#docs-only-prs)', () => {
  it.each([
    'SPEC.md',
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'ATTRIBUTION.md',
    'docs/decisions.md',
    'docs/SRD_CC_v5.2.pdf',
    '.github/ISSUE_TEMPLATE/bug-report.md',
    '.github/PULL_REQUEST_TEMPLATE/dev.md',
  ])('treats %s as docs', (path) => {
    expect(isDocsPath(path)).toBe(true);
  });

  it.each([
    // Read by tests, so a change to them is checked as code.
    'docs/routines.md',
    '.claude/skills/generate/SKILL.md',
    '.github/PULL_REQUEST_TEMPLATE/content.md',
    '.github/ISSUE_TEMPLATE/content-request.yml',
    'rulesets/dnd-5e-2024/guidelines/creature.md',
    'content/dnd-5e-2024/creature/a.md',
    'site/README.md',
    'package.json',
    'SPEC.txt',
  ])('treats %s as code', (path) => {
    expect(isDocsPath(path)).toBe(false);
  });
});

describe('checkLane docsOnly', () => {
  it('is true when every path is docs', () => {
    const result = checkLane({ branch: 'dev/spec', paths: ['SPEC.md', 'AGENTS.md'], labels: [] });
    expect(result.docsOnly).toBe(true);
  });

  it('is false when any path is code', () => {
    const result = checkLane({ branch: 'dev/spec', paths: ['SPEC.md', 'scripts/lane/index.ts'], labels: [] });
    expect(result.docsOnly).toBe(false);
  });

  it('is false for an empty diff, so it gets the full checks', () => {
    const result = checkLane({ branch: 'dev/empty', paths: [], labels: [] });
    expect(result.docsOnly).toBe(false);
  });

  it('still fails a content-lane PR that touches only docs', () => {
    const result = checkLane({ branch: 'gen/12-20261102', paths: ['README.md'], labels: [] });
    expect(result.docsOnly).toBe(true);
    expect(result.errors).toHaveLength(1);
  });
});

describe('isTestTextPath (docs/workflow.md#text-only-prs)', () => {
  it.each([
    'spec/v2/ui.md',
    'spec/v2/style-package/README.md',
    '.claude/skills/generate/SKILL.md',
    'rulesets/dnd-5e-2024/guidelines/creature.md',
    'docs/routines.md',
    '.github/PULL_REQUEST_TEMPLATE/content.md',
  ])('treats %s as Markdown only tests read', (path) => {
    expect(isTestTextPath(path)).toBe(true);
  });

  it.each([
    // Code, config, or files the build reads.
    'spec/v2/style-package/site/tokens.css',
    '.claude/settings.json',
    '.claude/hooks/session-start.sh',
    '.claude/skills/generate/scripts/pick.ts',
    'rulesets/dnd-5e-2024/schemas/creature.schema.json',
    'rulesets/dnd-5e-2024/guidelines/creature.json',
    '.github/ISSUE_TEMPLATE/content-request.yml',
    'site/README.md',
    'docs/decisions.md',
  ])('treats %s as not text-only', (path) => {
    expect(isTestTextPath(path)).toBe(false);
  });
});

describe('checkLane textOnly', () => {
  it('is true when every path is docs or Markdown only tests read, and at least one is the latter', () => {
    const result = checkLane({ branch: 'dev/spec', paths: ['spec/v2/ui.md', 'docs/decisions.md'], labels: [] });
    expect(result).toMatchObject({ docsOnly: false, textOnly: true });
  });

  it('is false for a docs-only PR, which skips more', () => {
    const result = checkLane({ branch: 'dev/docs', paths: ['docs/decisions.md'], labels: [] });
    expect(result).toMatchObject({ docsOnly: true, textOnly: false });
  });

  it('is false when any path is code', () => {
    const result = checkLane({ branch: 'dev/spec', paths: ['spec/v2/ui.md', 'site/src/pages/index.astro'], labels: [] });
    expect(result.textOnly).toBe(false);
  });
});

describe('checkLane milestone (docs/workflow.md#milestone-prs)', () => {
  it('is true with the milestone label', () => {
    const result = checkLane({ branch: 'dev/x', paths: ['site/src/pages/index.astro'], labels: ['dev', 'milestone'] });
    expect(result.milestone).toBe(true);
  });

  it('gives a milestone PR every check, whatever its paths', () => {
    const docs = checkLane({ branch: 'dev/x', paths: ['docs/decisions.md'], labels: ['milestone'] });
    expect(docs).toMatchObject({ docsOnly: false, textOnly: false, milestone: true });
    const text = checkLane({ branch: 'dev/x', paths: ['spec/v2/ui.md'], labels: ['milestone'] });
    expect(text).toMatchObject({ docsOnly: false, textOnly: false, milestone: true });
  });

  it('is false without the label', () => {
    expect(checkLane({ branch: 'dev/x', paths: ['site/a.astro'], labels: ['dev'] }).milestone).toBe(false);
  });
});

describe('.github/labeler.yml', () => {
  it('adds migration to a non-content branch that changes content (docs/workflow.md#lane-rules)', async () => {
    const { readFile } = await import('node:fs/promises');
    const yml = await readFile(new URL('../.github/labeler.yml', import.meta.url), 'utf8');
    const rule = yml.slice(yml.indexOf('\nmigration:'));
    expect(rule).toContain("head-branch: ['^(?!gen/|revise/|manual/)']");
    expect(rule).toContain("any-glob-to-any-file: ['content/**', 'assets/images/**']");
    // The branch regex matches dev branches and rejects content ones.
    const branch = /'(\^\(\?!gen\/\|revise\/\|manual\/\))'/.exec(rule)![1]!;
    expect(new RegExp(branch).test('dev/spell-header-forms')).toBe(true);
    expect(new RegExp(branch).test('gen/srd-133-spell-20261104')).toBe(false);
  });
});

describe('waiting for the labeler (docs/workflow.md#labeling)', () => {
  const noSleep = async () => {};

  it('needs the migration label only for a dev PR that changes content without it', () => {
    const content = ['content/dnd-5e-2024/spell/augury.json'];
    expect(needsMigrationLabel({ branch: 'dev/x', paths: content, labels: [] })).toBe(true);
    expect(needsMigrationLabel({ branch: 'dev/x', paths: content, labels: ['migration'] })).toBe(false);
    expect(needsMigrationLabel({ branch: 'dev/x', paths: ['site/a.ts'], labels: [] })).toBe(false);
    expect(needsMigrationLabel({ branch: 'gen/1-20261104', paths: content, labels: [] })).toBe(false);
  });

  it('returns the live labels once the labeler has added the label', async () => {
    const seen = [[], ['dev'], ['dev', 'migration']];
    let calls = 0;
    const labels = await waitForLabel('migration', async () => seen[calls++]!, { attempts: 5, sleep: noSleep });
    expect(labels).toEqual(['dev', 'migration']);
    expect(calls).toBe(3);
  });

  it('gives up after its attempts and returns the last labels seen', async () => {
    let calls = 0;
    const labels = await waitForLabel('migration', async () => (calls++, ['dev']), { attempts: 4, sleep: noSleep });
    expect(labels).toEqual(['dev']);
    expect(calls).toBe(4);
  });

  it('waits between reads', async () => {
    const waits: number[] = [];
    await waitForLabel('migration', async () => [], { attempts: 3, delayMs: 5000, sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([5000, 5000, 5000]);
  });
});
