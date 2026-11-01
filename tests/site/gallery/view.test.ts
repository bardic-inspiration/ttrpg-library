// Gallery filtering, search, sort, and chips (SPEC.md §9.3).
import { beforeAll, describe, expect, it } from 'vitest';
import { galleryConfig, type GalleryConfig, type LibraryRecord, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { addableFilters, chips, computeView, searchIndex, sortRecords, withoutFilter } from '../../../site/src/lib/gallery/view.ts';
import { fixtureRecords, record, registry } from './helpers.ts';

let reg: Registry;
let fixtures: LibraryRecord[];
let home: GalleryConfig;
let creature: GalleryConfig;
beforeAll(async () => {
  reg = await registry();
  fixtures = await fixtureRecords();
  home = galleryConfig(reg, {});
  creature = galleryConfig(reg, { ruleset: 'dnd-5e-2024', type: 'creature' });
});

const view = (records: LibraryRecord[], config: GalleryConfig, query: string) =>
  computeView(records, config, parseQuery(query, config), searchIndex(records)).results.map((r) => r.name);

describe('finding the example entries', () => {
  it('by name, with prefix and light fuzzy matching', () => {
    expect(view(fixtures, home, '?q=cinder')).toEqual(['Cinder Hound']);
    expect(view(fixtures, home, '?q=cind')).toEqual(['Cinder Hound']);
    expect(view(fixtures, home, '?q=cimder')).toEqual(['Cinder Hound']);
    expect(view(fixtures, home, '?q=frost')).toHaveLength(2);
  });

  it('by tag, as a filter and through search', () => {
    const theme = fixtures.find((r) => r.id === 'cinder-hound')!.tags.theme;
    expect(theme).toBe('fire');
    expect(view(fixtures, home, '?f.tags.theme=fire')).toEqual(['Cinder Hound']);
    expect(view(fixtures, home, '?f.tags.theme=FIRE')).toEqual(['Cinder Hound']);
  });

  it('by facet', () => {
    expect(view(fixtures, creature, '?f.stats.cr=2..2')).toEqual(['Cinder Hound']);
    expect(view(fixtures, creature, '?f.stats.cr=3..')).toEqual([]);
    expect(view(fixtures, home, '?f.stats.rarity=uncommon')).toEqual(['Wand of Frost Lances']);
    expect(view(fixtures, home, '?f.type=spell')).toEqual(['Frost Lance']);
  });

  it('a type gallery shows only its type', () => {
    expect(view(fixtures, creature, '')).toEqual(['Cinder Hound']);
  });
});

describe('filter logic', () => {
  const records = [
    record({ id: 'a', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 5 }, tags: { theme: 'Fire' } }),
    record({ id: 'b', facets: { 'stats.creatureType': 'fiend', 'stats.cr': 1 }, tags: { theme: ['ice', 'Storm'] } }),
    record({ id: 'c', facets: { 'stats.creatureType': 'beast', 'stats.cr': 9 } }),
  ];

  it('ORs values within a filter and ANDs filters', () => {
    expect(view(records, creature, '?f.stats.creatureType=dragon,fiend&sort=name:asc')).toEqual(['a', 'b']);
    expect(view(records, creature, '?f.stats.creatureType=dragon,fiend&f.stats.cr=..3')).toEqual(['b']);
  });

  it('matches string values case-insensitively, inside arrays too, and never matches a missing value', () => {
    expect(view(records, creature, '?f.tags.theme=fire')).toEqual(['a']);
    expect(view(records, creature, '?f.tags.theme=storm')).toEqual(['b']);
    expect(view(records, creature, '?f.tags.theme=fire,ice,storm&sort=name:asc')).toEqual(['a', 'b']);
  });

  it('search narrows within the active filters', () => {
    const named = [record({ id: 'ember-drake', name: 'Ember Drake', facets: { 'stats.cr': 5 } }), record({ id: 'ember-imp', name: 'Ember Imp', facets: { 'stats.cr': 1 } })];
    expect(view(named, creature, '?q=ember&f.stats.cr=4..')).toEqual(['Ember Drake']);
  });

  it('orders by relevance while searching: a name match beats a text match', () => {
    const named = [
      record({ id: 'x', name: 'Glacier Toad', search: 'It spits a frost bolt.' }),
      record({ id: 'y', name: 'Frost Toad', search: 'It hops.' }),
    ];
    expect(view(named, creature, '?q=frost')).toEqual(['Frost Toad', 'Glacier Toad']);
  });
});

describe('sorting', () => {
  it('sorts ordered enums by their declared order, not alphabetically', () => {
    const items = ['legendary', 'common', 'very-rare', 'rare'].map((rarity) =>
      record({ id: rarity, type: 'magic-item', facets: { 'stats.rarity': rarity } }),
    );
    const config = galleryConfig(reg, { ruleset: 'dnd-5e-2024', type: 'magic-item' });
    expect(sortRecords(items, { path: 'stats.rarity', dir: 'asc' }, config).map((r) => r.id)).toEqual(['common', 'rare', 'very-rare', 'legendary']);
    expect(sortRecords(items, { path: 'stats.rarity', dir: 'desc' }, config).map((r) => r.id)).toEqual(['legendary', 'very-rare', 'rare', 'common']);
  });

  it('sorts array facets by their first item (size)', () => {
    const items = [record({ id: 'big', facets: { 'stats.size': ['huge'] } }), record({ id: 'small', facets: { 'stats.size': ['tiny', 'small'] } })];
    expect(sortRecords(items, { path: 'stats.size', dir: 'asc' }, creature).map((r) => r.id)).toEqual(['small', 'big']);
  });

  it('puts entries missing the sort value last in either direction', () => {
    const items = [record({ id: 'none' }), record({ id: 'two', facets: { 'stats.cr': 2 } }), record({ id: 'one', facets: { 'stats.cr': 1 } })];
    expect(sortRecords(items, { path: 'stats.cr', dir: 'asc' }, creature).map((r) => r.id)).toEqual(['one', 'two', 'none']);
    expect(sortRecords(items, { path: 'stats.cr', dir: 'desc' }, creature).map((r) => r.id)).toEqual(['two', 'one', 'none']);
  });

  it('sorts by name and by date added', () => {
    const items = [record({ id: 'b', name: 'beta', createdAt: '2026-03-01' }), record({ id: 'a', name: 'Alpha', createdAt: '2026-05-01' })];
    expect(sortRecords(items, { path: 'name', dir: 'asc' }, creature).map((r) => r.id)).toEqual(['a', 'b']);
    expect(sortRecords(items, { path: 'createdAt', dir: 'desc' }, home).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('chips and Add filter', () => {
  const records = [
    record({ id: 'a', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 5 }, tags: { theme: 'Fire' } }),
    record({ id: 'b', facets: { 'stats.creatureType': 'dragon', 'stats.cr': 1 }, tags: { theme: 'fire', world: 'Greyhawk' } }),
    record({ id: 'c', facets: { 'stats.creatureType': 'beast', 'stats.cr': 1 } }),
  ];

  it('counts each value against the search and every other filter, showing stored case', () => {
    const state = parseQuery('?f.stats.cr=..2&f.stats.creatureType=beast', creature);
    const index = searchIndex(records);
    const def = creature.filters.find((f) => f.path === 'stats.creatureType')!;
    const result = chips(def, records, withoutFilter(records, state, index, def.path), state.filters.get(def.path));
    expect(result).toEqual([
      { key: 'beast', stored: 'beast', count: 1 },
      { key: 'dragon', stored: 'dragon', count: 1 },
    ]);
    const theme = chips({ path: 'tags.theme', label: 'theme', kind: 'enum' }, records, records);
    expect(theme).toEqual([{ key: 'fire', stored: 'Fire', count: 2 }]);
  });

  it('keeps a selected value no record has, so it can be cleared', () => {
    const def = creature.filters.find((f) => f.path === 'stats.creatureType')!;
    expect(chips(def, records, records, { kind: 'enum', values: ['fiend'] }).map((c) => [c.key, c.count])).toContainEqual(['fiend', 0]);
  });

  it('offers facets of the current types and the tag keys in the current results', () => {
    const state = parseQuery('?f.stats.cr=..2', creature);
    const index = searchIndex(records);
    const results = computeView(records, creature, state, index).results;
    const paths = addableFilters(creature, state, records, results).map((d) => d.path);
    expect(paths).toContain('stats.cr');
    expect(paths).not.toContain('stats.abilities.str'); // no record has it
    expect(paths.filter((p) => p.startsWith('tags.'))).toEqual(['tags.theme', 'tags.world']);
    const narrowed = computeView(records, creature, parseQuery('?f.stats.cr=5..', creature), index).results;
    expect(addableFilters(creature, state, records, narrowed).map((d) => d.path)).not.toContain('tags.world');
  });

  it('narrows facets to the chosen types on routes that span types', () => {
    const state = parseQuery('?f.type=spell', home);
    const paths = addableFilters(home, state, fixtures, fixtures).map((d) => d.path);
    expect(paths).toContain('stats.school');
    expect(paths).not.toContain('stats.cr');
  });
});
