// Gallery URL state (docs/site.md#gallery "URL state").
import { beforeAll, describe, expect, it } from 'vitest';
import { galleryConfig, sortChoices, validSort, type GalleryConfig } from '../../../site/src/lib/gallery/config.ts';
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

  it('the Library sorts by name, with the ruleset, source, author, and type filters first', () => {
    expect(library.defaultSort).toEqual({ path: 'name', dir: 'asc' });
    expect(library.filters[0]).toMatchObject({ path: 'ruleset', labels: { 'dnd-5e-2024': 'D&D 5e (SRD 5.2)' } });
    expect(library.filters[1]).toMatchObject({ path: 'source', label: 'Source', kind: 'enum' });
    expect(library.filters[2]).toMatchObject({ path: 'author', label: 'Author', kind: 'enum' });
    expect(library.filters[3]).toMatchObject({ path: 'type', labels: { creature: 'Creature', spell: 'Spell' } });
    expect(sortChoices(library).map((c) => c.path)).not.toEqual(expect.arrayContaining(['ruleset', 'source', 'author', 'type']));
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
    expect([...parseQuery('?f.stats.cr=..', library).filters.keys()]).toEqual(['author']);
  });

  it('ignores unknown parameters, unknown paths, unknown sorts, and malformed values', () => {
    const state = parseQuery('?utm_source=x&f.stats.nope=1&f.stats.cr=a..b&sort=stats.nope:asc&f.tags.Bad=1&f.stats.cr=3..4..5', library);
    // Only the default ruleset set remains.
    expect([...state.filters.keys()]).toEqual(['author']);
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

describe('the ruleset set in the URL (#380)', () => {
  it('starts on the publisher’s entries, written as no parameter', () => {
    const state = parseQuery('', library);
    expect(state.filters.get('author')).toEqual({ kind: 'enum', values: ['publisher'] });
    expect(toQuery(state, library)).toBe('');
    expect(toQuery(parseQuery('?f.type=spell', library), library)).toBe('?f.type=spell');
    expect(toQuery(parseQuery('?f.author=publisher&f.type=spell', library), library)).toBe('?f.type=spell');
  });

  it('takes the whole set from a query that names any of it, and writes a set other than the default', () => {
    const state = parseQuery('?f.source=srd%205.2', library);
    expect([...state.filters.keys()]).toEqual(['source']);
    expect(toQuery(state, library)).toBe('?f.source=srd%205.2');
    expect(toQuery(parseQuery('?f.author=publisher,bardic-inspiration', library), library)).toBe('?f.author=publisher,bardic-inspiration');
    expect(toQuery(parseQuery('?f.ruleset=dnd-5e-2024', library), library)).toBe('?f.ruleset=dnd-5e-2024');
  });

  it('reads and writes an empty set as f.ruleset with no value', () => {
    const state = parseQuery('?f.ruleset=&f.type=spell', library);
    expect([...state.filters.keys()]).toEqual(['type']);
    expect(toQuery(state, library)).toBe('?f.ruleset=&f.type=spell');
  });
});

describe('sort choices follow the filters', () => {
  const enumFilter = (values: string[]) => ({ kind: 'enum' as const, values });
  const paths = (filters: Map<string, { kind: 'enum'; values: string[] }>) => sortChoices(library, filters).map((c) => c.path);
  const facetsOf = (type: string) => library.types.get(`dnd-5e-2024/${type}`)!.facets.map((f) => f.path);

  it('offers name, date added, and only the checked type’s facets, in registry order', () => {
    expect(paths(new Map([['type', enumFilter(['spell'])]]))).toEqual(['name', 'createdAt', ...facetsOf('spell')]);
    expect(paths(new Map([['type', enumFilter(['spell'])]]))).not.toContain('stats.cr');
  });

  it('offers each checked type’s facets once, in registry order, a shared path as one choice', () => {
    const both = paths(new Map([['type', enumFilter(['spell', 'feat'])]]));
    expect(both).toEqual(['name', 'createdAt', ...new Set([...facetsOf('feat'), ...facetsOf('spell')])]);
    expect(both.filter((p) => p === 'stats.level')).toHaveLength(1);
  });

  it('offers every type’s facets when no type is checked', () => {
    expect(paths(new Map())).toEqual(expect.arrayContaining(['stats.cr', 'stats.school']));
    expect(paths(new Map([['ruleset', enumFilter(['dnd-5e-2024'])]]))).toEqual(paths(new Map()));
  });

  it('offers no facet for a ruleset with no types', () => {
    expect(paths(new Map([['ruleset', enumFilter(['nope'])]]))).toEqual(['name', 'createdAt']);
  });

  it('falls back to the default sort when the filters no longer offer the chosen one', () => {
    const spells = new Map([['type', enumFilter(['spell'])]]);
    expect(validSort(library, { path: 'stats.cr', dir: 'desc' }, spells)).toEqual(library.defaultSort);
    expect(validSort(library, { path: 'stats.level', dir: 'desc' }, spells)).toEqual({ path: 'stats.level', dir: 'desc' });
  });

  it('ignores a sort in the URL the filters don’t offer, wherever the filters come in it', () => {
    expect(parseQuery('?sort=stats.cr:desc&f.type=spell', library).sort).toEqual(library.defaultSort);
    expect(parseQuery('?sort=stats.level:desc&sort=stats.cr:asc&f.type=spell', library).sort).toEqual({ path: 'stats.level', dir: 'desc' });
    expect(toQuery(parseQuery('?sort=stats.cr:desc&f.type=spell', library), library)).toBe('?f.type=spell');
  });
});
