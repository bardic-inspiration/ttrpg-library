// Contrast checks (SPEC.md §9.7) on the design tokens (§9.6). Changing a
// color in semantic.css, content.css, or primitives.css to a value that fails
// a pair fails this suite.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTokens, resolveToken, themeTokens, tokensIn, type Theme } from '../site/src/lib/design-tokens.ts';

const read = (file: string) => readTokens(readFileSync(new URL(`../site/src/styles/tokens/${file}`, import.meta.url), 'utf8'));
const primitives = read('primitives.css');
const semantic = read('semantic.css');
const content = read('content.css');
const all = [...primitives, ...semantic, ...content];

/** WCAG 2.2 relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb color: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(match[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const contentColors = [...new Set(content.map((d) => d.name).filter((n) => /^--(accent|rarity)-/.test(n)))];
const textTokens = ['--color-text', '--color-text-muted', '--color-accent', ...contentColors];
const uiTokens = ['--color-control-border', '--color-focus'];
const backgrounds = ['--color-bg', '--color-surface'];

describe('contrast ratio', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

describe.each<Theme>(['light', 'dark'])('%s theme contrast (SPEC.md §9.7)', (theme) => {
  const tokens = themeTokens(all, theme);

  it('declares every type and rarity color from §9.6', () => {
    for (const name of ['--accent-creature', '--accent-magic-item', '--accent-spell', '--rarity-common', '--rarity-uncommon', '--rarity-rare', '--rarity-very-rare', '--rarity-legendary', '--rarity-artifact']) {
      expect(contentColors).toContain(name);
    }
  });

  for (const bg of backgrounds) {
    it.each(textTokens)(`%s on ${bg} is at least 4.5:1`, (fg) => {
      expect(contrast(resolveToken(tokens, fg), resolveToken(tokens, bg))).toBeGreaterThanOrEqual(4.5);
    });
    it.each(uiTokens)(`%s on ${bg} is at least 3:1`, (fg) => {
      expect(contrast(resolveToken(tokens, fg), resolveToken(tokens, bg))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('theme blocks (SPEC.md §9.6 "Themes")', () => {
  it.each([['semantic.css', semantic], ['content.css', content]] as const)(
    '%s: the system-dark block declares exactly the explicit dark tokens',
    (_, decls) => {
      expect(Object.fromEntries(tokensIn(decls, 'system-dark'))).toEqual(Object.fromEntries(tokensIn(decls, 'dark')));
    },
  );

  it.each([['semantic.css', semantic], ['content.css', content]] as const)(
    '%s: light and dark declare the same tokens',
    (_, decls) => {
      expect([...tokensIn(decls, 'dark').keys()].sort()).toEqual([...tokensIn(decls, 'light').keys()].sort());
    },
  );
});

describe('reduced motion (SPEC.md §9.7)', () => {
  it('sets every duration primitive to 0ms under prefers-reduced-motion', () => {
    const durations = [...tokensIn(primitives, 'base').keys()].filter((n) => n.startsWith('--duration-'));
    expect(durations.length).toBeGreaterThan(0);
    const reduced = tokensIn(primitives, 'reduced-motion');
    for (const name of durations) expect(reduced.get(name), name).toBe('0ms');
  });

  it('defines every semantic duration through a duration primitive', () => {
    const tokens = themeTokens(all, 'light');
    const durations = [...tokens.keys()].filter((n) => /^--duration-/.test(n));
    for (const name of durations) expect(resolveToken(tokens, name), name).toMatch(/^\d+ms$/);
    for (const [name, value] of tokensIn(semantic, 'base')) {
      if (/duration/.test(name)) expect(value, name).toMatch(/^var\(--duration-[a-z]+\)$/);
    }
  });
});
