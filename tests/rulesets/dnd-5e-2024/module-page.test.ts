// A module's page (docs/site.md#templates "module-page", docs/site.md#kit-parts): the spec's
// five-room dungeon and the nested module that holds it open with the structured summary, render
// each kit part in order, each ref as its `show` says, and count what they contain through nested
// modules, on screen and in print. Contained entries list their modules under "Part of", and a
// module's card shows its length and levels.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refPaths, shownKeys, type Entry, type LoadedEntry } from '../../../site/src/lib/library.ts';
import { partHeading, refView } from '../../../site/src/lib/kit.ts';
import { levelsText, partIds } from '../../../site/src/lib/module.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { galleryConfig, sortChoices } from '../../../site/src/lib/gallery/config.ts';
import { displayValue } from '../../../site/src/lib/gallery/values.ts';
import { loadRegistry } from '../../../scripts/validate/schema.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { textOf } from '../../site/library-fixtures.ts';
import { FIXTURES } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const MAPS = join(FIXTURES, 'map');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const jsonIn = async (path: string) =>
  Promise.all((await readdir(path)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(join(path, f)) as Promise<Entry>));

const files: Record<string, unknown> = {};
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
const rules = rulesData(definition, files);

/**
 * The module fixtures (with the encounters the five-room dungeon adds), the encounter, character, and
 * good map fixtures they ref, and the library, which has none of those types of its own.
 */
const STOOD_IN = new Set(['module', 'encounter', 'character', 'map']);
const maps = (await jsonIn(MAPS)).filter((m) => m.id !== 'broken-weir');
const diagrams = new Map(await Promise.all(maps.map(async (m) => [`map/${m.id}`, await readFile(join(MAPS, `${m.id}.svg`), 'utf8')] as const)));
const entries = [
  ...(await jsonIn(join(FIXTURES, 'module'))),
  ...(await jsonIn(join(FIXTURES, 'encounter'))),
  ...(await jsonIn(join(FIXTURES, 'character'))),
  ...maps,
  ...(await Promise.all((await readdir(CONTENT)).filter((t) => !STOOD_IN.has(t)).map((t) => jsonIn(join(CONTENT, t))))).flat(),
];
const all = loadLibrary(entries, [rules]);
const names = entryNames(all, [rules]);
const paths = refPaths([rules], all);

const strip = (html: string) => html.replace(/ data-astro-cid-\w+/g, '');
const find = (type: string, id: string) => all.find(({ entry }) => entry.type === type && entry.id === id)!;
const render = async (loaded: LoadedEntry, mode: 'screen' | 'print' = 'screen') =>
  strip(await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, names, paths, mode, diagrams } }));
/** The page's own parts' sections, each kind with its anchor; the cards it embeds have none. */
const ownSections = (html: string) => [...html.matchAll(/<section class="kit-part" data-part="([a-z-]+)" id="([a-z0-9-]+)">/g)].map((m) => `${m[1]} #${m[2]}`);
/** The text of the section at an anchor. */
const section = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}">`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf(' id="section-', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
};

describe('the five-room dungeon, a small module of five encounters on one map', async () => {
  const delve = find('module', 'sunken-cistern-delve');
  const html = await render(delve);
  const text = textOf(html);

  it('derives the encounters and maps it contains, and lists its contents in story order', () => {
    expect(delve.derived).toEqual({
      encounters: 5,
      maps: 1,
      contents: ['sluice-gate-watch', 'flooded-hall-crossing', 'keepers-cells-rats', 'warren-kings-court', 'overflow-escape'].map((id) => ({ ref: `encounter/${id}` })),
    });
  });

  it('opens with its length, levels, and counts', () => {
    const lines = [...html.split('<nav')[0]!.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(lines).toEqual(['Length Delve', 'Levels 2–3', 'Encounters 5', 'Maps 1']);
  });

  it('opens with the structured summary: its labeled parts in order, each linked to its section', () => {
    const nav = html.slice(html.indexOf('<nav class="toc"'), html.indexOf('</nav>'));
    expect([...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`)).toEqual([
      'Background #section-background',
      'Map #section-map',
      'Sluice Gate Watch #section-sluice-gate-watch',
      'Flooded Hall Crossing #section-flooded-hall-crossing',
      'The Keeper&#39;s Cells #section-the-keeper-s-cells',
      'The Warren King&#39;s Court #section-the-warren-king-s-court',
      'The Overflow #section-the-overflow',
    ]);
  });

  it('renders its parts in order, a contained encounter shown as a link headed by its name linked', () => {
    expect(ownSections(html)).toEqual([
      'prose #section-background',
      'map #section-map',
      'arrangement #section-sluice-gate-watch',
      'arrangement #section-flooded-hall-crossing',
      'arrangement #section-the-keeper-s-cells',
      'arrangement #section-the-warren-king-s-court',
      'arrangement #section-the-overflow',
    ]);
    expect(section(html, 'section-sluice-gate-watch')).toContain('<h3 class="statblock-heading"><span><a class="ref-link" href="/dnd-5e-2024/encounter/sluice-gate-watch/">Sluice Gate Watch</a></span></h3>');
  });

  it("embeds a contained encounter shown as a card, its name at the part's level, with its own parts", () => {
    const court = names.get('encounter/warren-kings-court')!;
    expect(html).toContain(`<section class="statblock" data-type="encounter" data-mode="screen" aria-label="${court}"`);
    expect(html).toContain(`<h3 class="statblock-header__name">${court.replace(/'/g, '&#39;')}</h3>`);
    // The encounter's map thumbnail comes with it.
    expect(html.slice(html.indexOf('data-type="encounter"'))).toContain('card__diagram');
  });

  it('shows its map part as a thumbnail beside the map linked', () => {
    expect(section(html, 'section-map')).toContain('kit-thumbnail--map');
    expect(text).toContain('Sunken Cistern');
  });
});

describe('the nested module, with the five-room dungeon as a chapter', async () => {
  const mill = find('module', 'the-stilled-mill');
  const html = await render(mill);
  const delve = names.get('module/sunken-cistern-delve')!;

  it('counts the encounters and maps it contains through the nested module, each once', () => {
    expect(mill.derived).toMatchObject({ encounters: 6, maps: 2 });
    expect(mill.derived.contents).toEqual([
      { ref: 'encounter/bandit-ambush' },
      { ref: 'module/sunken-cistern-delve', contains: (find('module', 'sunken-cistern-delve').derived.contents as unknown[]) },
    ]);
  });

  it('loads the entries its parts show as cards or thumbnails', () => {
    expect(shownKeys(mill.entry.stats)).toEqual(['character/brannoc-ashguard', 'character/sister-maelis', 'map/harrowfield', 'module/sunken-cistern-delve']);
  });

  it("lists the nested module's arrangements under it in the summary, each linked to its page", () => {
    const nav = html.slice(html.indexOf('<nav class="toc"'), html.indexOf('</nav>'));
    expect(textOf(nav).trim()).toBe(
      "Contents Description Hook Hook Map Town Rumors Bandit Ambush The Sunken Cistern Delve: Sluice Gate Watch, Flooded Hall Crossing, The Keeper's Cells, The Warren King's Court, The Overflow Running the Module",
    );
    expect(nav).toContain('<a href="#section-hook-2">Hook</a>');
    expect(nav).toContain(`<a href="#section-the-sunken-cistern-delve">${delve}</a>`);
    expect(nav).toContain('<a href="/dnd-5e-2024/encounter/sluice-gate-watch/">Sluice Gate Watch</a>');
  });

  it("lists a hook's refs with their notes, then its cards", () => {
    const hook = section(html, 'section-hook');
    expect(textOf(hook)).toContain("Guard Captain (the party's contact)");
    expect(hook).toContain('<a class="ref-link" href="/dnd-5e-2024/creature/guard-captain/">Guard Captain</a>');
    expect([...hook.matchAll(/data-type="character" data-mode="screen" aria-label="([^"]+)"/g)].map((m) => m[1])).toHaveLength(2);
    expect(section(html, 'section-hook-2')).not.toContain('kit-list');
  });

  it('heads its DM guide for a module, and its table by its caption', () => {
    expect(html).toContain('<h3 class="statblock-heading">Running the Module</h3>');
    expect(section(html, 'section-town-rumors')).toContain('<caption>Town Rumors</caption>');
  });

  it('embeds the nested module as a card, without a summary or anchors of its own', () => {
    const card = section(html, 'section-the-sunken-cistern-delve');
    expect(card).toContain(`data-type="module" data-mode="screen" aria-label="${delve}"`);
    expect(card).toContain(`<h3 class="statblock-header__name">${delve}</h3>`);
    expect(card).not.toContain('<nav');
    expect(card).not.toContain(' id="section-');
    // Its own parts sit below its name, and its encounters' cards below those.
    expect(card).toContain('<a class="ref-link" href="/dnd-5e-2024/encounter/sluice-gate-watch/">Sluice Gate Watch</a></span></h4>');
    expect(html.match(/<nav class="toc"/g)).toHaveLength(1);
  });

  it('prints what it embeds, with no summary or anchors', async () => {
    const printed = await render(mill, 'print');
    expect(printed).not.toContain('<nav');
    expect(printed).not.toContain(' id="section-');
    expect(printed).toContain('data-type="module" data-mode="print"');
    expect(printed).toContain('data-type="character" data-mode="print"');
    expect(printed).toContain('data-type="encounter" data-mode="print"');
  });
});

describe('containment on the contained entries', () => {
  it('lists the modules that contain an entry under "Part of"', () => {
    const partOf = (type: string, id: string) => find(type, id).refBy.filter((l) => l.key.startsWith('module/')).map((l) => l.key);
    expect(partOf('module', 'sunken-cistern-delve')).toEqual(['module/the-stilled-mill']);
    expect(partOf('encounter', 'sluice-gate-watch')).toEqual(['module/sunken-cistern-delve']);
  });
});

describe("a module's card", async () => {
  const config = galleryConfig(await loadRegistry());
  const info = config.types.get('dnd-5e-2024/module')!;

  it('shows its length and levels, and offers no filter or sort for them', () => {
    expect(info.cardFields.map((f) => f.path)).toEqual(['stats.length', 'stats.levels']);
    expect(displayValue(info.cardFields[0]!, 'multi-session')).toBe('Multi-session');
    expect(displayValue(info.cardFields[1]!, { min: 2, max: 4 })).toBe('2–4');
    expect(info.facets).toEqual([]);
    expect(config.filters.map((f) => f.path)).not.toContain('stats.length');
    expect(sortChoices(config).map((c) => c.path)).not.toContain('stats.levels');
  });
});

describe('the module helpers', () => {
  it('compose levels, notes, and headings, and number repeated anchors', () => {
    expect(levelsText({ min: 2, max: 4 })).toBe('2–4');
    expect(levelsText({ min: 3, max: 3 })).toBe('3');
    expect(refView({ ref: 'creature/guard-captain', note: "the party's contact" }).line).toBe("{ref:creature/guard-captain} (the party's contact)");
    expect(partHeading({ part: 'dm-guide', text: 'x' }, 'module')).toBe('Running the Module');
    expect(partHeading({ part: 'hook', text: 'x' })).toBe('Hook');
    expect(partHeading({ part: 'arrangement', arrangement: { ref: 'encounter/x' } })).toBeUndefined();
    expect(partIds(['Hook', undefined, 'Hook', 'Map'])).toEqual(['section-hook', undefined, 'section-hook-2', 'section-map']);
  });
});
