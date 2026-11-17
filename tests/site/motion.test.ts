// Reduced motion (docs/styling.md#accessibility) on the design tokens (docs/styling.md#tokens): every
// transition duration becomes 0ms under prefers-reduced-motion.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTokens, resolveToken, tokensIn } from '../../site/src/lib/design-tokens.ts';

const read = (file: string) => readTokens(readFileSync(new URL(`../../site/src/styles/tokens/${file}`, import.meta.url), 'utf8'));
const primitives = read('primitives.css');
const semantic = read('semantic.css');
const content = read('content.css');
const all = [...primitives, ...semantic, ...content];

describe('reduced motion (docs/styling.md#accessibility)', () => {
  it('sets every duration primitive to 0ms under prefers-reduced-motion', () => {
    const durations = [...tokensIn(primitives, 'base').keys()].filter((n) => n.startsWith('--duration-'));
    expect(durations.length).toBeGreaterThan(0);
    const reduced = tokensIn(primitives, 'reduced-motion');
    for (const name of durations) expect(reduced.get(name), name).toBe('0ms');
  });

  it('defines every semantic duration through a duration primitive', () => {
    const tokens = tokensIn(all, 'base');
    const durations = [...tokens.keys()].filter((n) => /^--duration-/.test(n));
    for (const name of durations) expect(resolveToken(tokens, name), name).toMatch(/^\d+ms$/);
    for (const [name, value] of tokensIn(semantic, 'base')) {
      if (/duration/.test(name)) expect(value, name).toMatch(/^var\(--duration-[a-z]+\)$/);
    }
  });
});
