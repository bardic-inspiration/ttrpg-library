import { describe, expect, it } from 'vitest';
import { GENERATED, read, type Repo, unresolved } from './repo-names.ts';

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

  it('exempts only git-ignored build outputs from the existence check', () => {
    const ignored = read('.gitignore').split('\n').map((line) => line.trim());
    for (const path of GENERATED) expect(ignored).toContain(path);
  });
});
