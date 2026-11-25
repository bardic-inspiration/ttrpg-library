// The gallery island's markup (docs/site.md#gallery, docs/styling.md#accessibility), rendered to a string.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { beforeAll, describe, expect, it } from 'vitest';
import Gallery from '../../../site/src/components/gallery/Gallery.tsx';
import { NO_FACET_DATA, type LibraryRecord } from '../../../site/src/lib/gallery/config.ts';
import { chipFacets, loadSchemas } from '../../../site/src/lib/gallery/facet-data.ts';
import registry from '../../../config/types.json' with { type: 'json' };
import { fixtureRecords, whole } from './helpers.ts';

let records: LibraryRecord[];
beforeAll(async () => {
  records = await fixtureRecords();
});

/** The gallery, with the whole ruleset in the ruleset set unless the query sets it, since the fixtures are homebrew. */
const render = (props: Record<string, unknown>) =>
  renderToString(
    h(Gallery, { indexUrl: '/library.json', base: '/ttrpg-library/', records, ...props, initialQuery: whole((props.initialQuery as string | undefined) ?? '') }),
  );

describe('Gallery', () => {
  it('shows a loading message until the index arrives', () => {
    expect(render({ records: undefined })).toContain('Loading the library');
  });

  it('renders a card per result, with the type badge and card fields, and no art when there is none', () => {
    const html = render({});
    // The three example entries, and the two classes Frost Lance names.
    expect(html.match(/<article class="card linked-card"/g)).toHaveLength(5);
    expect(html).toContain('data-type="creature"');
    expect(html).toContain('<dt>CR</dt><dd>2</dd>');
    expect(html).toContain('<dt>Level</dt><dd>1</dd>');
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

  it('reads the repo’s chip fields from its schemas (docs/content-model.md#display)', () => {
    expect(chipFacets(registry as never, loadSchemas())).toEqual({
      'dnd-5e-2024/class': ['stats.hitDie'],
      'dnd-5e-2024/creature': ['stats.cr'],
      'dnd-5e-2024/feat': ['stats.category'],
      'dnd-5e-2024/item': ['stats.category'],
      'dnd-5e-2024/spell': ['stats.level', 'stats.school'],
    });
  });

  it('shows a chip field on a card as its label and value, a badge, and its filter values as chips', () => {
    const facetData = { ...NO_FACET_DATA, chips: { 'dnd-5e-2024/spell': ['stats.level', 'stats.school'] } };
    const html = render({ initialQuery: '?f.type=spell', facetData });
    expect(html).toContain('<li class="badge">Level: 1</li>');
    expect(html).not.toContain('Level: Level');
    expect(html).not.toContain('<dt>Level</dt>');
    expect(html).not.toContain('<dt>School</dt>');
    expect(html).toMatch(/<ul class="tree__values tree__chips" id="filter-dnd-5e-2024-spell-stats-school-panel"[^>]*><li><button type="button" class="chip" aria-pressed="false">/);
    expect(html).not.toContain('<input type="checkbox" id="filter-dnd-5e-2024-spell-stats-school-');
    // A range facet keeps its min and max inputs, whatever its display.
    expect(html).toContain('tree__range');
  });

  it('reads CR as a chip with its label, and keeps its range inputs', () => {
    const facetData = { ...NO_FACET_DATA, chips: { 'dnd-5e-2024/creature': ['stats.cr'] } };
    const html = render({ initialQuery: '?f.type=creature', facetData });
    expect(html).toContain('<li class="badge">CR: 2</li>');
    expect(html).not.toContain('<dt>CR</dt>');
    expect(html).toContain('tree__range');
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
    expect(html).toMatch(/<button type="button" class="disclosure disclosure--icon tree__toggle" id="filter-dnd-5e-2024-creature-toggle" aria-expanded="false" aria-controls="filter-dnd-5e-2024-creature-panel" aria-label="Creature filters"><span class="chevron" aria-hidden="true"><\/span><\/button>/);
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

  it('keeps a facet\'s values a list, named by its toggle, so each value is a list item (axe listitem)', () => {
    const html = render({ initialQuery: '?f.type=creature' });
    const lists = html.match(/<ul class="tree__values"[^>]*>/g) ?? [];
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) expect(list).not.toMatch(/\brole=/);
    expect(html).toContain('<ul class="tree__values" id="filter-dnd-5e-2024-creature-stats-creatureType-panel" aria-labelledby="filter-dnd-5e-2024-creature-stats-creatureType-toggle">');
  });

  it('puts the search above the filter menu, which a toggle opens on phones and tablets', () => {
    const html = render({});
    expect(html).toMatch(/class="gallery__menu"><div class="gallery__search" role="search">.*<button type="button" class="disclosure gallery__filters-toggle" aria-expanded="false" aria-controls="gallery-filters"><span class="chevron" aria-hidden="true"><\/span>.*<section id="gallery-filters" class="gallery__filters" aria-label="Filters">/);
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

  it('puts the Ruleset node alone in the filter tree, with each ruleset’s types inside it (#380, #395)', () => {
    const html = render({});
    const [before, tree = ''] = html.split('<ul class="tree">');
    expect(before).not.toContain('Creature');
    expect(tree).toMatch(/Ruleset.*Source and author.*Types.*Creature/);
    expect(html.match(/<ul class="tree">/g)).toHaveLength(1);
  });

  it('starts a fresh Library on the official content alone: the two SRD classes, not the homebrew fixtures', () => {
    const html = renderToString(h(Gallery, { indexUrl: '/library.json', base: '/ttrpg-library/', records, initialQuery: '' }));
    expect(html.match(/<article class="card linked-card"/g)).toHaveLength(2);
    expect(html).not.toContain('Cinder Hound');
    expect(html).not.toContain('gallery__clear');
  });

  describe('where an entry comes from (#379)', () => {
    const official = (r: LibraryRecord): LibraryRecord => ({ ...r, source: 'SRD 5.2', author: 'publisher' });
    const card = (html: string, name: string) => html.split('<article').find((part) => part.includes(`>${name}</a>`)) ?? '';

    it('shows the source on its own line below the summary, not as a badge, and no line for an entry with none', () => {
      const withSource = records.map((r) => (r.id === 'frost-lance' ? { ...r, source: "Bardic's Compendium of Test Fixtures" } : r));
      const html = render({ records: withSource, initialQuery: '?f.type=spell' });
      const lance = card(html, 'Frost Lance');
      expect(lance).toMatch(/<ul class="card__badges"><li class="badge">Spell<\/li>/);
      expect(lance).toMatch(/<p class="card__summary">[^<]*<\/p><p class="card__source">Bardic(&#39;|')s Compendium of Test Fixtures<\/p>/);
      expect(html).not.toContain('badge--source');
      const bare = render({ records: records.map((r) => ({ ...r, source: null })), initialQuery: '?f.type=spell' });
      expect(bare).not.toContain('card__source');
    });

    it('stars official cards with an accessible name, and reserves the same slot on every other card', () => {
      const html = render({ records: records.map((r) => (r.id === 'cinder-hound' ? official(r) : r)) });
      const hound = card(html, 'Cinder Hound');
      const lance = card(html, 'Frost Lance');
      expect(hound).toMatch(/<span class="card__official"><span role="img" aria-label="Official" title="Official"><svg class="icon"/);
      expect(lance).toContain('<span class="card__official"></span>');
      // The name and the slot share one head on both cards, so the name's width never depends on the star.
      for (const part of [hound, lance]) expect(part).toMatch(/<div class="card__head"><h2 class="card__name"[^>]*>.*<\/h2><span class="card__official">/);
    });
  });
});
