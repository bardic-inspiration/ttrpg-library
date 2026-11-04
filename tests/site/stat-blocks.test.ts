// Stat blocks embedded in spells and magic items (SPEC.md §6.6, §6.7, §9.5):
// the authored shape validates, derives only ability modifiers and saves, and
// renders inside the card on every surface. Summon Dragon is the SRD case.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../../scripts/build-index/index.ts';
import { validateLibrary } from '../../scripts/validate/index.ts';
import { PROJECT_ROOT } from '../../scripts/validate/schema.ts';
import EntryDetail from '../../site/src/components/detail/EntryDetail.astro';
import PrintEntry from '../../site/src/components/print/PrintEntry.astro';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refTargets, type Entry } from '../../site/src/lib/library.ts';
import { coreLines } from '../../site/src/lib/stat-block.ts';
import { frostLance, tempLibrary, wandOfFrostLances } from '../helpers.ts';
import { textOf } from './library-fixtures.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const library = async (entries: Record<string, any>[]) => {
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  return lib.content;
};

/** A small authored block: required keys only, plus one action. */
const sprite = () => ({
  name: 'Frost Sprite',
  typeLine: 'Tiny Elemental, Neutral',
  abilities: { str: 3, dex: 16, con: 10, int: 6, wis: 12, cha: 8 },
  actions: [{ name: 'Chill', text: '*Melee Attack Roll:* Bonus equals your spell attack modifier, reach 5 feet.' }],
});

describe('statBlocks schema (SPEC.md §6.6, §6.7)', () => {
  it('accepts an authored block on a spell and on a magic item, and derives only modifiers and saves', async () => {
    const spell = await frostLance();
    spell.stats.statBlocks = [sprite()];
    const wand = await wandOfFrostLances();
    wand.stats.statBlocks = [{ ...sprite(), ac: '12 + the wand’s charges', cr: 'None' }];
    const { errors, entries } = await validateLibrary(await library([spell, wand]));
    expect(errors).toEqual([]);
    const derived = entries.find((e) => e.entry.id === 'frost-lance')!.derived as { statBlocks: { abilityMods: object; saves: object }[] };
    expect(derived.statBlocks[0]!.abilityMods).toEqual({ str: -4, dex: 3, con: 0, int: -2, wis: 1, cha: -1 });
    expect(derived.statBlocks[0]!.saves).toEqual(derived.statBlocks[0]!.abilityMods);
  });

  it.each([
    ['a missing ability score', (b: any) => delete b.abilities.cha, /^stats\.statBlocks\[0\]\.abilities: missing required key "cha"$/],
    ['an empty action list', (b: any) => (b.actions = []), /^stats\.statBlocks\[0\]\.actions: must NOT have fewer than 1 items/],
    ['an empty line', (b: any) => (b.hp = ''), /^stats\.statBlocks\[0\]\.hp: must NOT have fewer than 1 characters/],
    ['an unknown key', (b: any) => (b.xp = '0'), /^stats\.statBlocks\[0\]\.xp: unknown key$/],
    ['an empty initiative line', (b: any) => (b.initiative = ''), /^stats\.statBlocks\[0\]\.initiative: must NOT have fewer than 1 characters/],
    ['a link in its text', (b: any) => (b.actions[0].text = 'See [x](https://example.com).'), /^stats\.statBlocks\[0\]\.actions\[0\]\.text: a link is not allowed/],
  ])('rejects %s', async (_label, breakIt, pattern) => {
    const spell = await frostLance();
    const block = sprite();
    breakIt(block);
    spell.stats.statBlocks = [block];
    const { errors } = await validateLibrary(await library([spell]));
    expect(errors.map((e) => e.message)).toContainEqual(expect.stringMatching(pattern));
  });

  it('prints an Initiative line after AC when the block has one, as written (SPEC.md §6.3)', () => {
    const block = { ...sprite(), ac: '11', initiative: '+1 (11)', hp: '19 (3d10 + 3)' };
    expect(coreLines(block)).toEqual([
      { label: 'AC', value: '11' },
      { label: 'Initiative', value: '+1 (11)' },
      { label: 'HP', value: '19 (3d10 + 3)' },
    ]);
    expect(coreLines({ ...sprite(), ac: '11' }).map((l) => l.label)).toEqual(['AC']);
  });

  it('puts the block names in search text', async () => {
    const spell = await frostLance();
    spell.stats.statBlocks = [sprite()];
    const { records } = await buildIndex(await library([spell]));
    expect(records[0]!.search).toContain('Frost Sprite');
    expect(records[0]!.search).toContain('Chill');
  });
});

describe('Summon Dragon (SPEC.md §5.9, §9.5)', async () => {
  const entry = JSON.parse(await readFile(join(PROJECT_ROOT, 'content/dnd-5e-2024/spell/summon-dragon.json'), 'utf8')) as Entry;
  const all = loadLibrary([entry]);
  const loaded = all[0]!;
  const names = entryNames(all);

  /** The checks every surface must pass: the Draconic Spirit as the SRD prints it. */
  function expectDraconicSpirit(html: string, level: number) {
    const block = html.match(/<section class="embedded-statblock[^"]*" aria-label="Draconic Spirit stat block"[^>]*>([\s\S]*?)<\/section>\s*<\/section>/)?.[1];
    expect(block).toBeDefined();
    expect(block).toMatch(new RegExp(`<h${level}[^>]*>Draconic Spirit</h${level}>`));
    expect(block).toMatch(new RegExp(`<h${level + 1}[^>]*>Actions</h${level + 1}>`));
    const text = textOf(block!);
    for (const line of [
      'Large Dragon, Neutral',
      "AC 14 + the spell's level",
      'HP 50 + 10 for each spell level above 5',
      'Speed 30 ft., Fly 60 ft., Swim 30 ft.',
      'STR 19 +4 +4',
      'INT 10 +0 +0',
      'Resistances Acid, Cold, Fire, Lightning, Poison',
      'Immunities Charmed, Frightened, Poisoned',
      'Senses Blindsight 30 ft., Darkvision 60 ft.; Passive Perception 12',
      'Languages Draconic, understands the languages you know',
      'CR None (XP 0; PB equals your Proficiency Bonus)',
      'Shared Resistances. When you summon the spirit',
      "Rend. Melee Attack Roll: Bonus equals your spell attack modifier, reach 10 feet. Hit: 1d6 + 4 + the spell's level Piercing damage.",
      'Breath Weapon. Dexterity Saving Throw: DC equals your spell save DC',
    ]) {
      expect(text).toContain(line);
    }
  }

  it.each(['screen', 'capture'])('renders the Draconic Spirit on the card in %s mode', async (mode) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryTemplate, { props: { ...loaded, names, mode } });
    expectDraconicSpirit(html, 3);
  });

  it('renders it on the detail page, after the spell text', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryDetail, { props: { loaded, names, targets: refTargets(all) } });
    expectDraconicSpirit(html, 3);
    expect(html.indexOf('uses the Draconic Spirit stat block')).toBeLessThan(html.indexOf('aria-label="Draconic Spirit stat block"'));
  });

  it('renders it in the print view', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PrintEntry, { props: { loaded, names } });
    expectDraconicSpirit(html, 3);
  });
});
