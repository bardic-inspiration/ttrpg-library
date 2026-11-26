// The Filters toggle hides on desktop (docs/site.md#gallery "Layout"). The toggle is a shared
// disclosure, so its display rule competes with `.disclosure`'s in the same layer. The toggle's rule
// has to outrank it on specificity, since the order the bundled stylesheets land in isn't fixed.
import { readFileSync } from 'node:fs';
import postcss, { type Node, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const sheet = (path: string) => postcss.parse(readFileSync(new URL(`../../../site/src/${path}`, import.meta.url), 'utf8'));

/** The selector and layer of every rule in a sheet that declares `display` as `value`. */
function displayRules(path: string, value: string): { selector: string; layer: string | undefined }[] {
  const found: { selector: string; layer: string | undefined }[] = [];
  sheet(path).walkRules((rule: Rule) => {
    if (!rule.nodes.some((n) => n.type === 'decl' && n.prop === 'display' && n.value === value)) return;
    let layer: string | undefined;
    for (let p: Node | undefined = rule.parent; p; p = p.parent) {
      if (p.type === 'atrule' && p instanceof postcss.AtRule && p.name === 'layer') layer = p.params;
    }
    found.push({ selector: rule.selector, layer });
  });
  return found;
}

/** A selector's specificity as [ids, classes, types]: enough for the plain selectors compared here. */
function specificity(selector: string): [number, number, number] {
  if (/:[\w-]+\(/.test(selector)) throw new Error(`not a plain selector: ${selector}`);
  const bare = selector.replace(/::[\w-]+/g, ' ');
  const ids = bare.match(/#[\w-]+/g)?.length ?? 0;
  const classes = bare.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g)?.length ?? 0;
  const types = bare.replace(/[.#:][\w-]+|\[[^\]]*\]/g, ' ').match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)?.length ?? 0;
  return [ids, classes, types];
}

const outranks = (a: number[], b: number[]) => {
  const i = a.findIndex((n, k) => n !== b[k]);
  return i !== -1 && a[i]! > b[i]!;
};

/** The one rule in a list, failing when there are none or several. */
const only = <T>(rules: T[]): T => {
  expect(rules).toHaveLength(1);
  return rules[0]!;
};

describe('the Filters toggle', () => {
  const toggle = displayRules('components/gallery/gallery.css', 'var(--filters-toggle-display)');
  const disclosure = displayRules('components/shared/shared.css', 'flex').filter((r) => r.selector === '.disclosure');

  it('takes its display from one rule, for the toggle, in the same layer as the disclosure', () => {
    expect(only(toggle).selector).toMatch(/\.gallery__filters-toggle$/);
    expect(only(toggle).layer).toBe(only(disclosure).layer);
  });

  it("outranks the disclosure's display on specificity, whatever order the CSS is bundled in", () => {
    expect(outranks(specificity(only(toggle).selector), specificity(only(disclosure).selector))).toBe(true);
  });

  it('counts specificity as the cascade does', () => {
    expect(specificity('.disclosure')).toEqual([0, 1, 0]);
    expect(specificity('button.disclosure')).toEqual([0, 1, 1]);
    expect(specificity('.a > .b')).toEqual([0, 2, 0]);
    expect(specificity('#x .a:hover::before')).toEqual([1, 2, 0]);
    expect(() => specificity('.a:not(.b)')).toThrow();
  });
});
