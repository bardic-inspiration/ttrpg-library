// A map's page (docs/site.md#templates "map-page", docs/rulesets.md#maps): the fixtures' dungeon, its
// room map, and the town, each with its diagram inline and its zones linked, the zones in order with
// what points into each, its parent and child maps, and in print the diagram and then the zones.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refPaths, refTargets, type Entry, type LoadedEntry } from '../../../site/src/lib/library.ts';
import { outsideZones } from '../../../site/src/lib/map.ts';
import { groupRefs } from '../../../site/src/lib/refs.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { textOf } from '../../site/library-fixtures.ts';
import { FIXTURES } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) => Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f)) as Promise<Entry>));

const files: Record<string, unknown> = {};
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
const rules = rulesData(definition, files);

/** The fixtures' good maps, and a creature set in the shrine, which the library has no maps for. */
const ids = ['sunken-cistern', 'drowned-shrine', 'harrowfield'];
const maps = await Promise.all(ids.map((id) => readJson(join(MAPS, `${id}.json`)) as Promise<Entry>));
const diagrams = new Map(await Promise.all(ids.map(async (id) => [id, await readFile(join(MAPS, `${id}.svg`), 'utf8')] as const)));
const zombie = (await readJson(join(CONTENT, 'creature/zombie.json'))) as Entry;
const lurker = { ...zombie, id: 'shrine-lurker', name: 'Shrine Lurker', author: 'bardic-inspiration', description: 'It nests in the {ref:map/sunken-cistern#drowned-shrine}.' };
const entries = [...maps, lurker, ...(await Promise.all((await readdir(CONTENT)).map((type) => dir(join(CONTENT, type))))).flat()];
const all = loadLibrary(entries, [rules]);
const names = entryNames(all, [rules]);
const paths = refPaths([rules], all);
const targets = refTargets(all, [rules]);

const strip = (html: string) => html.replace(/ data-astro-cid-\w+/g, '');
const map = (id: string) => all.find(({ entry }) => entry.type === 'map' && entry.id === id)!;
const render = async (loaded: LoadedEntry, mode: 'screen' | 'print' = 'screen') =>
  strip(await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, names, paths, mode, diagram: diagrams.get(loaded.entry.id) } }));

describe('a dungeon map with a room map within its third zone', async () => {
  const cistern = map('sunken-cistern');
  const html = await render(cistern);
  const text = textOf(html);

  it('opens with its scale', () => {
    expect(html).toContain('<p class="statblock-header__subtitle">Dungeon map</p>');
  });

  it('shows the diagram inline, each zone a link named for it to its entry in the zone list', () => {
    expect(html).toContain('class="diagram map-diagram__svg" role="group" aria-label="Sunken Cistern"');
    expect(html.match(/<a class="map-diagram__zone"/g)).toHaveLength(5);
    expect(html).toContain('<a class="map-diagram__zone" href="#zone-drowned-shrine" aria-label="Drowned Shrine"><rect data-zone="drowned-shrine" class="zone"');
    expect(html).toContain('<a class="map-diagram__zone" href="#zone-sluice-gate" aria-label="Sluice Gate"><g data-zone="sluice-gate" class="zone">');
    // The zone list holds the anchors; the diagram keeps none of its own.
    expect(html).not.toMatch(/<(?!li)[a-z]+ [^>]*id="zone-/);
  });

  it('lists the zones in order, each at its anchor with its note', () => {
    expect([...html.matchAll(/<li class="map-zone" id="zone-([a-z-]+)"/g)].map((m) => m[1])).toEqual(['sluice-gate', 'flooded-hall', 'drowned-shrine', 'keepers-cells', 'overflow']);
    expect(text).toContain('Sluice Gate The way in, down a ladder beside the rusted gate.');
  });

  it('lists under the third zone what is set there and the room map that details it', () => {
    const shrine = html.slice(html.indexOf('id="zone-drowned-shrine"'), html.indexOf('id="zone-keepers-cells"'));
    expect(textOf(shrine)).toContain('Child maps: Drowned Shrine');
    expect(shrine).toContain('<a class="ref-link" href="/dnd-5e-2024/map/drowned-shrine/">Drowned Shrine</a>');
    expect(shrine).toContain('<a class="ref-link" href="/dnd-5e-2024/creature/shrine-lurker/">Shrine Lurker</a>');
    expect(textOf(html.slice(html.indexOf('id="zone-sluice-gate"'), html.indexOf('id="zone-flooded-hall"')))).not.toContain(':');
  });

  it('shows no parent, and keeps its description for the detail page on screen', () => {
    expect(html).not.toContain('<dt>Within</dt>');
    expect(text).not.toContain('Description');
  });

  it('prints the diagram, then the zones with their contents, then the description, with no anchors', async () => {
    const printed = await render(cistern, 'print');
    const diagram = printed.indexOf('<figure class="map-diagram"');
    expect(diagram).toBeGreaterThan(-1);
    expect(printed.indexOf('Zones')).toBeGreaterThan(diagram);
    expect(printed.indexOf('Description')).toBeGreaterThan(printed.indexOf('Overflow</h5>'));
    expect(textOf(printed)).toContain('Child maps: Drowned Shrine');
    expect(printed).not.toContain('id="zone-');
  });
});

describe('the room map within it', async () => {
  const html = await render(map('drowned-shrine'));

  it('links its parent zone, "Within", and has a room scale', () => {
    expect(html).toContain('<p class="statblock-header__subtitle">Room map</p>');
    expect(html).toContain('<dt>Within</dt><dd><a class="ref-link" href="/dnd-5e-2024/map/sunken-cistern/#zone-drowned-shrine">Sunken Cistern › Drowned Shrine</a></dd>');
  });
});

describe('a town map with no parent', async () => {
  const html = await render(map('harrowfield'));

  it('lists its districts as zones, each linked from the diagram', () => {
    expect(html).toContain('<p class="statblock-header__subtitle">Zone map</p>');
    expect([...html.matchAll(/<li class="map-zone" id="zone-([a-z-]+)"/g)].map((m) => m[1])).toEqual(['market-ward', 'millside', 'riverbank']);
    expect(html.match(/<a class="map-diagram__zone"/g)).toHaveLength(3);
  });
});

describe("the map's Links", () => {
  it('leave the back-links into a zone to the zone list, and keep its parent', () => {
    const labelFor = (type: string, path: string) => ruleset.refLabels(type, path);
    const cistern = map('sunken-cistern');
    expect(groupRefs('map', cistern.refs, outsideZones(cistern.refBy), targets, labelFor)).toEqual({ forward: [], back: [] });
    const shrine = map('drowned-shrine');
    expect(groupRefs('map', shrine.refs, outsideZones(shrine.refBy), targets, labelFor).forward).toEqual([
      { label: 'Within', targets: [{ type: 'map', name: 'Sunken Cistern › Drowned Shrine', path: 'dnd-5e-2024/map/sunken-cistern/#zone-drowned-shrine', official: false }] },
    ]);
  });
});
