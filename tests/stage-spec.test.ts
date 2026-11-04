import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAreas, SECTIONS, type AreaFile } from './stage-spec.ts';

// spec/v2/README.md "Area files" and "Checks"; issue #197.
const ROOT = join(import.meta.dirname, '..');
const SPEC = 'spec/v2';

const area = (name: string, text: string): AreaFile => ({ name, text });
const doc = (frontMatter: string, body: string) => `---\n${frontMatter}\n---\n\n${body}`;
const minimal = '# Linking\n\n## Goal\n\nWhy.\n\n## Design\n\nWhat.\n';
const known = new Set(['creature/lich', 'spell/fireball']);
const exists = (key: string) => known.has(key);

describe('checkAreas', () => {
  it('accepts a minimal area with an issue and no dependencies', () => {
    expect(checkAreas([area('linking', doc('issue: 111', minimal))], exists)).toEqual([]);
  });

  it('accepts every template section in order', () => {
    const body = ['# Types', ...SECTIONS.map((s) => `## ${s}\n\nText.`)].join('\n\n');
    expect(checkAreas([area('types', doc('issue: 112', body))], exists)).toEqual([]);
  });

  it('requires front matter with a positive integer issue', () => {
    expect(checkAreas([area('linking', minimal)], exists)).toEqual(['linking.md: no front matter']);
    expect(checkAreas([area('linking', doc('depends: []', minimal))], exists)).toEqual([
      'linking.md: issue must be a positive integer',
    ]);
    expect(checkAreas([area('linking', doc('issue: "111"', minimal))], exists)).toEqual([
      'linking.md: issue must be a positive integer',
    ]);
  });

  it('rejects unknown front matter keys', () => {
    expect(checkAreas([area('linking', doc('issue: 111\nstatus: approved', minimal))], exists)).toEqual([
      'linking.md: unknown front matter key "status"',
    ]);
  });

  it('requires a title and the Goal and Design sections', () => {
    expect(checkAreas([area('linking', doc('issue: 111', '## Goal\n\n## Design\n'))], exists)).toEqual([
      'linking.md: must start with a "# " title',
    ]);
    expect(checkAreas([area('linking', doc('issue: 111', '# Linking\n\n## Goal\n'))], exists)).toEqual([
      'linking.md: missing "## Design"',
    ]);
  });

  it('rejects unknown, repeated, or out-of-order sections', () => {
    const unknown = '# L\n\n## Goal\n\n## Rationale\n\n## Design\n';
    expect(checkAreas([area('linking', doc('issue: 111', unknown))], exists)).toEqual([
      'linking.md: unknown section "## Rationale"',
    ]);
    const outOfOrder = '# L\n\n## Design\n\n## Goal\n';
    expect(checkAreas([area('linking', doc('issue: 111', outOfOrder))], exists)).toEqual([
      'linking.md: "## Goal" is out of order',
    ]);
    const repeated = '# L\n\n## Goal\n\n## Design\n\n## Design\n';
    expect(checkAreas([area('linking', doc('issue: 111', repeated))], exists)).toEqual([
      'linking.md: "## Design" appears more than once',
    ]);
  });

  it('requires dependencies to name other existing areas', () => {
    const files = [
      area('linking', doc('issue: 111', minimal)),
      area('types', doc('issue: 112\ndepends: [linking, style, types]', minimal)),
    ];
    expect(checkAreas(files, exists)).toEqual([
      'types.md: depends on "style", which has no area file',
      'types.md: depends on itself',
    ]);
  });

  it('rejects a dependency cycle', () => {
    const files = [
      area('linking', doc('issue: 111\ndepends: [ui]', minimal)),
      area('types', doc('issue: 112\ndepends: [linking]', minimal)),
      area('ui', doc('issue: 113\ndepends: [types]', minimal)),
    ];
    expect(checkAreas(files, exists)).toEqual(['dependency cycle: linking → ui → types → linking']);
  });

  it('requires cited cases to resolve to library entries', () => {
    const body = `${minimal}\n## Cases\n\n- \`creature/lich\` and \`spell/fireball\`\n- \`spell/no-such-spell\`\n- \`npm test\` is not an entry key\n`;
    expect(checkAreas([area('linking', doc('issue: 111', body))], exists)).toEqual([
      'linking.md: case "spell/no-such-spell" is not a library entry',
    ]);
  });

  it('checks entry keys only inside Cases', () => {
    const body = minimal.replace('What.', 'What, unlike `spell/no-such-spell`.');
    expect(checkAreas([area('linking', doc('issue: 111', body))], exists)).toEqual([]);
  });
});

describe(SPEC, () => {
  const files = readdirSync(join(ROOT, SPEC))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => area(name.slice(0, -3), readFileSync(join(ROOT, SPEC, name), 'utf8')));

  const entryExists = (key: string) => {
    const [type, id] = key.split('/');
    return readdirSync(join(ROOT, 'content')).some((ruleset) =>
      existsSync(join(ROOT, 'content', ruleset, type!, `${id}.json`)),
    );
  };

  it('has a README', () => {
    expect(existsSync(join(ROOT, SPEC, 'README.md'))).toBe(true);
  });

  it('README lists the template sections in order', () => {
    const readme = readFileSync(join(ROOT, SPEC, 'README.md'), 'utf8');
    const listed = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]!).filter((h) => (SECTIONS as readonly string[]).includes(h));
    expect(listed).toEqual([...SECTIONS]);
  });

  it('every area file passes the checks', () => {
    expect(checkAreas(files, entryExists)).toEqual([]);
  });
});
