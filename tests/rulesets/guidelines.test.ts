import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { termMatcher } from '../../lib/text.ts';
import { tables } from '../../rulesets/dnd-5e-2024/index.ts';
import { findTokens } from '../../rulesets/dnd-5e-2024/tokens.ts';

// SPEC.md §8.6 (Guidelines), §6.4, §11; issue #63.
const ROOT = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const SECTIONS = ['Tone and voice', 'Naming', 'Balance targets', 'Prose style', 'Dependencies and SRD references'];

// Token syntax is per ruleset; add a ruleset here when it gains guidelines.
const TOKENS: Record<string, (text: string) => ReturnType<typeof findTokens>> = {
  'dnd-5e-2024': (text) => findTokens(text, tables),
};

const registry = JSON.parse(read('config/types.json')) as Record<
  string,
  { types: Record<string, { guideline?: string }> }
>;
const types = Object.entries(registry).flatMap(([ruleset, { types }]) =>
  Object.entries(types).map(([type, entry]) => ({ ruleset, type, guideline: entry.guideline })),
);
const blocklisted = termMatcher(JSON.parse(read('config/blocklist.json')) as string[]);

describe.each(types)('guideline for $ruleset/$type', ({ ruleset, type, guideline }) => {
  it('is registered at rulesets/<ruleset>/guidelines/<type>.md and exists', () => {
    expect(guideline).toBe(`rulesets/${ruleset}/guidelines/${type}.md`);
    expect(existsSync(join(ROOT, guideline!))).toBe(true);
  });

  it('has the five §8.6 sections, in order', () => {
    const headings = read(guideline!)
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3).trim());
    expect(headings).toEqual(SECTIONS);
  });

  it('uses only defined tokens', () => {
    const tokens = TOKENS[ruleset];
    expect(tokens, `no token parser for ${ruleset}`).toBeDefined();
    const errors = tokens!(read(guideline!)).filter((m) => m.error).map((m) => `${m.raw}: ${m.error}`);
    expect(errors).toEqual([]);
  });

  it('passes the blocklist', () => {
    expect(blocklisted(read(guideline!))).toEqual([]);
  });
});
