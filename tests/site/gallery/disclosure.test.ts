// @vitest-environment happy-dom
// The filter tree's open nodes (docs/site.md#gallery "Filters"): every control in the tree is a
// discrete interaction. Checking or clearing a filter never opens or closes a node; a disclosure
// opens or closes its own node only. Rendered into happy-dom and clicked as a reader does.
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import Gallery from '../../../site/src/components/gallery/Gallery.tsx';
import type { LibraryRecord } from '../../../site/src/lib/gallery/config.ts';
import { fixtureRecords } from './helpers.ts';

let records: LibraryRecord[];
let root: HTMLElement | undefined;
beforeAll(async () => {
  records = await fixtureRecords();
});
afterEach(() => {
  if (!root) return;
  act(() => render(null, root!));
  root.remove();
  root = undefined;
});

function mount(initialQuery = '') {
  root = document.body.appendChild(document.createElement('div'));
  act(() => render(h(Gallery, { indexUrl: '/library.json', base: '/ttrpg-library/', records, initialQuery }), root!));
}

/** Every disclosure's state, by its id. */
const disclosures = () =>
  Object.fromEntries([...document.querySelectorAll('.tree__toggle')].map((b) => [b.id, b.getAttribute('aria-expanded')]));
const byId = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no #${id}`);
  return el as T;
};
const click = (id: string) => act(() => byId(id).click());

const CREATURE = 'filter-dnd-5e-2024-creature';
const CREATURE_TYPE = 'filter-dnd-5e-2024-creature-stats-creatureType';

describe('filter tree disclosures', () => {
  it('leaves every node as it was when a type is checked or unchecked', () => {
    mount();
    const before = disclosures();
    expect(before[`${CREATURE}-toggle`]).toBe('false');
    click(CREATURE);
    expect(byId<HTMLInputElement>(CREATURE).checked).toBe(true);
    expect(disclosures()).toEqual(before);
    click(CREATURE);
    expect(byId<HTMLInputElement>(CREATURE).checked).toBe(false);
    expect(disclosures()).toEqual(before);
  });

  it('leaves every node as it was when a value is checked or unchecked', () => {
    mount();
    click(`${CREATURE}-toggle`);
    click(`${CREATURE_TYPE}-toggle`);
    const before = disclosures();
    click(`${CREATURE_TYPE}-monstrosity`);
    expect(byId<HTMLInputElement>(`${CREATURE_TYPE}-monstrosity`).checked).toBe(true);
    expect(disclosures()).toEqual(before);
    // Closing the type keeps the value checked inside it, and the node stays closed.
    click(`${CREATURE}-toggle`);
    const closed = disclosures();
    click(`${CREATURE}-toggle`);
    click(`${CREATURE_TYPE}-monstrosity`);
    click(`${CREATURE}-toggle`);
    click(`${CREATURE_TYPE}-monstrosity`);
    expect(disclosures()).toEqual(closed);
  });

  it('keeps the nodes a link opens as the reader leaves them, whatever is then checked', () => {
    mount('?f.type=creature&f.stats.creatureType=monstrosity');
    const before = disclosures();
    expect([before[`${CREATURE}-toggle`], before[`${CREATURE_TYPE}-toggle`]]).toEqual(['true', 'true']);
    click(`${CREATURE_TYPE}-monstrosity`);
    click(CREATURE);
    expect(disclosures()).toEqual(before);
    act(() => (document.querySelector('.gallery__clear') as HTMLButtonElement | null)?.click());
    expect(disclosures()).toEqual(before);
  });

  it('opens and closes only the disclosure’s own node', () => {
    mount();
    click(`${CREATURE}-toggle`);
    const open = disclosures();
    expect(open[`${CREATURE}-toggle`]).toBe('true');
    click(`${CREATURE_TYPE}-toggle`);
    expect(disclosures()).toEqual({ ...open, [`${CREATURE_TYPE}-toggle`]: 'true' });
    // Closing the type keeps its nested node open for when the type opens again.
    click(`${CREATURE}-toggle`);
    click(`${CREATURE}-toggle`);
    expect(disclosures()).toEqual({ ...open, [`${CREATURE_TYPE}-toggle`]: 'true' });
  });
});
