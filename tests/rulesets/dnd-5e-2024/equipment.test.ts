// dnd-5e-2024 equipment (docs/rulesets.md#equipment): the SRD primitives and their pages, weapon and
// mastery properties, base items as links worded as the SRD prints them, custom equipment, and the checks.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { placeRules } from '../../../lib/rules.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import type { EquipmentStats, ItemStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import RulesPage from '../../../site/src/components/rules/RulesPage.astro';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { equipmentLines, numberText, propertiesText, variantsTable } from '../../../site/src/lib/equipment.ts';
import { baseItemSegments, subtitleLine } from '../../../site/src/lib/item.ts';
import { loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { baseLookup, rulesContext, rulesData } from '../../../site/src/lib/rules.ts';
import { FIXTURES, tempLibrary } from '../../helpers.ts';
import { textOf } from '../../site/library-fixtures.ts';

const ROOT = join(import.meta.dirname, '../../..');
const RULES = join(ROOT, 'rulesets/dnd-5e-2024/rules');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const files: Record<string, unknown> = {};
for (const file of (await readdir(RULES, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(RULES, file));
const data = rulesData(definition, files);
const lookup = baseLookup([data]);
const stats = (id: string) => data.primitives.find((p) => p.type === 'equipment' && p.id === id)!.stats as unknown as EquipmentStats;
const item = async (id: string) => (await readJson(join(ROOT, 'content/dnd-5e-2024/item', `${id}.json`))) as Entry;
const render = async (component: any, props: Record<string, unknown>) =>
  (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

describe('the SRD equipment', () => {
  it('is every weapon, armor, tool, piece of gear, mount, and vehicle, with the weapon and mastery properties', () => {
    const count = (type: string, category?: string) =>
      data.primitives.filter((p) => p.type === type && (!category || ruleset.derive(type, p.stats, data).category === category)).length;
    expect(count('equipment', 'weapons')).toBe(38);
    expect(count('equipment', 'armor')).toBe(13);
    expect(count('equipment', 'tools')).toBe(25);
    expect(count('equipment', 'adventuring-gear')).toBe(81);
    expect(count('equipment', 'mounts-and-vehicles')).toBe(23);
    expect(count('weapon-property')).toBe(10);
    expect(count('mastery-property')).toBe(8);
  });

  it('is placed on the Equipment page and one page per category, every primitive and group once', () => {
    expect(data.pages.map((p) => p.id)).toEqual(['conditions', 'equipment', 'weapons', 'armor', 'tools', 'adventuring-gear', 'mounts-and-vehicles']);
    const { pages, twice, unplaced } = placeRules(data);
    expect([twice, unplaced]).toEqual([[], []]);
    expect(pages.get('equipment/medium-armor')).toBe('armor');
    expect(pages.get('equipment/melee-weapons')).toBe('weapons');
    expect(pages.get('weapon-property/finesse')).toBe('weapons');
    expect(pages.get('equipment/saddle')).toBe('mounts-and-vehicles');
  });

  it('derives its category from its group, and its cost in gold pieces', () => {
    expect(ruleset.derive('equipment', stats('longsword'), data)).toEqual({ category: 'weapons', costGp: 15 });
    expect(ruleset.derive('equipment', stats('dart'), data)).toEqual({ category: 'weapons', costGp: 0.05 });
    expect(ruleset.derive('equipment', stats('ammunition'), data)).toEqual({ category: 'adventuring-gear' });
  });
});

describe('equipment lines in SRD 5.2 form', () => {
  it('word weapon properties with their range, ammunition, versatile damage, and notes', () => {
    expect(propertiesText(stats('heavy-crossbow').weapon!)).toBe(
      '{ref:weapon-property/ammunition} (Range 100/400; Bolt), {ref:weapon-property/heavy}, {ref:weapon-property/loading}, {ref:weapon-property/two-handed}',
    );
    expect(propertiesText(stats('spear').weapon!)).toBe('{ref:weapon-property/thrown} (Range 20/60), {ref:weapon-property/versatile} (1d8)');
    expect(propertiesText(stats('lance').weapon!)).toContain('{ref:weapon-property/two-handed} (unless mounted)');
    expect(propertiesText(stats('mace').weapon!)).toBe('—');
  });

  it('print armor, weights as fractions, and Varies for equipment with variants', () => {
    const line = (id: string, label: string) => equipmentLines(stats(id), id === 'shield').find((l) => l.label === label)?.value;
    expect(line('hide-armor', 'Armor Class')).toBe('12 + Dex modifier (max 2)');
    expect(line('plate-armor', 'Armor Class')).toBe('18');
    expect(line('plate-armor', 'Strength')).toBe('Str 15');
    expect(line('plate-armor', 'Cost')).toBe('1,500 GP');
    expect(line('shield', 'Armor Class')).toBe('+2');
    expect(line('dart', 'Weight')).toBe('1/4 lb.');
    expect(line('waterskin', 'Weight')).toBe('5 lb. (full)');
    expect(line('sling', 'Weight')).toBe('—');
    expect(line('holy-symbol', 'Cost')).toBe('Varies');
    expect(line('gaming-set', 'Weight')).toBe('—');
    expect(line('gaming-set', 'Variants')).toBe('Dice (1 SP), dragonchess (1 GP), playing cards (5 SP), three-dragon ante (1 GP)');
    expect(numberText(58.5)).toBe('58½');
    expect(numberText(0.5)).toBe('1/2');
  });

  it('table the variants of gear', () => {
    expect(variantsTable(stats('ammunition'))).toEqual({
      headers: ['Variant', 'Amount', 'Storage', 'Weight', 'Cost'],
      rows: [
        ['Arrows', '20', 'Quiver', '1 lb.', '1 GP'],
        ['Bolts', '20', 'Case', '1½ lb.', '1 GP'],
        ['Bullets, Firearm', '10', 'Pouch', '2 lb.', '3 GP'],
        ['Bullets, Sling', '20', 'Pouch', '1½ lb.', '4 CP'],
        ['Needles', '50', 'Pouch', '1 lb.', '1 GP'],
      ],
    });
  });
});

describe('the equipment pages', async () => {
  const all = loadLibrary([await item('adamantine-armor')], [data]);
  const ctx = rulesContext(data, all, [data]);
  const page = (id: string) => data.pages.find((p) => p.id === id)!;

  it('anchor every item and group of a category, and print armor by AC then cost', async () => {
    const html = await render(RulesPage, { ctx, page: page('armor') });
    for (const p of data.primitives.filter((p) => ['armor'].includes(ruleset.derive(p.type, p.stats, data).category as string))) {
      expect(html).toContain(`id="equipment-${p.id}"`);
    }
    for (const g of ['armor', 'light-armor', 'medium-armor', 'heavy-armor', 'shields']) expect(html).toContain(`id="equipment-${g}"`);
    const order = ['hide-armor', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate-armor'].map((id) => html.indexOf(`id="equipment-${id}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(textOf(html)).toContain('Medium Armor (5 Minutes to Don and 1 Minute to Doff)');
    // Adamantine Armor names Medium and Heavy Armor and excludes Hide Armor.
    expect(html).toMatch(/id="equipment-medium-armor"[\s\S]*Base of[\s\S]*Adamantine Armor/);
  });

  it('show weapon properties and mastery properties, linked from each weapon', async () => {
    const html = await render(RulesPage, { ctx, page: page('weapons') });
    expect(html).toContain('id="weapon-property-finesse"');
    expect(html).toContain('id="mastery-property-vex"');
    expect(html).toMatch(/id="equipment-rapier"[\s\S]*href="\/dnd-5e-2024\/rules\/weapons\/#weapon-property-finesse">Finesse<\/a>/);
    expect(html).toMatch(/id="weapon-property-finesse"[\s\S]*Weapons[\s\S]*Dagger/);
    // Melee Weapons, a union, lists its members as links.
    expect(html).toMatch(/id="equipment-melee-weapons"[\s\S]*#equipment-club">Club<\/a>/);
  });
});

describe('base items (docs/rulesets.md#items)', () => {
  // One item per base item the SRD prints, with the words it prints.
  const SRD: [string, string][] = [
    ['ammunition-1-2-or-3', 'Any Ammunition'],
    ['armor-1-2-or-3', 'Any Light, Medium, or Heavy'],
    ['adamantine-armor', 'Any Medium or Heavy, Except Hide Armor'],
    ['defender', 'Any Melee Weapon'],
    ['dragon-slayer', 'Any Simple or Martial'],
    ['berserker-axe', 'Battleaxe, Greataxe, or Halberd'],
    ['elven-chain', 'Chain Mail or Chain Shirt'],
    ['dagger-of-venom', 'Dagger'],
    ['luck-blade', 'Glaive, Greatsword, Longsword, Rapier, Scimitar, Sickle, or Shortsword'],
    ['frost-brand', 'Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword'],
    ['sword-of-sharpness', 'Glaive, Greatsword, Longsword, or Scimitar'],
    ['dancing-sword', 'Greatsword, Longsword, Rapier, Scimitar, or Shortsword'],
    ['dwarven-plate', 'Half Plate Armor or Plate Armor'],
    ['javelin-of-lightning', 'Javelin'],
    ['oathbow', 'Longbow or Shortbow'],
    ['sun-blade', 'Longsword'],
    ['mace-of-disruption', 'Mace'],
    ['hammer-of-thunderbolts', 'Maul or Warhammer'],
    ['armor-of-invulnerability', 'Plate Armor'],
    ['dragon-scale-mail', 'Scale Mail'],
    ['scimitar-of-speed', 'Scimitar'],
    ['animated-shield', 'Shield'],
    ['glamoured-studded-leather', 'Studded Leather Armor'],
    ['trident-of-fish-command', 'Trident'],
    ['dwarven-thrower', 'Warhammer'],
  ];

  it.each(SRD)('%s reads "%s" word for word', async (id, words) => {
    const s = (await item(id)).stats as ItemStats;
    expect(baseItemSegments(s.baseItem!, lookup).map((p) => p.text).join('')).toBe(words);
  });

  it('links each qualifier and name, and leaves "Any", "or", and "Except" plain (item/adamantine-armor)', async () => {
    const s = (await item('adamantine-armor')).stats as ItemStats;
    expect(baseItemSegments(s.baseItem!, lookup)).toEqual([
      { text: 'Any ' },
      { text: 'Medium', key: 'equipment/medium-armor' },
      { text: ' or ' },
      { text: 'Heavy', key: 'equipment/heavy-armor' },
      { text: ', Except ' },
      { text: 'Hide Armor', key: 'equipment/hide-armor' },
    ]);
    expect(subtitleLine(s, lookup)).toBe('Armor (Any Medium or Heavy, Except Hide Armor), Uncommon');
  });

  it('render as links on the item card (item/dragon-slayer)', async () => {
    const entry = await item('dragon-slayer');
    const [loaded] = loadLibrary([entry], [data]);
    const ctx = rulesContext(data, [loaded!], [data]);
    const html = await render(EntryTemplate, { entry, derived: loaded!.derived, names: ctx.names, paths: ctx.paths });
    expect(textOf(html)).toContain('Weapon (Any Simple or Martial), Rare');
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/rules/weapons/#equipment-simple-weapons">Simple</a>');
  });

  it('check what each list may name', async () => {
    const wand = await readJson(join(FIXTURES, 'library/valid/dnd-5e-2024/item/wand-of-frost-lances.json'));
    const base = (baseItem: unknown, i: number) => ({ ...wand, id: `wand-${'abcde'[i]}`, name: `Wand ${'ABCDE'[i]}`, stats: { ...wand.stats, category: 'weapon', baseItem } });
    const cases = [
      { oneOf: [{ ref: 'equipment/martial-weapons' }] },
      { any: [{ ref: 'equipment/longsword' }] },
      { any: [{ ref: 'equipment/light-armor' }], except: [{ ref: 'equipment/plate-armor' }] },
      { any: [{ ref: 'equipment/light-armor' }], oneOf: [{ ref: 'equipment/dagger' }] },
      { oneOf: [{ ref: 'spell/frost-lance' }] },
    ];
    const { content } = await tempLibrary([await readJson(join(FIXTURES, 'library/valid/dnd-5e-2024/spell/frost-lance.json')), ...cases.map(base)]);
    const messages = (await validateLibrary(content)).errors.map((e) => e.message);
    expect(messages).toContain('stats.baseItem.oneOf[0]: equipment/martial-weapons is a group; name groups under "any"');
    expect(messages).toContain('stats.baseItem.any[0]: equipment/longsword is one item; "any" names groups or items with variants, and "oneOf" names items');
    expect(messages).toContain('stats.baseItem.except[0]: equipment/plate-armor isn\'t in any of the groups "any" names');
    expect(messages).toContain('stats.baseItem: must match exactly one schema in oneOf');
    expect(messages).toContain('stats.baseItem.oneOf[0].ref: must match pattern "^equipment/[a-z0-9]+(-[a-z0-9]+)*$"');
  });
});

describe('custom equipment', () => {
  it('validates as an extension and renders as a card', async () => {
    const net = await readJson(join(FIXTURES, 'equipment/tidewater-net.json'));
    const { content } = await tempLibrary([net]);
    const result = await validateLibrary(content);
    expect(result.errors).toEqual([]);
    expect(result.entries[0]!.derived).toEqual({ category: 'adventuring-gear', costGp: 3 });
    const [loaded] = loadLibrary([net], [data]);
    const ctx = rulesContext(data, [loaded!], [data]);
    const html = await render(EntryTemplate, { entry: net, derived: loaded!.derived, names: ctx.names, paths: ctx.paths });
    expect(textOf(html)).toContain('Tidewater Net Adventuring Gear');
    expect(html).toContain('href="/dnd-5e-2024/rules/conditions/#condition-restrained">Restrained</a>');
    expect(textOf(html)).toContain('Cost 3 GP');
  });
});
