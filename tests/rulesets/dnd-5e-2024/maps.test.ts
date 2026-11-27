// dnd-5e-2024 maps (docs/rulesets.md#maps) and their diagrams (docs/content-model.md#map-diagrams):
// the spec's dungeon and town cases validate, and a broken diagram fails on each of its faults. The
// index gives a map's card its diagram and scale (docs/site.md#gallery "Cards").
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import { checkDiagram } from '../../../scripts/validate/diagram.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import { FIXTURES, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
const jsonIn = async (path: string) => Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f))));

/** The map fixtures and the whole library; the library has no maps of its own to stand in for. */
const loadAll = async () => [...(await jsonIn(MAPS)), ...(await Promise.all((await readdir(CONTENT)).filter((t) => t !== 'map').map((t) => jsonIn(join(CONTENT, t))))).flat()];
let library: ReturnType<typeof loadAll> | undefined;
const all = async () => structuredClone(await (library ??= loadAll()));

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Validating the whole library takes a few seconds; Vitest's 5 s default is too tight. */
const VALIDATION_TIMEOUT = 30_000;

/** Validates the library with the map fixtures and their diagrams, after `change` edits the entries; `skip` leaves diagrams out, and `index` builds its records too. */
async function validate(change: (entries: Record<string, any>[]) => void = () => {}, skip: string[] = [], index = false) {
  const entries = await all();
  change(entries);
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const images = join(lib.repo, 'assets/images/dnd-5e-2024/map');
  await mkdir(images, { recursive: true });
  for (const svg of (await readdir(MAPS)).filter((f) => f.endsWith('.svg') && !skip.includes(f))) await copyFile(join(MAPS, svg), join(images, svg));
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  if (index) return { records: (await buildIndex(lib.content, { assetsRoot: lib.repo })).records, errors: [], mapErrors: [], mapWarnings: [], result };
  const ofMaps = (issues: { file: string; message: string }[]) => issues.filter((i) => i.file.includes('/map/')).map((i) => `${i.file}: ${i.message}`);
  return { errors: result.errors.map((e) => `${e.file}: ${e.message}`), mapErrors: ofMaps(result.errors), mapWarnings: ofMaps(result.warnings), result };
}

const withoutBroken = (entries: Record<string, any>[]) => entries.splice(entries.findIndex((e) => e.id === 'broken-weir'), 1);
const map = (entries: Record<string, any>[], id: string) => entries.find((e) => e.type === 'map' && e.id === id)!;

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the dungeon with a room map within its third zone, and the town', async () => {
    const { errors, mapWarnings, result } = await validate(withoutBroken);
    expect(errors).toEqual([]);
    expect(mapWarnings).toEqual([]);
    // `within` is a zone ref: the child links to its parent's zone, and the parent's back-refs name the child and the zone.
    const parent = result.entries.find((e) => e.entry.type === 'map' && e.entry.id === 'sunken-cistern')!;
    expect(parent.refBy).toEqual([{ path: 'stats.within', key: 'map/drowned-shrine', zone: 'drowned-shrine' }]);
  });

  it("gives a map's record its diagram as a thumbnail and its scale, and no other type a diagram", async () => {
    const { records = [] } = await validate(withoutBroken, [], true);
    const cistern = records.find((r) => r.type === 'map' && r.id === 'sunken-cistern')!;
    expect(cistern.facets).toEqual({ 'stats.scale': 'dungeon' });
    expect(cistern.diagram).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 400 240" class="diagram card__diagram" aria-hidden="true" focusable="false">/);
    expect(cistern.diagram).not.toMatch(/ id=|<title>|<a /);
    expect(records.filter((r) => r.diagram !== null).map((r) => r.id).sort()).toEqual(['drowned-shrine', 'harrowfield', 'sunken-cistern']);
  });

  it('fails the broken diagram on each of its faults', async () => {
    const { mapErrors } = await validate();
    const file = 'content/dnd-5e-2024/map/broken-weir.json: diagram assets/images/dnd-5e-2024/map/broken-weir.svg';
    expect(mapErrors).toEqual(
      expect.arrayContaining([
        `${file}: zone "footbridge" has no element with id="zone-footbridge"`,
        `${file}: id="zone-9" names no zone in stats.zones`,
        `${file}: <image> isn't allowed in a diagram`,
        `${file}: <image> href links outside the file: "https://example.com/weir.png"`,
      ]),
    );
    expect(mapErrors).toHaveLength(4);
  });

  it('fails a map without its diagram', async () => {
    const { mapErrors } = await validate(withoutBroken, ['harrowfield.svg']);
    expect(mapErrors).toEqual(['content/dnd-5e-2024/map/harrowfield.json: diagram assets/images/dnd-5e-2024/map/harrowfield.svg does not exist']);
  });

  it('fails a parent zone the parent lacks, and a parent that is not a map', async () => {
    const missing = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'drowned-shrine').stats.within.zone = 'gatehouse';
    });
    expect(missing.mapErrors).toEqual([
      'content/dnd-5e-2024/map/drowned-shrine.json: stats.within: ref "map/sunken-cistern#gatehouse" does not resolve: map/sunken-cistern has no zone "gatehouse"; name one of its zones (sluice-gate, flooded-hall, drowned-shrine, keepers-cells, overflow)',
    ]);
    const unknown = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'drowned-shrine').stats.within.ref = 'map/nowhere';
    });
    expect(unknown.mapErrors).toEqual([expect.stringMatching(/drowned-shrine\.json: .*map\/nowhere/)]);
    const spell = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'drowned-shrine').stats.within.ref = 'spell/fireball';
    });
    expect(spell.mapErrors).toEqual([expect.stringMatching(/drowned-shrine\.json: stats\.within\.ref/)]);
  });

  it('links a zone token both ways, and fails one naming a zone the map lacks', async () => {
    const linked = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'harrowfield').description = 'Children dare each other down to the {ref:map/sunken-cistern#overflow}.';
    });
    expect(linked.errors).toEqual([]);
    const town = linked.result.entries.find((e) => e.entry.id === 'harrowfield')!;
    expect(town.refs).toEqual([{ path: 'description', key: 'map/sunken-cistern', zone: 'overflow' }]);
    const missing = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'harrowfield').description = 'Down in the {ref:map/sunken-cistern#boiler-room}.';
    });
    expect(missing.mapErrors).toEqual([expect.stringMatching(/harrowfield\.json: description: ref "map\/sunken-cistern#boiler-room" does not resolve: map\/sunken-cistern has no zone "boiler-room"/)]);
  });

  it('fails a map within itself, directly or through others', async () => {
    const direct = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'harrowfield').stats.within = { ref: 'map/harrowfield', zone: 'millside' };
    });
    expect(direct.mapErrors).toEqual(["content/dnd-5e-2024/map/harrowfield.json: stats.within: a map can't be within itself: map/harrowfield › map/harrowfield"]);
    const loop = await validate((entries) => {
      withoutBroken(entries);
      map(entries, 'sunken-cistern').stats.within = { ref: 'map/drowned-shrine', zone: 'pool' };
    });
    expect(loop.mapErrors.sort()).toEqual([
      "content/dnd-5e-2024/map/drowned-shrine.json: stats.within: a map can't be within itself: map/drowned-shrine › map/sunken-cistern › map/drowned-shrine",
      "content/dnd-5e-2024/map/sunken-cistern.json: stats.within: a map can't be within itself: map/sunken-cistern › map/drowned-shrine › map/sunken-cistern",
    ]);
  });
});

describe('checks', () => {
  it('rejects a zone id twice in one map', () => {
    const zones = [
      { id: 'hall', name: 'Hall' },
      { id: 'hall', name: 'Great Hall' },
    ];
    expect(ruleset.check('map', { scale: 'room', zones })).toEqual([{ level: 'error', path: 'stats.zones[1].id', message: expect.stringMatching(/"hall"/) }]);
  });

  it('labels a map’s parent "Within" and its children "Child maps"', () => {
    expect(ruleset.refLabels('map', 'stats.within')).toMatchObject({ forward: 'Within', back: 'Child maps' });
  });
});

describe('checkDiagram', () => {
  const svg = (body: string, root = 'viewBox="0 0 10 10"') => `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`;
  const zone = '<rect id="zone-a" class="zone" x="0" y="0" width="5" height="5"/>';

  it('passes shapes, paths, text, groups, and a title, with the fixed classes', () => {
    const body = `<title>T</title><g class="wall"><path d="M0 0H10"/><line x1="0" y1="0" x2="1" y2="1" class="door"/></g>${zone}<text class="label" x="1" y="1">A &amp; B</text>`;
    expect(checkDiagram(svg(body), ['a'])).toEqual([]);
  });

  it('requires a viewBox on an <svg> root', () => {
    expect(checkDiagram(svg(zone, 'width="10"'), ['a'])).toEqual([expect.stringMatching(/no viewBox/)]);
    expect(checkDiagram(`<g>${zone}</g>`, ['a'])).toEqual([expect.stringMatching(/root element is <g>/)]);
  });

  it('rejects scripts, event handlers, and <foreignObject>', () => {
    expect(checkDiagram(svg(`${zone}<script>alert(1)</script>`), ['a'])).toEqual(["<script> isn't allowed in a diagram"]);
    expect(checkDiagram(svg('<rect id="zone-a" onclick="x()"/>'), ['a'])).toEqual(['<rect> has an event handler, onclick']);
    expect(checkDiagram(svg(`${zone}<foreignObject/>`), ['a'])).toEqual(["<foreignObject> isn't allowed in a diagram"]);
  });

  it('rejects elements outside the allowed set', () => {
    expect(checkDiagram(svg(`${zone}<style>.zone{}</style>`), ['a'])).toEqual([expect.stringMatching(/^<style> isn't allowed; a diagram holds only/)]);
    expect(checkDiagram(svg(`${zone}<use href="#zone-a"/>`), ['a'])).toEqual([expect.stringMatching(/^<use> isn't allowed/)]);
  });

  it('rejects an href or url(…) outside the file, and allows one inside it', () => {
    expect(checkDiagram(svg('<rect id="zone-a" clip-path="url(https://x.test/c.svg#c)"/>'), ['a'])).toEqual(['<rect> clip-path uses url(https://x.test/c.svg#c), outside the file']);
    expect(checkDiagram(svg('<rect id="zone-a" clip-path="url(#c)"/>'), ['a'])).toEqual([]);
    expect(checkDiagram(svg('<g xlink:href="data:x"/>' + zone), ['a'])).toEqual(['<g> xlink:href links outside the file: "data:x"']);
  });

  it('rejects inline style and color attributes', () => {
    expect(checkDiagram(svg('<rect id="zone-a" style="opacity:1" fill="red" stroke="#000"/>'), ['a'])).toEqual([
      '<rect> sets style inline; the site colors a diagram by its classes',
      '<rect> sets fill inline; the site colors a diagram by its classes',
      '<rect> sets stroke inline; the site colors a diagram by its classes',
    ]);
  });

  it('rejects a class outside the fixed set', () => {
    expect(checkDiagram(svg('<rect id="zone-a" class="zone lava"/>'), ['a'])).toEqual(['<rect> has class "lava"; a diagram\'s classes are zone, wall, door, feature, label']);
  });

  it('matches zone elements to zones both ways, one each', () => {
    expect(checkDiagram(svg(zone), ['a', 'b'])).toEqual(['zone "b" has no element with id="zone-b"']);
    expect(checkDiagram(svg(`${zone}<rect id="zone-c"/>`), ['a'])).toEqual(['id="zone-c" names no zone in stats.zones']);
    expect(checkDiagram(svg(`${zone}${zone}`), ['a'])).toEqual(['id "zone-a" is on more than one element']);
  });

  it('rejects a file it cannot read, a doctype, or an unknown entity', () => {
    expect(checkDiagram(`<!DOCTYPE svg [<!ENTITY x "y">]>${svg(zone)}`, ['a'])).toEqual([expect.stringMatching(/^isn't an SVG the validator can read: a doctype/)]);
    expect(checkDiagram(svg(`${zone}<text>&x;</text>`), ['a'])).toEqual([expect.stringMatching(/unknown entity/)]);
    expect(checkDiagram(svg(`${zone}<g>`), ['a'])).toEqual([expect.stringMatching(/never closed|closes nothing/)]);
    expect(checkDiagram(`${svg(zone)}<svg/>`, ['a'])).toEqual([expect.stringMatching(/second root/)]);
    expect(checkDiagram(svg('<rect id="zone-a" hidden/>'), ['a'])).toEqual([expect.stringMatching(/malformed <rect>/)]);
  });
});
