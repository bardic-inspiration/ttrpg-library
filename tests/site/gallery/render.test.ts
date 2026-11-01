// The gallery island's markup (SPEC.md §9.3, §9.7), rendered to a string.
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

  it('renders a card per result, with the type badge, card fields, and placeholder', () => {
    const html = render({});
    expect(html.match(/<article class="card"/g)).toHaveLength(3);
    expect(html).toContain('data-type="creature"');
    expect(html).toContain('<dt>CR</dt><dd>2</dd>');
    expect(html).toContain('<dt>Level</dt><dd>1st level</dd>');
    expect(html).toMatch(/class="art-placeholder" aria-hidden="true"/);
    expect(html).toContain('data-rarity="uncommon"');
  });

  it('announces the result count in a polite live region', () => {
    expect(render({})).toContain('<p role="status" class="gallery__count">3 entries</p>');
    expect(render({ initialQuery: '?f.type=spell' })).toContain('>1 entry</p>');
    expect(render({ initialQuery: '?q=zzzzqqq' })).toContain('>No entries match.</p>');
  });

  it('groups each filter in a fieldset with a legend, and chips report their state', () => {
    const html = render({ initialQuery: '?f.type=spell' });
    expect(html).toMatch(/<fieldset class="filter" id="filter-type"[^>]*><legend class="filter__legend"><span class="filter__label">Type<\/span>/);
    expect(html).toMatch(/aria-pressed="true">Spell/);
    expect(html).toMatch(/aria-pressed="false">Creature/);
  });

  it('labels every control', () => {
    const html = render({ type: 'creature', ruleset: 'dnd-5e-2024', initialQuery: '?f.stats.cr=1..' });
    for (const id of ['gallery-q', 'gallery-sort', 'gallery-dir', 'filter-stats-cr-min', 'filter-stats-cr-max']) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('Select<span class="visually-hidden"> Cinder Hound</span>');
  });

  it('links each card to its detail page', () => {
    expect(render({})).toContain('href="/ttrpg-library/dnd-5e-2024/creature/cinder-hound/"');
  });
});
