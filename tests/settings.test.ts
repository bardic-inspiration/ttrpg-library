// The Claude Code settings (CLAUDE.md "Configuration and skills"): every npm script is pre-approved,
// with the arguments the docs give it, so an unattended routine never stops at a permission prompt,
// and the force-push spellings CLAUDE.md lists are blocked.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';

/**
 * Whether a `Bash(...)` rule matches one command, as Claude Code reads the rule: a trailing `:*`
 * is a prefix that matches the command itself or the command and its arguments; any other `*`
 * matches any text, spaces included, and a lone trailing ` *` also matches the bare command;
 * otherwise the rule is the exact command. Runs of spaces are read as one.
 */
function bashRuleMatches(rule: string, command: string): boolean {
  const content = /^Bash\((.*)\)$/s.exec(rule)?.[1];
  if (content === undefined) return false;
  const cmd = command.trim().replace(/[ \t]+/g, ' ');
  const prefix = /^(.+):\*$/.exec(content)?.[1]?.replace(/[ \t]+/g, ' ');
  if (prefix !== undefined) return cmd === prefix || cmd.startsWith(`${prefix} `);
  if (!content.includes('*')) return cmd === content;
  const pattern = content.trim().replace(/[ \t]+/g, ' ');
  let source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  if (source.endsWith(' .*') && pattern.split('*').length === 2) source = `${source.slice(0, -3)}( .*)?`;
  return new RegExp(`^${source}$`, 's').test(cmd);
}

let allow: string[];
let deny: string[];
let scripts: string[];

beforeAll(async () => {
  const settings = JSON.parse(await readFile(join(PROJECT_ROOT, '.claude/settings.json'), 'utf8'));
  ({ allow, deny } = settings.permissions);
  scripts = Object.keys(JSON.parse(await readFile(join(PROJECT_ROOT, 'package.json'), 'utf8')).scripts);
});

const allowed = (command: string) => allow.some((rule) => bashRuleMatches(rule, command)) && !deny.some((rule) => bashRuleMatches(rule, command));

describe('the rule matcher', () => {
  it('reads prefix, wildcard, and exact rules', () => {
    expect(bashRuleMatches('Bash(git log:*)', 'git log')).toBe(true);
    expect(bashRuleMatches('Bash(git log:*)', 'git log --oneline -3')).toBe(true);
    expect(bashRuleMatches('Bash(git log:*)', 'git logs')).toBe(false);
    expect(bashRuleMatches('Bash(npm run build)', 'npm run build')).toBe(true);
    expect(bashRuleMatches('Bash(npm run build)', 'npm run build:index')).toBe(false);
    expect(bashRuleMatches('Bash(ls *)', 'ls')).toBe(true);
    expect(bashRuleMatches('Bash(ls *)', 'lsof')).toBe(false);
    expect(bashRuleMatches('Bash(git * main)', 'git push origin main')).toBe(true);
  });
});

describe('.claude/settings.json allow rules', () => {
  it('pre-approve every npm script', () => {
    for (const script of scripts) {
      const command = script === 'test' ? 'npm test' : `npm run ${script}`;
      expect(allowed(command), command).toBe(true);
    }
  });

  it.each([
    'npm test -- tests/import.test.ts',
    'npm run test:originals -- tests/originals/elementals.test.ts',
    'npm run srd-coverage -- --type spell --tier 1',
    'npm run import -- --issue 7 --format open5e --file hollow-grove.json --work W --author A --url https://example.com --license CC-BY-4.0',
    'npm run snapshots before',
  ])('pre-approve %s, with its arguments', (command) => {
    expect(allowed(command)).toBe(true);
  });
});

describe('.claude/settings.json deny rules', () => {
  const denied = (command: string) => deny.some((rule) => bashRuleMatches(rule, command));

  it.each([
    'git push --force',
    'git push --force origin dev/x',
    'git push --force-with-lease origin dev/x',
    'git push -f origin dev/x',
    'git push origin dev/x --force',
    'git push origin dev/x --force-with-lease',
    'git push origin dev/x --force-with-lease=dev/x:abc123',
    'git push -u origin dev/x --force-if-includes --force-with-lease',
    'git push origin dev/x -f',
    'git push origin dev/x -fu',
    'git push origin +dev/x',
    'git push origin +HEAD:dev/x',
  ])('block %s', (command) => {
    expect(denied(command)).toBe(true);
  });

  it.each([
    'git push',
    'git push -u origin dev/x',
    'git push origin dev/x --follow-tags',
    'git push origin dev/fix-force',
    'git push origin HEAD:refs/heads/dev/x-f',
  ])(
    'leave %s alone',
    (command) => {
      expect(denied(command)).toBe(false);
    },
  );
});
