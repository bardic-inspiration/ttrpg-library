// One palette for the whole site (docs/styling.md#palette): no theme
// attribute, no system color-scheme block, and no theme switch anywhere in the
// site's source.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTokens } from '../../site/src/lib/design-tokens.ts';

const SRC = new URL('../../site/src/', import.meta.url).pathname;
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => /\.(css|astro|tsx?)$/.test(file))
  .map((file) => ({ file, text: readFileSync(join(SRC, file), 'utf8') }));

describe('one palette (docs/styling.md#palette)', () => {
  it('reads the site source', () => {
    expect(files.some((f) => f.file.endsWith('semantic.css'))).toBe(true);
  });

  it.each(['data-theme', 'prefers-color-scheme', 'colorScheme'])('no source file uses %s', (marker) => {
    expect(files.filter((f) => f.text.includes(marker)).map((f) => f.file)).toEqual([]);
  });

  it('declares each color token once, on :root', () => {
    for (const file of ['semantic.css', 'content.css']) {
      const decls = readTokens(readFileSync(join(SRC, 'styles/tokens', file), 'utf8')).filter((d) => /^--(color|accent|rarity)-/.test(d.name));
      expect(decls.length, file).toBeGreaterThan(0);
      expect(decls.every((d) => d.scope === 'base'), file).toBe(true);
      expect(new Set(decls.map((d) => d.name)).size, file).toBe(decls.length);
    }
  });
});
