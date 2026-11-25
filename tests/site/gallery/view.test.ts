// Gallery filtering, search, sort, and chips (docs/site.md#gallery).
import { beforeAll, describe, expect, it } from 'vitest';
import { galleryConfig, sortChoices, type GalleryConfig, type LibraryRecord, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { chips, computeView, sortRecords, withoutFilter } from '../../../site/src/lib/gallery/view.ts';
import { fixtureRecords, record, registry, whole } from './helpers.ts';

let reg: Registry;
let fixtures: LibraryRecord[];
let library: GalleryConfig;
beforeAll(async () => {
  reg = await registry();
  fixtures = await fixtureRecords();
  library = galleryConfig(reg);
});

const view = (records: LibraryRecord[], config: GalleryConfig, query: string) =>
  computeView(records, config, parseQuery(whole(query), config)).results.map((r) => r.name);

describe('finding the example entries', () => {
  it('by a substring of the name, ignoring case', () => {
    expect(view(fixtures, library, '?q=cinder')).toEqual(['Cinder Hound']);
    expect(view(fixtures, library, '?q=CIND')).toEqual(['Cinder Hound']);
    expect(view(fixtures, library, '?q=hound')).toEqual(['Cinder Hound']);
    expect(view(fixtures, library, '?q=frost')).toHaveLength(2);
  });

  it('with no fuzzy matching', () => {
    expect(view(fixtures, library, '?q=cimder')).toEqual([]);
  });

  it('ignores an old tag filter, as any filter on a path the Library lacks', () => {
    expect(view(fixtures, library, '?f.tags.theme=fire')).toEqual(view(fixtures, library, ''));
  });

  it('by facet', () => {
    expect(view(fixtures, library, '?f.stats.cr=2..2')).toEqual(['Cinder Hound']);
    expect(view(fixtures, library, '?f.stats.cr=3..')).toEqual([]);
    expect(view(fixtures, library, '?f.stats.rarity=uncommon')).toEqual(['Wand of Frost Lances']);
    expect(view(fixtures, library, '?f.type=spell')).toEqual(['Frost Lance']);
  });

  it('by type, through the type filter', () => {
    expect(view(fixtures, library, '?f.type=creature')).toEqual(['Cinder Hound']);
  });

  it('by ruleset, through the ruleset filter', () => {
    expect(view(fixtures, library, '?f.ruleset=dnd-5e-2024')).toHaveLength(fixtures.length);
    expect(view(fixtures, library, '?f.ruleset=another-ruleset')).toEqual([]);
  });
});

describe('filter logic', () => {
  const records = [
    record({ id: 'a', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 5, 'stats.size': 'Huge' } }),
    record({ id: 'b', facets: { 'stats.creatureType': 'fiend', 'stats.cr': 1, 'stats.size': ['small', 'Medium'] } }),
    record({ id: 'c', facets: { 'stats.creatureType': 'beast', 'stats.cr': 9 } }),
  ];

  it('ORs values within a filter and ANDs filters', () => {
    expect(view(records, library, '?f.stats.creatureType=dragon,fiend&sort=name:asc')).toEqual(['a', 'b']);
    expect(view(records, library, '?f.stats.creatureType=dragon,fiend&f.stats.cr=..3')).toEqual(['b']);
  });

  it('matches string values case-insensitively, inside arrays too, and never matches a missing value', () => {
    expect(view(records, library, '?f.stats.size=huge')).toEqual(['a']);
    expect(view(records, library, '?f.stats.size=medium')).toEqual(['b']);
    expect(view(records, library, '?f.stats.size=huge,small,medium&sort=name:asc')).toEqual(['a', 'b']);
  });

  it('search narrows within the active filters', () => {
    const named = [record({ id: 'ember-drake', name: 'Ember Drake', facets: { 'stats.cr': 5 } }), record({ id: 'ember-imp', name: 'Ember Imp', facets: { 'stats.cr': 1 } })];
    expect(view(named, library, '?q=ember&f.stats.cr=4..')).toEqual(['Ember Drake']);
  });

  it('matches the name only, not the summary', () => {
    const named = [record({ id: 'glacier-toad', name: 'Glacier Toad', summary: 'It spits a frost bolt.' }), record({ id: 'frost-toad', name: 'Frost Toad' })];
    expect(view(named, library, '?q=frost')).toEqual(['Frost Toad']);
  });

  it('ignores accents in the name and the query', () => {
    const named = [record({ id: 'naive-golem', name: 'Naïve Golem' }), record({ id: 'stone-golem', name: 'Stone Golem' })];
    expect(view(named, library, '?q=naive')).toEqual(['Naïve Golem']);
    expect(view(named, library, '?q=NAÏVE')).toEqual(['Naïve Golem']);
  });

  it('ignores a blank query', () => {
    expect(view(fixtures, library, '?q=%20%20')).toEqual(view(fixtures, library, ''));
  });
});

describe('the spec cases for name search (docs/site.md#gallery "Search")', () => {
  it('finds the Barbarian by "barb" but not by "rage", a feature it names', () => {
    const barbarian = [record({ id: 'barbarian', type: 'class', name: 'Barbarian', summary: 'A fierce warrior fueled by Rage.' })];
    expect(view(barbarian, library, '?q=barb')).toEqual(['Barbarian']);
    expect(view(barbarian, library, '?q=rage')).toEqual([]);
  });

  it('finds Acid Arrow by "ACID" and by "arrow"', () => {
    const spells = [record({ id: 'acid-arrow', type: 'spell', name: 'Acid Arrow' }), record({ id: 'fireball', type: 'spell', name: 'Fireball' })];
    expect(view(spells, library, '?q=ACID')).toEqual(['Acid Arrow']);
    expect(view(spells, library, '?q=arrow')).toEqual(['Acid Arrow']);
  });

  it('keeps the active sort: "bandit" by CR descending lists the captain first', () => {
    const bandits = [
      record({ id: 'bandit', name: 'Bandit', facets: { 'stats.cr': 0.125 } }),
      record({ id: 'bandit-captain', name: 'Bandit Captain', facets: { 'stats.cr': 2 } }),
      record({ id: 'cultist', name: 'Cultist', facets: { 'stats.cr': 0.125 } }),
    ];
    expect(view(bandits, library, '?q=bandit&sort=stats.cr:desc')).toEqual(['Bandit Captain', 'Bandit']);
    expect(view(bandits, library, '?q=bandit&sort=stats.cr:asc')).toEqual(['Bandit', 'Bandit Captain']);
  });
});

describe('sorting', () => {
  it('sorts ordered enums by their declared order, not alphabetically', () => {
    const items = ['legendary', 'common', 'very-rare', 'rare'].map((rarity) =>
      record({ id: rarity, type: 'item', facets: { 'stats.rarity': rarity } }),
    );
    const config = library;
    expect(sortRecords(items, { path: 'stats.rarity', dir: 'asc' }, config).map((r) => r.id)).toEqual(['common', 'rare', 'very-rare', 'legendary']);
    expect(sortRecords(items, { path: 'stats.rarity', dir: 'desc' }, config).map((r) => r.id)).toEqual(['legendary', 'very-rare', 'rare', 'common']);
  });

  it('sorts array facets by their first item (size)', () => {
    const items = [record({ id: 'big', facets: { 'stats.size': ['huge'] } }), record({ id: 'small', facets: { 'stats.size': ['tiny', 'small'] } })];
    expect(sortRecords(items, { path: 'stats.size', dir: 'asc' }, library).map((r) => r.id)).toEqual(['small', 'big']);
  });

  it('puts entries missing the sort value last in either direction', () => {
    const items = [record({ id: 'none' }), record({ id: 'two', facets: { 'stats.cr': 2 } }), record({ id: 'one', facets: { 'stats.cr': 1 } })];
    expect(sortRecords(items, { path: 'stats.cr', dir: 'asc' }, library).map((r) => r.id)).toEqual(['one', 'two', 'none']);
    expect(sortRecords(items, { path: 'stats.cr', dir: 'desc' }, library).map((r) => r.id)).toEqual(['two', 'one', 'none']);
  });

  it('sorts by name and by date added', () => {
    const items = [record({ id: 'b', name: 'beta', createdAt: '2026-03-01' }), record({ id: 'a', name: 'Alpha', createdAt: '2026-05-01' })];
    expect(sortRecords(items, { path: 'name', dir: 'asc' }, library).map((r) => r.id)).toEqual(['a', 'b']);
    expect(sortRecords(items, { path: 'createdAt', dir: 'desc' }, library).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('breaks name ties by ruleset, type, and id, so input order never matters', () => {
    const items = [
      record({ id: 'twin-b', name: 'Twin' }),
      record({ id: 'twin-a', name: 'Twin', type: 'spell' }),
      record({ id: 'twin-c', name: 'twin' }),
    ];
    const expected = ['twin-b', 'twin-c', 'twin-a'];
    expect(sortRecords(items, { path: 'name', dir: 'asc' }, library).map((r) => r.id)).toEqual(expected);
    expect(sortRecords([...items].reverse(), { path: 'name', dir: 'asc' }, library).map((r) => r.id)).toEqual(expected);
  });
});

describe('the Library’s default sort', () => {
  const mixed = () => [
    record({ id: 'zephyr', name: 'Zephyr Drake', createdAt: '2026-11-02', facets: { 'stats.cr': 3 } }),
    record({ id: 'arcane-bolt', name: 'Arcane Bolt', type: 'spell', createdAt: '2026-10-31' }),
    record({ id: 'mire-imp', name: 'Mire Imp', createdAt: '2026-11-02', facets: { 'stats.cr': 0.5 } }),
    record({ id: 'bone-ring', name: 'Bone Ring', type: 'item', createdAt: '2026-11-01' }),
  ];

  it('is alphabetical, whatever the library.json order', () => {
    const alphabetical = ['Arcane Bolt', 'Bone Ring', 'Mire Imp', 'Zephyr Drake'];
    expect(library.defaultSort).toEqual({ path: 'name', dir: 'asc' });
    expect(view(mixed(), library, '')).toEqual(alphabetical);
    expect(view(mixed().reverse(), library, '')).toEqual(alphabetical);
  });

  it('offers CR as a sort, with entries that have no CR last', () => {
    expect(sortChoices(library).map((c) => c.path)).toContain('stats.cr');
    expect(sortChoices(library).map((c) => c.path)).not.toContain('ruleset');
    expect(view(mixed(), library, '?sort=stats.cr:asc')).toEqual(['Mire Imp', 'Zephyr Drake', 'Arcane Bolt', 'Bone Ring']);
    expect(view(mixed(), library, '?sort=stats.cr:desc')).toEqual(['Zephyr Drake', 'Mire Imp', 'Arcane Bolt', 'Bone Ring']);
  });
});

describe('filter values', () => {
  const records = [
    record({ id: 'a', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 5, 'stats.environment': 'Coast' } }),
    record({ id: 'b', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 1, 'stats.environment': 'coast' } }),
    record({ id: 'c', facets: { 'stats.creatureType': 'beast', 'stats.cr': 1 } }),
  ];

  it('counts each value against the search and every other filter, showing stored case', () => {
    const state = parseQuery(whole('?f.stats.cr=..2&f.stats.creatureType=beast'), library);
    const def = library.filters.find((f) => f.path === 'stats.creatureType')!;
    const result = chips(def, records, withoutFilter(library, records, state, def.path), state.filters.get(def.path));
    expect(result).toEqual([
      { key: 'beast', stored: 'beast', count: 1 },
      { key: 'dragon', stored: 'dragon', count: 1 },
    ]);
    const environment = chips({ path: 'stats.environment', label: 'environment', kind: 'enum' }, records, records);
    expect(environment).toEqual([{ key: 'coast', stored: 'Coast', count: 2 }]);
  });

  it('keeps a selected value no record has, so it can be cleared', () => {
    const def = library.filters.find((f) => f.path === 'stats.creatureType')!;
    expect(chips(def, records, records, { kind: 'enum', values: ['fiend'] }).map((c) => [c.key, c.count])).toContainEqual(['fiend', 0]);
  });

  it('sorts ref values, and records by a ref, by the target’s name', () => {
    const config = galleryConfig(reg, { names: { 'class/bard': 'Bard', 'class/wizard': 'Wizard', 'class/cleric': 'Cleric' }, groups: {}, publishers: {}, chips: {} });
    const defaultSort = config.types.get('dnd-5e-2024/subclass')!.defaultSort;
    const subs = [
      record({ id: 'lore', type: 'subclass', facets: { 'stats.class': 'class/bard' } }),
      record({ id: 'evoker', type: 'subclass', facets: { 'stats.class': 'class/wizard' } }),
      record({ id: 'life', type: 'subclass', facets: { 'stats.class': 'class/cleric' } }),
    ];
    expect(defaultSort).toEqual({ path: 'stats.class', dir: 'asc' });
    expect(sortRecords(subs, defaultSort, config).map((r) => r.id)).toEqual(['lore', 'life', 'evoker']);
    const def = config.filters.find((f) => f.path === 'stats.class')!;
    expect(chips(def, subs, subs).map((c) => c.key)).toEqual(['class/bard', 'class/cleric', 'class/wizard']);
  });
});
