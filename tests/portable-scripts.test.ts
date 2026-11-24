// AGENTS.md "Rules": the build runs on Linux and Windows. npm runs scripts with sh on Linux and
// cmd.exe on Windows, so a package.json script uses only what both read the same way.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { libraryRuns } from '../scripts/with-library/index.ts';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';

/** Why a script won't run the same under sh and cmd.exe, or undefined if it will. */
function unportable(script: string): string | undefined {
  if (/(^|&&|\|\|)\s*[A-Za-z_][A-Za-z0-9_]*=/.test(script)) return 'sets a variable with shell syntax; use scripts/with-library or a Node script';
  if (script.includes('$') || script.includes('%')) return 'reads a variable with shell syntax';
  if (script.includes("'")) return 'quotes with single quotes, which cmd.exe reads as text';
  if (/;/.test(script)) return 'separates commands with ";", which cmd.exe doesn\'t';
  const unix = /(^|&&|\|\||\|)\s*(rm|cp|mv|cat|ls|grep|sed|touch|export|mkdir|which)\b/.exec(script);
  if (unix) return `runs "${unix[2]}", which cmd.exe lacks; use a Node script`;
  return undefined;
}

describe('unportable', () => {
  it.each([
    ['LIBRARY_ROOT=x npm run build', 'sets a variable'],
    ['npm run a && FOO=1 npm run b', 'sets a variable'],
    ['echo $HOME', 'reads a variable'],
    ["stylelint 'a/**'", 'single quotes'],
    ['npm run a; npm run b', '";"'],
    ['rm -rf site/dist', '"rm"'],
    ['npm run a && cp x y', '"cp"'],
  ])('flags %s', (script, reason) => {
    expect(unportable(script)).toContain(reason);
  });

  it.each(['tsx scripts/validate/cli.ts', 'npm run build:index && astro build --root site', 'stylelint "site/src/**/*.{css,astro}"', 'vitest run --config vitest.originals.config.ts'])(
    'passes %s',
    (script) => {
      expect(unportable(script)).toBeUndefined();
    },
  );
});

describe('package.json scripts', () => {
  it('run the same under sh and cmd.exe', async () => {
    const { scripts } = JSON.parse(await readFile(join(PROJECT_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const problems = Object.entries(scripts).flatMap(([name, script]) => {
      const reason = unportable(script);
      return reason ? [`${name}: ${reason}`] : [];
    });
    expect(problems).toEqual([]);
  });
});

describe('libraryRuns (docs/site.md#library-root)', () => {
  it('runs each script with npm’s own CLI under the current Node, with LIBRARY_ROOT set and no shell', () => {
    const runs = libraryRuns('tests/fixtures/originals', ['build:index', 'dev'], { npm_execpath: '/npm/bin/npm-cli.js', PATH: '/bin' }, '/node');
    expect(runs).toEqual(
      ['build:index', 'dev'].map((script) => ({
        command: '/node',
        args: ['/npm/bin/npm-cli.js', 'run', script],
        env: { npm_execpath: '/npm/bin/npm-cli.js', PATH: '/bin', LIBRARY_ROOT: 'tests/fixtures/originals' },
        shell: false,
      })),
    );
  });

  it('looks npm up through a shell when npm didn’t start it', () => {
    expect(libraryRuns('x', ['build'], {}, '/node')).toEqual([{ command: 'npm', args: ['run', 'build'], env: { LIBRARY_ROOT: 'x' }, shell: true }]);
  });
});
