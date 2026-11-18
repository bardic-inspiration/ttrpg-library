// @vitest-environment happy-dom
// A range facet's min and max inputs (docs/site.md#gallery "Filters"), rendered into happy-dom and typed
// into as a reader does: fractions and decimals pass through text that doesn't parse yet ("1/", "1."),
// which must neither clear the filter nor be rewritten under the reader's cursor.
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilterTree, idFor } from '../../../site/src/components/gallery/Filters.tsx';
import type { FilterDef } from '../../../site/src/lib/gallery/config.ts';
import type { FilterValue } from '../../../site/src/lib/gallery/state.ts';
import type { TreeNode } from '../../../site/src/lib/gallery/tree.ts';

const CR: FilterDef = { path: 'stats.cr', label: 'CR', kind: 'range', format: 'cr' };
const HP: FilterDef = { path: 'derived.hp.average', label: 'HP', kind: 'range' };
const node = (def: FilterDef): TreeNode => ({ kind: 'range', id: def.path, def, open: true, bounds: { min: 0, max: 30 } });

let root: HTMLElement;
/** Every filter value committed, in order, as the gallery's state would hold it; undefined clears it. */
let commits: Array<{ min?: number; max?: number } | undefined>;
let clear: () => void;

/** The tree with CR and HP ranges, holding the filters as the gallery does (Gallery.tsx `setFilter`). */
function Harness() {
  const [filters, setFilters] = useState<Map<string, FilterValue>>(new Map());
  clear = () => setFilters(new Map());
  return h(FilterTree, {
    nodes: [node(CR), node(HP)],
    filters,
    onEnum: () => {},
    onRange: (path, min, max) => {
      const value = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
      const active = min !== undefined || max !== undefined;
      commits.push(active ? value : undefined);
      const next = new Map(filters);
      if (active) next.set(path, { kind: 'range', ...value });
      else next.delete(path);
      setFilters(next);
    },
  });
}

const input = (def: FilterDef, bound: 'min' | 'max') =>
  document.getElementById(`${idFor(def.path)}-${bound}`) as HTMLInputElement;
/** Types at the end of a text input's value, firing one `input`, as one keystroke does. */
const typeInto = (el: HTMLInputElement, text: string) => {
  el.value += text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
/** Replaces a text input's whole value, as selecting it and typing or deleting does, firing one `input`. */
const replaceValue = (el: HTMLInputElement, text: string) => {
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
/** Types one character per keystroke, letting the page render between keystrokes as a browser does. */
const typed = (el: HTMLInputElement, text: string) => {
  for (const char of text) act(() => typeInto(el, char));
};
const replaced = (el: HTMLInputElement, text: string) => act(() => replaceValue(el, text));
const focus = (el: HTMLInputElement) => act(() => el.focus());
const blur = (el: HTMLInputElement) => act(() => el.blur());

beforeEach(() => {
  root = document.body.appendChild(document.createElement('div'));
  commits = [];
  act(() => render(h(Harness, {}), root));
});

afterEach(() => {
  act(() => render(null, root));
  root.remove();
});

describe('range inputs (docs/site.md#gallery "Filters")', () => {
  it('takes a fraction typed into CR Min', () => {
    const min = input(CR, 'min');
    focus(min);
    typed(min, '1/8');
    expect(min.value).toBe('1/8');
    expect(commits).toEqual([{ min: 1 }, { min: 0.125 }]);
  });

  it('takes a fraction typed into CR Max', () => {
    const max = input(CR, 'max');
    focus(max);
    typed(max, '1/2');
    expect(max.value).toBe('1/2');
    expect(commits).toEqual([{ max: 1 }, { max: 0.5 }]);
  });

  it('takes a decimal typed into HP Max', () => {
    const max = input(HP, 'max');
    focus(max);
    typed(max, '12.5');
    expect(max.value).toBe('12.5');
    expect(commits.at(-1)).toEqual({ max: 12.5 });
  });

  it('commits only text that parses or is empty, keeping the other bound', () => {
    const min = input(HP, 'min');
    const max = input(HP, 'max');
    focus(max);
    typed(max, '20');
    focus(min);
    typed(min, '-');
    typed(min, 'x');
    expect(min.value).toBe('-x');
    expect(commits).toEqual([{ max: 2 }, { max: 20 }]);
    replaced(min, '5');
    replaced(min, '');
    expect(commits.slice(2)).toEqual([{ min: 5, max: 20 }, { max: 20 }]);
    replaced(max, '');
    expect(commits.at(-1)).toBeUndefined();
  });

  it('never rewrites the input it has focus, and shows the filter’s value once it loses focus', () => {
    const min = input(CR, 'min');
    focus(min);
    typed(min, '0.125');
    expect(min.value).toBe('0.125');
    blur(min);
    expect(min.value).toBe('1/8');
    focus(min);
    typed(min, '/');
    expect(min.value).toBe('1/8/');
    blur(min);
    expect(min.value).toBe('1/8');
  });

  it('follows the filter when it changes from outside the inputs', () => {
    const min = input(CR, 'min');
    focus(min);
    typed(min, '2');
    blur(min);
    act(() => clear());
    expect(min.value).toBe('');
  });
});
