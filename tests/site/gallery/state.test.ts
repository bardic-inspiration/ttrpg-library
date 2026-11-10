// Gallery URL state (docs/site.md#gallery "URL state").
import { beforeAll, describe, expect, it } from 'vitest';
import { galleryConfig, type GalleryConfig } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery, toQuery } from '../../../site/src/lib/gallery/state.ts';
import { registry } from './helpers.ts';

let library: GalleryConfig;
beforeAll(async () => {
  library = galleryConfig(await registry());
});

describe('defaults', () => {
  it('each type keeps its default sort and filters from the registry', () => {
    const creature = library.types.get('dnd-5e-2024/creature')!;
    expect(creature.defaultSort).toEqual({ path: 'stats.cr', dir: 'asc' });
    expect(creature.defaultFilters).toEqual(['stats.cr', 'stats.creatureType', 'tags.theme']);
  });

  it('the Library sorts by name, with a ruleset and a type filter first', () => {
    expect(library.defaultSort).toEqual({ path: 'name', dir: 'asc' });
    expect(library.filters[0]).toMatchObject({ path: 'ruleset', labels: { 'dnd-5e-2024': 'D&D 5e (SRD 5.2)' } });
    expect(library.filters[1]).toMatchObject({ path: 'type', labels: { creature: 'Creature', spell: 'Spell' } });
  });
});

describe('parseQuery and toQuery', () => {
  it('reads the docs/site.md#gallery example and writes the same view back, filters in registry order', () => {
    const query = '?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8&f.tags.theme=fire&f.type=creature';
    const state = parseQuery(query, library);
    expect(state.q).toBe('frost');
    expect(state.sort).toEqual({ path: 'stats.cr', dir: 'desc' });
    expect(state.filters.get('stats.creatureType')).toEqual({ kind: 'enum', values: ['dragon', 'fiend'] });
    expect(state.filters.get('stats.cr')).toEqual({ kind: 'range', min: 2, max: 8 });
    expect(state.filters.get('tags.theme')).toEqual({ kind: 'enum', values: ['fire'] });
    const written = toQuery(state, library);
    expect(written).toBe('?q=frost&sort=stats.cr:desc&f.type=creature&f.stats.cr=2..8&f.stats.creatureType=dragon,fiend&f.tags.theme=fire');
    expect(parseQuery(written, library)).toEqual(state);
  });

  it('accepts ranges open on either side, and fractions', () => {
    expect(parseQuery('?f.stats.cr=..4', library).filters.get('stats.cr')).toEqual({ kind: 'range', max: 4 });
    expect(parseQuery('?f.stats.cr=0.125..', library).filters.get('stats.cr')).toEqual({ kind: 'range', min: 0.125 });
    expect(parseQuery('?f.stats.cr=1/8..1/2', library).filters.get('stats.cr')).toEqual({ kind: 'range', min: 0.125, max: 0.5 });
    expect(parseQuery('?f.stats.cr=..', library).filters.size).toBe(0);
  });

  it('ignores unknown parameters, unknown paths, unknown sorts, and malformed values', () => {
    const state = parseQuery('?utm_source=x&f.stats.nope=1&f.stats.cr=a..b&sort=stats.nope:asc&f.tags.Bad=1&f.stats.cr=3..4..5', library);
    expect(state.filters.size).toBe(0);
    expect(state.sort).toEqual(library.defaultSort);
    expect(toQuery(state, library)).toBe('');
  });

  it('case-folds enum values, so links differing only in case give one view', () => {
    const state = parseQuery('?f.tags.theme=FIRE,Fire', library);
    expect(state.filters.get('tags.theme')).toEqual({ kind: 'enum', values: ['fire'] });
  });

  it('URL-encodes keys and values, keeping commas inside a value apart from the separator', () => {
    const state = parseQuery('?f.tags.world=Grey%2C%20Hawk,sea%20of%20%C3%A9toiles&q=ice+storm', library);
    expect(state.filters.get('tags.world')).toEqual({ kind: 'enum', values: ['grey, hawk', 'sea of étoiles'] });
    expect(state.q).toBe('ice storm');
    expect(toQuery(state, library)).toBe('?q=ice%20storm&f.tags.world=grey%2C%20hawk,sea%20of%20%C3%A9toiles');
  });

  it('writes filters in the Library’s order, tags after facets, and leaves out the default sort', () => {
    const state = parseQuery('?f.tags.theme=fire&f.stats.cr=1..&f.type=creature&f.stats.size=medium&f.ruleset=dnd-5e-2024&sort=name:asc', library);
    expect(toQuery(state, library)).toBe('?f.ruleset=dnd-5e-2024&f.type=creature&f.stats.cr=1..&f.stats.size=medium&f.tags.theme=fire');
  });

  it('reads the ruleset and type filters', () => {
    expect(parseQuery('?f.type=spell', library).filters.get('type')).toEqual({ kind: 'enum', values: ['spell'] });
    expect(parseQuery('?f.ruleset=DND-5e-2024', library).filters.get('ruleset')).toEqual({ kind: 'enum', values: ['dnd-5e-2024'] });
  });
});
