// The literal-value lint (SPEC.md §9.6 "Rules that keep editing easy"), run
// by `npm run check`.
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const configFile = new URL('../stylelint.config.mjs', import.meta.url).pathname;

async function lint(code: string, codeFilename: string): Promise<string[]> {
  const { results } = await stylelint.lint({ code, codeFilename, configFile });
  return results.flatMap((r) => r.warnings.map((w) => w.rule));
}

const component = (css: string) => `---\n---\n<p class="x">Hi</p>\n<style>\n  @layer components {\n    .x { ${css} }\n  }\n</style>\n`;
const FILE = 'site/src/components/Example.astro';

describe('literal design values in components', () => {
  it.each([
    ['a hex color', 'color: #8a1c1c;', 'color-no-hex'],
    ['a named color', 'color: red;', 'color-named'],
    ['a color function', 'background: rgb(0 0 0);', 'function-disallowed-list'],
    ['a pixel size', 'padding: 12px;', 'unit-disallowed-list'],
    ['a rem size', 'font-size: 1.2rem;', 'unit-disallowed-list'],
    ['a radius', 'border-radius: 4px;', 'unit-disallowed-list'],
    ['a duration', 'transition: color 200ms;', 'unit-disallowed-list'],
    ['a font family', 'font-family: Georgia, serif;', 'declaration-property-value-allowed-list'],
    ['a font weight', 'font-weight: 700;', 'declaration-property-value-allowed-list'],
    ['a shadow', 'box-shadow: 0 0 0 var(--color-border);', 'declaration-property-value-allowed-list'],
  ])('rejects %s', async (_, css, rule) => {
    expect(await lint(component(css), FILE)).toContain(rule);
  });

  it('accepts tokens and the allowlisted values', async () => {
    const css = 'color: var(--color-text); padding: var(--space-s) 0; inline-size: 100%; margin: auto; font-family: var(--font-ui); transition: color var(--duration-quick); box-shadow: var(--card-shadow);';
    expect(await lint(component(css), FILE)).toEqual([]);
  });

  it('applies to global style files too', async () => {
    expect(await lint('@layer base { body { margin: 8px; } }', 'site/src/styles/base.css')).toContain('unit-disallowed-list');
  });

  it('allows literal values inside tokens/', async () => {
    const { results } = await stylelint.lint({
      code: ':root { --x: #fff; --y: 4px; }',
      codeFilename: new URL('../site/src/styles/tokens/primitives.css', import.meta.url).pathname,
      configFile,
    });
    expect(results.every((r) => r.ignored || r.warnings.length === 0)).toBe(true);
  });
});
