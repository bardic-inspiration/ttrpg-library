// An encounter's page (docs/site.md#templates "encounter-page", docs/site.md#kit-parts): the spec's
// boss fight and bandit attack render each kit part in order by its shared component, each ref as
// its `show` says, on screen and in print.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refPaths, shownKeys, type Entry, type LoadedEntry } from '../../../site/src/lib/library.ts';
import { byDifficulty, coinsText, partHeading, rangeText, refView } from '../../../site/src/lib/kit.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import type { Part } from '../../../rulesets/dnd-5e-2024/types.ts';
import { textOf } from '../../site/library-fixtures.ts';
import { FIXTURES } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const ENCOUNTERS = join(FIXTURES, 'encounter');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const jsonIn = async (path: string) =>
  Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f)) as Promise<Entry>));

const files: Record<string, unknown> = {};
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
const rules = rulesData(definition, files);

/** The encounter fixtures, the good map fixtures, and the library, which has no encounters or maps of its own. */
const encounters = await jsonIn(ENCOUNTERS);
const maps = (await jsonIn(MAPS)).filter((m) => m.id !== 'broken-weir');
const diagrams = new Map(await Promise.all(maps.map(async (m) => [`map/${m.id}`, await readFile(join(MAPS, `${m.id}.svg`), 'utf8')] as const)));
const content = (await Promise.all((await readdir(CONTENT)).filter((t) => t !== 'encounter' && t !== 'map').map((t) => jsonIn(join(CONTENT, t))))).flat();
const library = (extra: Entry[] = []) => {
  const all = loadLibrary([...encounters, ...extra, ...maps, ...content], [rules]);
  return { all, names: entryNames(all, [rules]), paths: refPaths([rules], all) };
};

const { all, names, paths } = library();

const strip = (html: string) => html.replace(/ data-astro-cid-\w+/g, '');
const find = (lib: LoadedEntry[], type: string, id: string) => lib.find(({ entry }) => entry.type === type && entry.id === id)!;
const render = async (loaded: LoadedEntry, mode: 'screen' | 'print' = 'screen', lib = { names, paths }) =>
  strip(await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, ...lib, mode, diagrams } }));
/** The text of one part's section. */
const section = (html: string, part: string) => {
  const start = html.indexOf(`<section class="kit-part" data-part="${part}">`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf('<section class="kit-part"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
};

describe('the boss fight, a fixed roster in a zone of a dungeon map', async () => {
  const court = find(all, 'encounter', 'warren-kings-court');
  const html = await render(court);
  const text = textOf(html);

  it('loads the entries its parts show as cards or thumbnails, not those shown as links', () => {
    expect(shownKeys(court.entry.stats)).toEqual(['map/sunken-cistern', 'creature/goblin-warren-king', 'creature/goblin-hexer']);
    expect(court.shown?.map(({ entry }) => `${entry.type}/${entry.id}`)).toEqual(['map/sunken-cistern', 'creature/goblin-warren-king', 'creature/goblin-hexer']);
  });

  it('renders its parts in order, each under its heading', () => {
    expect([...html.matchAll(/<section class="kit-part" data-part="([a-z-]+)">/g)].map((m) => m[1])).toEqual(['map', 'description', 'roster', 'sequence', 'table']);
    expect(html).toContain('<h3 class="statblock-heading">Map</h3>');
    expect(html).toContain('<h3 class="statblock-heading">Creatures</h3>');
    expect(html).toContain('<h3 class="statblock-heading">Sequence</h3>');
  });

  it('shows the map part as a thumbnail of the diagram with its zone marked, beside the zone linked', () => {
    const map = section(html, 'map');
    expect(map).toContain('class="diagram card__diagram" aria-hidden="true"');
    expect(map.match(/data-target=""/g)).toHaveLength(1);
    expect(map).toMatch(/<rect class="zone"[^>]*data-target=""/);
    expect(map).toContain('<a class="ref-link" href="/dnd-5e-2024/map/sunken-cistern/#zone-drowned-shrine">Sunken Cistern › Drowned Shrine</a>');
    expect(map).not.toContain('id="zone-');
  });

  it('sets the description off as read-aloud text', () => {
    expect(section(html, 'description')).toContain('kit-text kit-text--read-aloud');
  });

  it("lists the roster's lines with their counts, then the cards it shows, once each", () => {
    const roster = section(html, 'roster');
    expect(textOf(roster)).toContain('1 × Goblin Warren-King');
    expect(roster).toContain('1 × <a class="ref-link" href="/dnd-5e-2024/creature/goblin-boss/">Goblin Boss</a>');
    const cards = [...roster.matchAll(/<section class="statblock" data-type="([a-z]+)" data-mode="screen" aria-label="([^"]+)"/g)].map((m) => `${m[1]}: ${m[2]}`);
    expect(cards).toEqual(['creature: Goblin Warren-King stat block', 'creature: Goblin Hexer stat block']);
    // A card's name sits one level below the part's heading.
    expect(roster).toContain('<h4 class="statblock-header__name">Goblin Warren-King</h4>');
  });

  it('runs the structured sequence: the trigger, each stage with its loop and transition, then victory', () => {
    const sequence = textOf(section(html, 'sequence'));
    const order = ['Trigger. The party steps', 'The Audience', 'The king demands tribute', 'Transition. Steel is drawn', 'The Brawl', 'The Flight', 'Victory. The king is caught'];
    const at = order.map((s) => sequence.indexOf(s));
    expect(at.every((i) => i > -1)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    // The last stage leaves out its transition.
    expect(sequence.slice(sequence.indexOf('The Flight'))).not.toContain('Transition.');
  });

  it('renders the table under its title, its refs linked', () => {
    const table = section(html, 'table');
    expect(table).toContain('<caption>The King&#39;s Hoard</caption>');
    expect(table).toContain('href="/dnd-5e-2024/item/potion-of-climbing/"');
    expect(text).toContain('The King');
  });

  it('prints the cards as cards, and keeps the description for the detail page on screen', async () => {
    expect(text).not.toContain('Lore');
    const printed = await render(court, 'print');
    expect(printed).toContain('<section class="statblock" data-type="creature" data-mode="print" aria-label="Goblin Warren-King stat block"');
    expect(printed).toContain('data-type="encounter" data-mode="print"');
  });
});

describe('the bandit attack, a spawn table with a roll', async () => {
  const ambush = find(all, 'encounter', 'bandit-ambush');
  const html = await render(ambush);

  it("tabulates its rows low to high, each with its range on the roll and its creatures' counts", () => {
    const table = section(html, 'spawn-table').split('</table>')[0]!;
    expect([...table.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1])).toEqual(['1d6', 'Difficulty', 'Creatures']);
    const rows = [...table.matchAll(/<tr><td>([^<]*)<\/td><td>([^<]+)<\/td>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(rows).toEqual(['1–2 Low', '3–5 Moderate', '6 High']);
    expect(table).toContain('1d4+1 × <a class="ref-link" href="/dnd-5e-2024/creature/bandit/">Bandit</a>');
  });

  it("shows the captain's card once, after the table", () => {
    const table = section(html, 'spawn-table');
    expect(table.match(/data-type="creature"/g)).toHaveLength(1);
    expect(table.indexOf('aria-label="Bandit Captain stat block"')).toBeGreaterThan(table.indexOf('</table>'));
  });

  it('plays its example sequence as one prose text', () => {
    const sequence = section(html, 'sequence');
    expect(textOf(sequence)).toContain('The lookout whistles');
    expect(sequence).not.toContain('kit-stages');
  });

  it('lists loot by difficulty, with coins and counted items, then its card', () => {
    const loot = section(html, 'loot');
    expect(textOf(loot)).toContain('Low 3d6 SP');
    expect(textOf(loot)).toContain('Moderate 4d6 × 10 SP, Manacles');
    expect(textOf(loot)).toContain('High 4d6 × 10 GP, 2 × Dagger, Potion of Climbing');
    expect(loot).toContain('aria-label="Potion of Climbing magic item"');
  });
});

describe('a map part shown as a card', async () => {
  const court = (await readJson(join(ENCOUNTERS, 'warren-kings-court.json'))) as Entry;
  const stats = court.stats as { parts: Part[] };
  const variant = { ...court, id: 'court-card', stats: { ...stats, parts: stats.parts.map((p) => (p.part === 'map' ? { ...p, map: { ...p.map, show: 'card' } } : p)) } } as Entry;
  const lib = library([variant]);
  const html = await render(find(lib.all, 'encounter', 'court-card'), 'screen', lib);

  it("embeds the map's own card after the zone's line", () => {
    const map = section(html, 'map');
    expect(map).toContain('<section class="statblock" data-type="map" data-mode="screen" aria-label="Sunken Cistern map"');
    expect(map).not.toContain('card__diagram');
  });
});

describe('the kit helpers', () => {
  it('compose lines, ranges, and coins through the wording layer', () => {
    expect(refView({ ref: 'creature/bandit', count: '2d4' }).line).toBe('2d4 × {ref:creature/bandit}');
    expect(refView({ ref: 'item/potion-of-climbing', show: 'card' })).toMatchObject({ line: '{ref:item/potion-of-climbing}', show: 'card' });
    expect(refView({ ref: 'map/sunken-cistern', zone: 'overflow' })).toMatchObject({ key: 'map/sunken-cistern#overflow', entry: 'map/sunken-cistern', show: 'link' });
    expect(rangeText({ min: 1, max: 2 })).toBe('1–2');
    expect(rangeText({ min: 6, max: 6 })).toBe('6');
    expect(coinsText({ dice: '4d6', times: 10, unit: 'gp' })).toBe('4d6 × 10 GP');
    expect(coinsText({ dice: '3d6', unit: 'sp' })).toBe('3d6 SP');
  });

  it('orders keyed rows low to high, and heads parts', () => {
    expect(byDifficulty({ high: 3, low: 1 }).map((r) => r.difficulty)).toEqual(['low', 'high']);
    expect(partHeading({ part: 'prose', text: 'x' })).toBeUndefined();
    expect(partHeading({ part: 'prose', title: 'Aftermath', text: 'x' })).toBe('Aftermath');
    expect(partHeading({ part: 'dm-guide', text: 'x' })).toBe('Running the Encounter');
    expect(partHeading({ part: 'table', title: 'T', text: 'x' })).toBeUndefined();
  });
});
