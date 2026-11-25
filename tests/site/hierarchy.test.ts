// The text hierarchy and its standards (docs/styling.md#hierarchy-and-standards): every heading
// level has a size role, the spacing rhythm is a set of tokens, and links outside running text
// underline only on hover and focus.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTokens } from '../../site/src/lib/design-tokens.ts';

const STYLES = new URL('../../site/src/styles/', import.meta.url).pathname;
const base = readFileSync(`${STYLES}base.css`, 'utf8');
const semantic = readTokens(readFileSync(`${STYLES}tokens/semantic.css`, 'utf8'));
const declared = new Set(semantic.map((d) => d.name));

describe('text hierarchy (docs/styling.md#hierarchy-and-standards)', () => {
  it.each([1, 2, 3, 4, 5, 6])('h%i takes its size from --text-h%i', (level) => {
    expect(declared.has(`--text-h${level}`)).toBe(true);
    expect(base).toMatch(new RegExp(`\\bh${level}\\s*\\{\\s*font-size:\\s*var\\(--text-h${level}\\);`));
  });

  it.each(['--flow-line', '--flow-text', '--flow-block', '--flow-section'])('declares the rhythm token %s', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('underlines links in headings, navigation, and the site header only on hover and focus', () => {
    const rule = base.match(/:is\(([^)]*)\) a \{([\s\S]*?)\n {2}\}/);
    expect(rule).not.toBeNull();
    const [, selectors = '', body = ''] = rule!;
    expect(selectors.split(',').map((s) => s.trim())).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', '.site-header']);
    expect(body).toMatch(/text-decoration-line: none;/);
    expect(body).toMatch(/&:hover,\s*&:focus-visible \{\s*text-decoration-line: underline;/);
  });
});
