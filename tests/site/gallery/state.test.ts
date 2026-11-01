// Gallery URL state (SPEC.md §9.3 "URL state").
import { beforeAll, describe, expect, it } from 'vitest';
import { galleryConfig, type GalleryConfig } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery, toQuery } from '../../../site/src/lib/gallery/state.ts';
import { registry } from './helpers.ts';

let creature: GalleryConfig;
let home: GalleryConfig;
beforeAll(async () => {
  const reg = await registry();
  creature = galleryConfig(reg, { ruleset: 'dnd-5e-2024', type: 'creature' });
  home = galleryConfig(reg, {});
});

describe('route defaults', () => {
  it('a type gallery takes its default sort and filters from the registry', () => {
    expect(creature.defaultSort).toEqual({ path: 'stats.cr', dir: 'asc' });
    expect(creature.defaultFilters).toEqual(['stats.cr', 'stats.creatureType', 'tags.theme']);
  });

  it('the home gallery lists the latest additions first, with a type filter', () => {
    expect(home.defaultSort).toEqual({ path: 'createdAt', dir: 'desc' });
    expect(home.defaultFilters).toEqual(['type']);
    expect(home.filters[0]).toMatchObject({ path: 'type', labels: { creature: 'Creature', spell: 'Spell' } });
  });
});

describe('parseQuery and toQuery', () => {
  it('reads the §9.3 example and writes the same view back, filters in registry order', () => {
    const query = '?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8&f.tags.theme=fire';
    const state = parseQuery(query, creature);
    expect(state.q).toBe('frost');
    expect(state.sort).toEqual({ path: 'stats.cr', dir: 'desc' });
    expect(state.filters.get('stats.creatureType')).toEqual({ kind: 'enum', values: ['dragon', 'fiend'] });
    expect(state.filters.get('stats.cr')).toEqual({ kind: 'range', min: 2, max: 8 });
    expect(state.filters.get('tags.theme')).toEqual({ kind: 'enum', values: ['fire'] });
    const written = toQuery(state, creature);
    expect(written).toBe('?q=frost&sort=stats.cr:desc&f.stats.cr=2..8&f.stats.creatureType=dragon,fiend&f.tags.theme=fire');
    expect(parseQuery(written, creature)).toEqual(state);
  });

  it('accepts ranges open on either side, and fractions', () => {
    expect(parseQuery('?f.stats.cr=..4', creature).filters.get('stats.cr')).toEqual({ kind: 'range', max: 4 });
    expect(parseQuery('?f.stats.cr=0.125..', creature).filters.get('stats.cr')).toEqual({ kind: 'range', min: 0.125 });
    expect(parseQuery('?f.stats.cr=1/8..1/2', creature).filters.get('stats.cr')).toEqual({ kind: 'range', min: 0.125, max: 0.5 });
    expect(parseQuery('?f.stats.cr=..', creature).filters.size).toBe(0);
  });

  it('ignores unknown parameters, unknown paths, unknown sorts, and malformed values', () => {
    const state = parseQuery('?utm_source=x&f.stats.nope=1&f.stats.cr=a..b&sort=stats.nope:asc&f.tags.Bad=1&f.stats.cr=3..4..5', creature);
    expect(state.filters.size).toBe(0);
    expect(state.sort).toEqual(creature.defaultSort);
    expect(toQuery(state, creature)).toBe('');
  });

  it('case-folds enum values, so links differing only in case give one view', () => {
    const state = parseQuery('?f.tags.theme=FIRE,Fire', creature);
    expect(state.filters.get('tags.theme')).toEqual({ kind: 'enum', values: ['fire'] });
  });

  it('URL-encodes keys and values, keeping commas inside a value apart from the separator', () => {
    const state = parseQuery('?f.tags.world=Grey%2C%20Hawk,sea%20of%20%C3%A9toiles&q=ice+storm', creature);
    expect(state.filters.get('tags.world')).toEqual({ kind: 'enum', values: ['grey, hawk', 'sea of étoiles'] });
    expect(state.q).toBe('ice storm');
    expect(toQuery(state, creature)).toBe('?q=ice%20storm&f.tags.world=grey%2C%20hawk,sea%20of%20%C3%A9toiles');
  });

  it('writes filters in the route order, tags after facets, and leaves out the default sort', () => {
    const state = parseQuery('?f.tags.theme=fire&f.stats.cr=1..&f.stats.size=medium&sort=stats.cr:asc', creature);
    expect(toQuery(state, creature)).toBe('?f.stats.cr=1..&f.stats.size=medium&f.tags.theme=fire');
  });

  it('offers the type filter only on routes that span types', () => {
    expect(parseQuery('?f.type=spell', home).filters.get('type')).toEqual({ kind: 'enum', values: ['spell'] });
    expect(parseQuery('?f.type=spell', creature).filters.size).toBe(0);
  });
});
