import { describe, expect, it } from 'vitest';
import { anchors, checkLinks, isScanned, slug } from '../scripts/links/index.ts';

// docs/workflow.md#link-check: every citation of a doc resolves to an existing
// file and heading, every relative Markdown link resolves, and no section-number
// citation is left.

const repo = (files: Record<string, string>) => new Map(Object.entries(files));
const DOC = '# Content model\n\n## Behavior\n\n### Situational fields\n\nText.\n\n### IDs and names\n';

describe('slug', () => {
  it('follows GitHub heading anchors', () => {
    expect(slug('Situational fields')).toBe('situational-fields');
    expect(slug('The `generate` skill')).toBe('the-generate-skill');
    expect(slug('Docs-only PRs')).toBe('docs-only-prs');
    expect(slug('SRD and custom entries')).toBe('srd-and-custom-entries');
    expect(slug('Refs (forward/back), labels!')).toBe('refs-forwardback-labels');
  });
});

describe('anchors', () => {
  it('lists every heading anchor, numbering repeats as GitHub does', () => {
    expect([...anchors('# A\n\n## Purpose\n\n### Purpose\n\n## Purpose\n')]).toEqual([
      'a',
      'purpose',
      'purpose-1',
      'purpose-2',
    ]);
  });

  it('ignores headings inside code fences', () => {
    expect([...anchors('# A\n\n```markdown\n## Goal\n```\n\n## Real\n')]).toEqual(['a', 'real']);
  });
});

describe('checkLinks', () => {
  it('accepts citations of existing files and headings, in code and in Markdown', () => {
    const files = repo({
      'docs/content-model.md': DOC,
      'scripts/a.ts': '// docs/content-model.md#situational-fields and docs/content-model.md\n',
      'AGENTS.md': 'See [IDs](docs/content-model.md#ids-and-names) and [the doc](docs/content-model.md).\n',
      'docs/other.md': 'Back to [the model](content-model.md#behavior) and [here](#top).\n\n# Top\n',
    });
    expect(checkLinks(files, (path) => files.has(path))).toEqual([]);
  });

  it('fails on a missing file', () => {
    const files = repo({ 'scripts/a.ts': '// docs/nope.md#situational-fields\n' });
    expect(checkLinks(files, (path) => files.has(path))).toEqual([
      'scripts/a.ts:1: docs/nope.md#situational-fields: no such file',
    ]);
  });

  it('fails on a missing heading', () => {
    const files = repo({ 'docs/content-model.md': DOC, 'scripts/a.ts': '\n// docs/content-model.md#gone\n' });
    expect(checkLinks(files, (path) => files.has(path))).toEqual([
      'scripts/a.ts:2: docs/content-model.md#gone: no such heading',
    ]);
  });

  it('checks relative Markdown links from the linking file, and same-file anchors', () => {
    const files = repo({
      'docs/content-model.md': DOC,
      'docs/other.md': '[a](content-model.md#missing) [b](../AGENTS.md) [c](#nowhere) [d](https://example.com)\n',
    });
    expect(checkLinks(files, (path) => files.has(path))).toEqual([
      'docs/other.md:1: content-model.md#missing: no such heading',
      'docs/other.md:1: ../AGENTS.md: no such file',
      'docs/other.md:1: #nowhere: no such heading',
    ]);
  });

  it('accepts links to existing files that are not Markdown, and to folders', () => {
    const files = repo({ 'AGENTS.md': '[s](.claude/settings.json) [v](spec/v2/)\n', '.claude/settings.json': '{}' });
    const exists = (path: string) => files.has(path) || path === 'spec/v2';
    expect(checkLinks(files, exists)).toEqual([]);
  });

  it('rejects section-number citations', () => {
    const files = repo({ 'scripts/a.ts': '// SPEC.md §5.8 and §12\n' });
    expect(checkLinks(files, (path) => files.has(path))).toEqual([
      'scripts/a.ts:1: "§5.8": cite a doc by file and heading, not section number',
      'scripts/a.ts:1: "§12": cite a doc by file and heading, not section number',
    ]);
  });
});

describe('isScanned', () => {
  it('scans text files and skips content, fixtures, lockfiles, and binaries', () => {
    expect(isScanned('scripts/lane/index.ts')).toBe(true);
    expect(isScanned('AGENTS.md')).toBe(true);
    expect(isScanned('.github/workflows/validate.yml')).toBe(true);
    expect(isScanned('content/dnd-5e-2024/spell/fireball.json')).toBe(false);
    expect(isScanned('tests/fixtures/library/valid/x.json')).toBe(false);
    expect(isScanned('package-lock.json')).toBe(false);
    expect(isScanned('docs/SRD_CC_v5.2.pdf')).toBe(false);
  });
});
