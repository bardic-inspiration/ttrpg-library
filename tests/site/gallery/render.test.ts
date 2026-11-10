// The gallery island's markup (docs/site.md#gallery, docs/styling.md#accessibility), rendered to a string.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { beforeAll, describe, expect, it } from 'vitest';
import Gallery from '../../../site/src/components/gallery/Gallery.tsx';
import type { LibraryRecord } from '../../../site/src/lib/gallery/config.ts';
import { fixtureRecords } from './helpers.ts';

let records: LibraryRecord[];
beforeAll(async () => {
  records = await fixtureRecords();
});

const render = (props: Record<string, unknown>) =>
  renderToString(h(Gallery, { indexUrl: '/library.json', base: '/ttrpg-library/', records, initialQuery: '', ...props }));

describe('Gallery', () => {
  it('shows a loading message until the index arrives', () => {
    expect(render({ records: undefined })).toContain('Loading the library');
  });

  it('renders a card per result, with the type badge and card fields, and no art when there is none', () => {
    const html = render({});
    // The three example entries, and the two classes Frost Lance names.
    expect(html.match(/<article class="card"/g)).toHaveLength(5);
    expect(html).toContain('data-type="creature"');
    expect(html).toContain('<dt>CR</dt><dd>2</dd>');
    expect(html).toContain('<dt>Level</dt><dd>Level 1</dd>');
    expect(html).not.toContain('art-placeholder');
    expect(html).not.toContain('Art placeholder');
    expect(html).not.toContain('card__art');
    expect(html).toContain('data-rarity="uncommon"');
  });

  it('shows art on a card only when the entry has it', () => {
    const withArt = records.map((r) =>
      r.id === 'cinder-hound' ? { ...r, image: 'assets/images/dnd-5e-2024/creature/cinder-hound.webp' } : r,
    );
    const html = render({ records: withArt });
    expect(html.match(/<img class="card__art"/g)).toHaveLength(1);
    expect(html).toMatch(/<img class="card__art" src="[^"]*cinder-hound\.webp" alt="Cinder Hound"/);
    expect(html).not.toContain('art-placeholder');
    expect(html).not.toContain('Art placeholder');
  });

  it('announces the result count in a polite live region', () => {
    expect(render({})).toContain('<p role="status" class="gallery__count">5 entries</p>');
    expect(render({ initialQuery: '?f.type=spell' })).toContain('>1 entry</p>');
    expect(render({ initialQuery: '?q=zzzzqqq' })).toContain('>No entries match.</p>');
  });

  it('renders the filters as a tree: types as checkboxes, nodes as disclosures, values as checkboxes with counts', () => {
    const html = render({ initialQuery: '?f.type=spell' });
    expect(html).not.toContain('Add filter');
    expect(html).not.toContain('aria-pressed');
    expect(html).toMatch(/<input type="checkbox" id="filter-dnd-5e-2024-spell" checked\/><label for="filter-dnd-5e-2024-spell">Spell <span class="tree__count">1<span class="visually-hidden"> entry<\/span><\/span><\/label>/);
    expect(html).toMatch(/<input type="checkbox" id="filter-dnd-5e-2024-creature"\/>/);
    expect(html).toMatch(/<button type="button" class="tree__toggle" id="filter-dnd-5e-2024-creature-toggle" aria-expanded="false" aria-controls="filter-dnd-5e-2024-creature-panel" aria-label="Creature filters">/);
    expect(html).toMatch(/<ul class="tree__children" id="filter-dnd-5e-2024-creature-panel" hidden>/);
  });

  it('opens a checked type and its default filters, with each value a labeled checkbox', () => {
    const html = render({ initialQuery: '?f.type=creature' });
    expect(html).toMatch(/id="filter-dnd-5e-2024-creature-toggle" aria-expanded="true"/);
    expect(html).toMatch(/id="filter-dnd-5e-2024-creature-stats-creatureType-toggle" aria-expanded="true"[^>]*>.*?Creature type<\/button>/);
    expect(html).toMatch(/id="filter-dnd-5e-2024-creature-stats-size-toggle" aria-expanded="false"/);
    expect(html).toContain(
      '<input type="checkbox" id="filter-dnd-5e-2024-creature-stats-creatureType-monstrosity"/><label for="filter-dnd-5e-2024-creature-stats-creatureType-monstrosity">Monstrosity <span class="tree__count">1',
    );
  });

  it('puts the search above the filter menu, which a toggle opens on phones and tablets', () => {
    const html = render({});
    expect(html).toMatch(/class="gallery__menu"><div class="gallery__search" role="search">.*<button type="button" class="gallery__filters-toggle" aria-expanded="false" aria-controls="gallery-filters">.*<section id="gallery-filters" class="gallery__filters" aria-label="Filters">/);
    expect(html).not.toContain('data-open');
  });

  it('labels every control', () => {
    const html = render({ initialQuery: '?f.stats.cr=1..' });
    for (const id of ['gallery-q', 'gallery-sort', 'gallery-dir', 'filter-dnd-5e-2024-creature-stats-cr-min', 'filter-dnd-5e-2024-creature-stats-cr-max']) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('Select<span class="visually-hidden"> Cinder Hound</span>');
  });

  it('offers set actions on the filtered set beside the result count', () => {
    const html = render({ initialQuery: '?f.type=spell' });
    expect(html).toMatch(/class="gallery__summary">.*class="set-actions"/);
    expect(html).toContain('Print<span class="visually-hidden"> 1 entry</span>');
  });

  it('links each card to its detail page', () => {
    expect(render({})).toContain('href="/ttrpg-library/dnd-5e-2024/creature/cinder-hound/"');
  });
});
