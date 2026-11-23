// Ruleset-generic behavior, run against the original-ruleset fixtures (docs/rulesets.md#fixture-rulesets):
// validation, the index build, the gallery's filters and sorts, and the site's loading and rendering
// take two rulesets that share nothing with dnd-5e-2024 through the same paths.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { placeRules, ruleKey } from '../lib/rules.ts';
import RulesPage from '../site/src/components/rules/RulesPage.astro';
import EntryTemplate from '../site/src/components/templates/EntryTemplate.astro';
import { galleryConfig, type GalleryConfig, type LibraryRecord } from '../site/src/lib/gallery/config.ts';
import { facetData } from '../site/src/lib/gallery/facet-data.ts';
import { parseQuery } from '../site/src/lib/gallery/state.ts';
import { computeView, searchIndex } from '../site/src/lib/gallery/view.ts';
import { entryNames, refPaths } from '../site/src/lib/library.ts';
import { rulesContext } from '../site/src/lib/rules.ts';
import { buildOriginals, originalPhrases, originalsRegistry, originalsSite, RULESETS, validateOriginals } from './originals/fixture.ts';
import { textOf, withoutContents } from './site/library-fixtures.ts';

const BOTH = `f.ruleset=${RULESETS.join(',')}`;

describe('validation', () => {
  it('passes both rulesets, every entry and rules file, with no warnings', async () => {
    const { files, errors, warnings, entries, rules } = await validateOriginals();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(files.length);
    expect(new Set(entries.map((e) => e.entry.ruleset))).toEqual(new Set(RULESETS));
    expect(rules.map((r) => [r.ruleset, r.primitives.length])).toEqual([
      ['starships-and-galaxies', 5],
      ['elementals', 10],
    ]);
  });

  it('places every primitive on exactly one rules page', async () => {
    for (const data of (await validateOriginals()).rules) {
      const { twice, unplaced } = placeRules(data);
      expect(twice).toEqual([]);
      expect(unplaced).toEqual([]);
    }
  });
});

describe('the index build', () => {
  const records = async () => {
    const { errors, records } = await buildOriginals();
    expect(errors).toEqual([]);
    return records;
  };
  const byId = async (id: string) => (await records()).find((r) => r.id === id)!;

  it('writes one record per entry, with its ruleset, source, and author', async () => {
    const all = await records();
    expect(all).toHaveLength((await validateOriginals()).entries.length);
    expect(await byId('wren')).toMatchObject({ ruleset: 'starships-and-galaxies', type: 'ship', source: 'Core Rules', author: 'publisher' });
    expect(await byId('dust-devil')).toMatchObject({ ruleset: 'elementals', type: 'creature', source: null, author: 'bardic-inspiration' });
  });

  it('lifts facets from stats and from derived values, as the registry lists them', async () => {
    expect((await byId('longhaul')).facets).toEqual({ 'stats.size': 'frigate', 'derived.crew': 4, 'derived.hull': 50, 'stats.price': 2800 });
    expect((await byId('steam-wraith')).facets).toMatchObject({ 'derived.element': 'steam', 'derived.totalCost': 2, 'stats.keywords': ['drain'] });
  });

  it('lifts a ref facet as its key, and leaves out a facet whose value is missing', async () => {
    const shard = await byId('shard');
    expect(shard.facets['stats.orbits']).toBe('celestial-body/veil');
    expect(shard.facets).not.toHaveProperty('derived.danger');
  });

  it('carries refs into rules primitives and between entries', async () => {
    expect((await byId('grinder')).refs).toEqual([
      { key: 'celestial-body/pale-sun', path: 'stats.orbits' },
      { key: 'station/helm', path: 'stats.hazards[0].station' },
      { key: 'ship/reaver', path: 'stats.hazards[1].ship' },
    ]);
    expect((await byId('reaver')).refBy.map((l) => l.key)).toEqual(['celestial-body/grinder']);
  });
});

describe('the gallery', () => {
  const setup = async (): Promise<{ config: GalleryConfig; records: LibraryRecord[] }> => {
    const registry = await originalsRegistry();
    const { all, rules, modules } = await originalsSite();
    const publishers = Object.fromEntries([...modules].map(([id, m]) => [id, m.definition.publisher]));
    const data = facetData(registry, all, entryNames(all, rules), rules, publishers);
    return { config: galleryConfig(registry, data, originalPhrases(modules)), records: (await buildOriginals()).records };
  };
  const view = async (query: string) => {
    const { config, records } = await setup();
    return computeView(records, config, parseQuery(query, config), searchIndex(records)).results.map((r) => r.id);
  };

  it('offers each ruleset and its types', async () => {
    const { config } = await setup();
    expect(config.filters.find((f) => f.path === 'ruleset')!.labels).toEqual({ 'starships-and-galaxies': 'Starships & Galaxies', elementals: 'Elementals' });
    expect([...config.types.keys()]).toEqual([
      'starships-and-galaxies/creature',
      'starships-and-galaxies/ship',
      'starships-and-galaxies/item',
      'starships-and-galaxies/celestial-body',
      'elementals/creature',
      'elementals/invocation',
      'elementals/ward',
    ]);
    expect(config.publishers).toEqual({ 'starships-and-galaxies': 'Fixture Press', elementals: 'Fixture Games' });
  });

  it('reads a facet’s values by its ruleset’s vocabulary, and a ref facet’s by target name', async () => {
    const { config } = await setup();
    const facet = (key: string, path: string) => config.types.get(key)!.facets.find((f) => f.path === path)!;
    expect(facet('elementals/creature', 'derived.element').labels).toMatchObject({ steam: 'Steam', mud: 'Mud' });
    expect(facet('starships-and-galaxies/ship', 'stats.size').labels).toMatchObject({ scout: 'Scout' });
    expect(facet('starships-and-galaxies/celestial-body', 'stats.orbits').labels).toMatchObject({ 'celestial-body/pale-sun': 'Pale Sun' });
  });

  it('opens on official content only, and shows homebrew once a ruleset is chosen', async () => {
    expect(await view('?f.type=ward')).toEqual(['bedrock', 'kiln', 'tailwind']);
    expect(await view('?f.ruleset=elementals&f.type=ward')).toEqual(['bedrock', 'hot-spring', 'kiln', 'tailwind']);
  });

  it('filters by an enum facet, a derived range, and a ref facet', async () => {
    expect(await view(`?${BOTH}&f.derived.element=steam`)).toEqual(['hot-spring', 'steam-wraith']);
    expect(await view(`?${BOTH}&f.ruleset=elementals&f.type=creature&f.derived.totalCost=4..`)).toEqual(['magma-wyrm']);
    expect(await view(`?f.ruleset=starships-and-galaxies&f.stats.orbits=celestial-body/pale-sun`)).toEqual(['harrow', 'grinder', 'veil']);
  });

  it('sorts by a derived number and by an ordered enum', async () => {
    expect(await view('?f.ruleset=elementals&f.type=creature&sort=derived.totalCost:desc')).toEqual([
      'magma-wyrm',
      'mud-golem',
      'stone-warden',
      'dust-devil',
      'gale-hawk',
      'steam-wraith',
      'tide-caller',
      'ember-sprite',
    ]);
    expect(await view('?f.ruleset=starships-and-galaxies&f.type=ship&sort=stats.size:asc')).toEqual(['wren', 'longhaul', 'reaver', 'bastion']);
  });
});

describe('the site', () => {
  const render = async (component: any, props: Record<string, unknown>) =>
    (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

  it('links each entry to what it references, entries and primitives alike, and back', async () => {
    const { all } = await originalsSite();
    const loaded = (id: string) => all.find(({ entry }) => entry.id === id)!;
    expect(loaded('veil').refs.map((l) => l.key)).toEqual(['celestial-body/pale-sun', 'station/helm', 'celestial-body/shard']);
    expect(loaded('veil').refBy.map((l) => l.key)).toEqual(['celestial-body/shard']);
    expect(loaded('flash-fire').refs.map((l) => l.key)).toEqual(['element/wind']);
  });

  it('renders every entry with its name, summary, and stats', async () => {
    const { all, rules } = await originalsSite();
    const names = entryNames(all, rules);
    const paths = refPaths(rules, all);
    for (const { entry, derived } of all) {
      const text = textOf(await render(EntryTemplate, { entry, derived, names, paths }));
      expect(text).toContain(entry.name);
      expect(text).toContain(entry.summary);
    }
  });

  it('renders each rules page with every primitive at its anchor', async () => {
    const { all, rules, modules } = await originalsSite();
    for (const data of rules) {
      const ctx = rulesContext(data, all, rules, modules.get(data.ruleset));
      const html = (await Promise.all(data.pages.map((page) => render(RulesPage, { ctx, page })))).join('');
      for (const primitive of data.primitives) {
        expect(html).toContain(`id="${ruleKey(primitive).replace('/', '-')}"`);
        expect(textOf(withoutContents(html))).toContain(primitive.name);
      }
    }
  });
});
