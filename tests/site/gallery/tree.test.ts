// The filter tree (docs/site.md#gallery "Filters"), on the pilot's hard cases (#235): `creature/air-elemental`
// through Creature › Immunities › Conditions, and Equipment › Weapon › Martial › Melee.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { galleryConfig, type FacetData, type GalleryConfig, type LibraryRecord, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { facetData } from '../../../site/src/lib/gallery/facet-data.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { filterTree, openAtStart, type TreeNode, type ValueNode } from '../../../site/src/lib/gallery/tree.ts';
import { computeView, searchIndex } from '../../../site/src/lib/gallery/view.ts';
import { entryNames, loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { loadRules } from '../../../site/src/lib/rules.ts';
import { tempLibrary } from '../../helpers.ts';
import { record, registry, whole } from './helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const rules = loadRules();
let reg: Registry;
let data: FacetData;
let elemental: LibraryRecord[];
let repo: string;

beforeAll(async () => {
  reg = await registry();
  const entry = JSON.parse(await readFile(join(ROOT, 'content/dnd-5e-2024/creature/air-elemental.json'), 'utf8')) as Entry;
  const all = loadLibrary([entry], rules);
  data = facetData(reg, all, entryNames(all, rules), rules);
  const lib = await tempLibrary([entry]);
  repo = lib.repo;
  const built = await buildIndex(lib.content, { assetsRoot: lib.repo });
  expect(built.errors).toEqual([]);
  elemental = built.records;
});
afterAll(() => rm(repo, { recursive: true, force: true }));

const tree = (records: LibraryRecord[], config: GalleryConfig, query = '') => filterTree(config, parseQuery(whole(query), config), records, searchIndex(records));

/** A node's label: a type's, a field's, or a facet's. */
const labelOf = (n: TreeNode) => (n.kind === 'type' ? n.value.label : n.kind === 'field' ? n.label : n.def.label);

/** The node reached by following labels: a type's, a field's, or a facet's. */
function find(nodes: TreeNode[], ...labels: string[]): TreeNode | undefined {
  const [first, ...rest] = labels;
  const node = nodes.find((n) => labelOf(n) === first);
  if (!node || rest.length === 0) return node;
  return node.kind === 'type' || node.kind === 'field' ? find(node.children, ...rest) : undefined;
}

const values = (node: TreeNode | undefined): ValueNode[] => (node?.kind === 'enum' ? node.values : []);

/** Every ruleset's types, from the Types group under each ruleset in the Ruleset node. */
const types = (nodes: TreeNode[]): TreeNode[] =>
  nodes
    .filter((n) => n.id === 'ruleset' && n.kind === 'field')
    .flatMap((n) => (n.kind === 'field' ? n.children : []))
    .flatMap((r) => (r.kind === 'type' ? r.children : []))
    .flatMap((g) => (g.kind === 'field' && g.label === 'Types' ? g.children : []));

/** The node reached by following labels from a type's. */
const ofType = (nodes: TreeNode[], ...labels: string[]) => find(types(nodes), ...labels);

/** Every facet path in a tree. */
const paths = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === 'type' || n.kind === 'field' ? paths(n.children) : [n.def.path]));

describe('creature/air-elemental through Creature › Immunities › Conditions', () => {
  it('lists its condition immunities by name, as a ref facet over condition keys', () => {
    const home = galleryConfig(reg, data);
    const conditions = ofType(tree(elemental, home), 'Creature', 'Immunities', 'Conditions');
    expect(conditions?.kind).toBe('enum');
    expect(values(conditions).map((v) => v.label)).toEqual([
      'Exhaustion', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious',
    ]);
    expect(values(conditions).find((v) => v.label === 'Poisoned')).toMatchObject({ key: 'condition/poisoned', count: 1, selected: false });
    // Damage immunities sit beside them, in the same Immunities node.
    expect(values(ofType(tree(elemental, home), 'Creature', 'Immunities', 'Damage')).map((v) => v.label)).toEqual(['Poison', 'Thunder']);
  });

  it('filters by a condition, in the gallery URL form, and checks the value', () => {
    const creature = galleryConfig(reg, data);
    const query = '?f.stats.immunities.conditions=condition%2Fpoisoned';
    const state = parseQuery(query, creature);
    expect(computeView(elemental, creature, state, searchIndex(elemental)).results.map((r) => r.id)).toEqual(['air-elemental']);
    expect(computeView(elemental, creature, parseQuery('?f.stats.immunities.conditions=condition%2Fblinded', creature), searchIndex(elemental)).results).toEqual([]);
    const node = ofType(tree(elemental, creature, query), 'Creature', 'Immunities', 'Conditions');
    expect(node?.open).toBe(true);
    expect(values(node).find((v) => v.key === 'condition/poisoned')?.selected).toBe(true);
  });

  it('opens a checked type’s default filters, as its old gallery did', () => {
    const library = galleryConfig(reg, data);
    const closed = ofType(tree(elemental, library), 'Creature');
    expect(closed?.kind === 'type' && closed.children.map(labelOf)).toEqual(['CR', 'Size', 'Creature type', 'Abilities', 'AC', 'HP', 'XP', 'Immunities']);
    expect(ofType(tree(elemental, library), 'Creature', 'CR')?.open).toBe(false);
    const nodes = tree(elemental, library, '?f.type=creature');
    expect(ofType(nodes, 'Creature')?.open).toBe(true);
    expect(ofType(nodes, 'Creature', 'CR')?.open).toBe(true);
    expect(ofType(nodes, 'Creature', 'Size')?.open).toBe(false);
    expect(ofType(nodes, 'Creature', 'Abilities', 'STR')?.kind).toBe('range');
  });
});

describe('Equipment › Weapon › Martial › Melee', () => {
  const gear = [
    record({ id: 'longsword-plus', type: 'equipment', facets: { 'stats.group': 'martial-melee-weapons' } }),
    record({ id: 'sling-plus', type: 'equipment', facets: { 'stats.group': 'simple-ranged-weapons' } }),
    record({ id: 'rope-plus', type: 'equipment', facets: { 'stats.group': 'adventuring-gear' } }),
  ];
  let equipment: GalleryConfig;
  beforeAll(() => {
    equipment = galleryConfig(reg, data);
  });

  it('nests a groups facet’s values as the groups file nests them, pruned to groups with members', () => {
    const groups = values(ofType(tree(gear, equipment), 'Equipment', 'Group'));
    expect(groups.map((g) => g.label)).toEqual(['Weapon', 'Adventuring Gear']);
    const weapon = groups[0]!;
    expect(weapon.count).toBe(2);
    expect(weapon.children.map((g) => g.label)).toEqual(['Simple', 'Martial', 'Melee', 'Ranged']);
    const martial = weapon.children.find((g) => g.label === 'Martial')!;
    expect(martial.children.map((g) => [g.label, g.count])).toEqual([['Martial Melee Weapons', 1]]);
  });

  it('matches a group by every leaf group in it, a union by its parts', () => {
    const ids = (query: string) => computeView(gear, equipment, parseQuery(whole(query), equipment), searchIndex(gear)).results.map((r) => r.id).sort();
    expect(ids('?f.stats.group=weapons')).toEqual(['longsword-plus', 'sling-plus']);
    expect(ids('?f.stats.group=martial-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=melee-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=martial-melee-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=martial-weapons,adventuring-gear')).toEqual(['longsword-plus', 'rope-plus']);
  });

  it('opens the groups down to a selected one', () => {
    const groups = values(ofType(tree(gear, equipment, '?f.stats.group=martial-melee-weapons'), 'Equipment', 'Group'));
    const martial = groups[0]!.children.find((g) => g.label === 'Martial')!;
    expect([groups[0]!.open, martial.open, martial.children[0]!.selected]).toEqual([true, true, true]);
  });

  it('lists the nodes that start open, down to the groups, by the ids the island gives them', () => {
    const nodes = tree(gear, equipment, '?f.stats.group=martial-melee-weapons');
    const group = ofType(nodes, 'Equipment', 'Group')!;
    expect([...openAtStart(nodes)].filter((id) => id.startsWith('dnd-5e-2024/equipment'))).toEqual([
      'dnd-5e-2024/equipment',
      group.id,
      `${group.id}-weapons`,
      `${group.id}-weapons-martial-weapons`,
    ]);
    // The Ruleset node, each ruleset, and its Types start open, so every type shows; nothing else
    // does without a filter in it.
    expect(openAtStart(tree(gear, equipment))).toEqual(new Set(['ruleset', 'ruleset/dnd-5e-2024', 'ruleset/dnd-5e-2024:types']));
  });
});

describe('a custom weapon through Equipment › Weapon › Property and Mastery', () => {
  const reefKnife: Entry = {
    ruleset: 'dnd-5e-2024',
    author: 'bardic-inspiration',
    type: 'equipment',
    id: 'reef-knife',
    name: 'Reef Knife',
    summary: 'A short coral-hilted blade for cutting nets underwater.',
    stats: {
      group: 'martial-melee-weapons',
      cost: { amount: 4, unit: 'gp' },
      weight: 1,
      weapon: {
        damage: { dice: '1d4', type: 'slashing' },
        properties: [{ ref: 'weapon-property/finesse' }, { ref: 'weapon-property/light' }],
        mastery: { ref: 'mastery-property/nick' },
      },
    },
    meta: { createdAt: '2026-11-18', source: { kind: 'manual' } },
  } as unknown as Entry;
  let config: GalleryConfig;
  let records: LibraryRecord[];
  let knifeRepo: string;
  beforeAll(async () => {
    const all = loadLibrary([reefKnife], rules);
    config = galleryConfig(reg, facetData(reg, all, entryNames(all, rules), rules));
    const lib = await tempLibrary([reefKnife]);
    knifeRepo = lib.repo;
    const built = await buildIndex(lib.content, { assetsRoot: lib.repo });
    expect(built.errors).toEqual([]);
    records = built.records;
  });
  afterAll(() => rm(knifeRepo, { recursive: true, force: true }));

  it('lists its properties and mastery by name, as ref facets beside its damage type', () => {
    const weapon = ofType(tree(records, config), 'Equipment', 'Weapon');
    expect(weapon?.kind === 'field' && weapon.children.map(labelOf)).toEqual(['Damage type', 'Property', 'Mastery']);
    expect(values(ofType(tree(records, config), 'Equipment', 'Weapon', 'Property')).map((v) => [v.label, v.key])).toEqual([
      ['Finesse', 'weapon-property/finesse'],
      ['Light', 'weapon-property/light'],
    ]);
    expect(values(ofType(tree(records, config), 'Equipment', 'Weapon', 'Mastery')).map((v) => [v.label, v.key])).toEqual([['Nick', 'mastery-property/nick']]);
  });

  it('filters by a property and by a mastery', () => {
    const ids = (query: string) => computeView(records, config, parseQuery(whole(query), config), searchIndex(records)).results.map((r) => r.id);
    expect(ids('?f.stats.weapon.properties=weapon-property%2Ffinesse')).toEqual(['reef-knife']);
    expect(ids('?f.stats.weapon.properties=weapon-property%2Fheavy')).toEqual([]);
    expect(ids('?f.stats.weapon.mastery=mastery-property%2Fnick')).toEqual(['reef-knife']);
    expect(ids('?f.stats.weapon.mastery=mastery-property%2Fsap')).toEqual([]);
  });
});

describe('every facet of every type', () => {
  /** A record of each type with a value for every facet. */
  const full = (): LibraryRecord[] =>
    Object.entries(reg['dnd-5e-2024']!.types).map(([type, config]) =>
      record({
        id: `every-${type}`,
        type,
        facets: Object.fromEntries(
          config.facets.map((f) => [f.path, f.kind === 'range' ? 1 : f.groups ? 'martial-melee-weapons' : f.ref ? 'condition/poisoned' : 'x']),
        ),
        tags: { theme: 'fire' },
      }),
    );

  it('appears in the tree under its type', () => {
    const home = galleryConfig(reg, data);
    const nodes = tree(full(), home);
    for (const [type, config] of Object.entries(reg['dnd-5e-2024']!.types)) {
      const node = types(nodes).find((n) => n.kind === 'type' && n.id === `dnd-5e-2024/${type}`);
      expect(node, type).toBeDefined();
      expect(paths(node?.kind === 'type' ? node.children : []), type).toEqual(config.facets.map((f) => f.path));
    }
    expect(find(nodes, 'Tags', 'Theme')?.kind).toBe('enum');
    // A tag a checked type lists among its default filters starts open too.
    expect(find(nodes, 'Tags', 'Theme')?.open).toBe(false);
    expect(find(tree(full(), home, '?f.type=creature'), 'Tags', 'Theme')?.open).toBe(true);
  });

  it('checks a type as the type filter, counting the entries of each type it shows', () => {
    const home = galleryConfig(reg, data);
    const typeValue = (nodes: TreeNode[], key: string) => {
      const node = types(nodes).find((n) => n.kind === 'type' && n.value.key === key);
      return node?.kind === 'type' ? node.value : undefined;
    };
    expect(typeValue(tree(full(), home), 'dnd-5e-2024/feat')).toMatchObject({ selected: false, count: 1 });
    // Checking Spells hides every other type, so they count 0 before any spell facet is set (#296).
    const nodes = tree(full(), home, '?f.type=spell');
    expect(typeValue(nodes, 'dnd-5e-2024/spell')).toMatchObject({ selected: true, count: 1 });
    expect(typeValue(nodes, 'dnd-5e-2024/feat')).toMatchObject({ selected: false, count: 0 });
    expect(typeValue(nodes, 'dnd-5e-2024/item')).toMatchObject({ selected: false, count: 0 });
  });

  /** Each ruleset under the Ruleset node, as label and count. */
  const rulesets = (nodes: TreeNode[]) =>
    nodes[0]?.kind === 'field' ? nodes[0].children.flatMap((n) => (n.kind === 'type' ? [[n.value.label, n.value.count, n.value.selected]] : [])) : [];

  it('shows the Ruleset node first and open, with each ruleset counted among the other filters’ results', () => {
    const home = galleryConfig(reg, data);
    const nodes = tree(full(), home);
    expect(nodes[0]).toMatchObject({ kind: 'field', id: 'ruleset', label: 'Ruleset', open: true });
    expect(rulesets(nodes)).toEqual([[reg['dnd-5e-2024']!.label, full().length, true]]);
    // Its count is what checking it adds, so a narrower ruleset set leaves it unchanged.
    expect(rulesets(tree(full(), home, '?f.author=publisher'))).toEqual([[reg['dnd-5e-2024']!.label, full().length, false]]);
    const other = { ...reg, other: { ...reg['dnd-5e-2024']!, label: 'Other' } } as Registry;
    const two = [...full(), record({ id: 'stranger', ruleset: 'other' })];
    expect(rulesets(tree(two, galleryConfig(other, data)))).toEqual([
      [reg['dnd-5e-2024']!.label, full().length, true],
      ['Other', 1, false],
    ]);
  });

  it('puts Source and Author under each ruleset, not under Tags, with "publisher" read as its publisher (docs/content-model.md#source-and-author)', () => {
    const home = galleryConfig(reg, { ...data, publishers: { 'dnd-5e-2024': 'Wizards of the Coast' } });
    const records = [
      record({ id: 'fireball', type: 'spell', source: 'SRD 5.2', author: 'publisher' }),
      record({ id: 'frost-lance', type: 'spell', source: 'Ember Codex', author: 'bardic-inspiration' }),
      record({ id: 'cinder-hound', author: 'bardic-inspiration' }),
    ];
    const nodes = tree(records, home);
    const label = 'D&D 5e';
    // An official source is pinned first, though "Ember Codex" sorts before it.
    expect(values(find(nodes, 'Ruleset', label, 'Source and author', 'Source')).map((v) => [v.label, v.count])).toEqual([
      ['SRD 5.2', 1],
      ['Ember Codex', 1],
    ]);
    expect(values(find(nodes, 'Ruleset', label, 'Source and author', 'Author')).map((v) => [v.key, v.label, v.count])).toEqual([
      ['bardic-inspiration', 'bardic-inspiration', 2],
      ['publisher', 'Wizards of the Coast', 1],
    ]);
    expect(find(nodes, 'Tags')).toBeUndefined();
    // An active author filter opens the Ruleset node down to its value, and filters the results.
    const filtered = tree(records, home, '?f.author=publisher');
    expect(filtered[0]?.open).toBe(true);
    expect(find(filtered, 'Ruleset', label)?.open).toBe(true);
    expect(find(filtered, 'Ruleset', label, 'Source and author', 'Author')?.open).toBe(true);
    const view = computeView(records, home, parseQuery('?f.source=srd%205.2', home), searchIndex(records));
    expect(view.results.map((r) => r.id)).toEqual(['fireball']);
  });
});

describe('the ruleset set adds entries (#380)', () => {
  const records = (): LibraryRecord[] => [
    record({ id: 'fireball', type: 'spell', source: 'SRD 5.2', author: 'publisher' }),
    record({ id: 'goblin', source: 'SRD 5.2', author: 'publisher' }),
    record({ id: 'frost-lance', type: 'spell', source: 'Ember Codex', author: 'bardic-inspiration' }),
    record({ id: 'cinder-hound', author: 'bardic-inspiration' }),
    record({ id: 'moss-imp', source: 'Moss Notes', author: 'someone' }),
  ];
  const ids = (config: GalleryConfig, query: string) =>
    computeView(records(), config, parseQuery(query, config), searchIndex(records())).results.map((r) => r.id).sort();

  it('starts on the official content alone, with the publisher checked', () => {
    const home = galleryConfig(reg, { ...data, publishers: { 'dnd-5e-2024': 'Wizards of the Coast' } });
    expect(ids(home, '')).toEqual(['fireball', 'goblin']);
    const nodes = filterTree(home, parseQuery('', home), records(), searchIndex(records()));
    const author = values(find(nodes, 'Ruleset', reg['dnd-5e-2024']!.label, 'Source and author', 'Author'));
    expect(author.map((v) => [v.label, v.selected])).toEqual([
      ['bardic-inspiration', false],
      ['Wizards of the Coast', true],
      ['someone', false],
    ]);
    expect(openAtStart(nodes)).toEqual(new Set(['ruleset', 'ruleset/dnd-5e-2024', 'ruleset/dnd-5e-2024:meta', 'ruleset/dnd-5e-2024:author', 'ruleset/dnd-5e-2024:types']));
  });

  it('keeps each ruleset’s types under it, counted among the results, whether or not the set holds it (#395)', () => {
    const other = { ...reg, other: { ...reg['dnd-5e-2024']!, label: 'Other' } } as Registry;
    const home = galleryConfig(other, data);
    const two = [...records(), record({ id: 'stranger', ruleset: 'other' })];
    const nodes = filterTree(home, parseQuery('', home), two, searchIndex(two));
    const rulesetOf = (label: string) => find(nodes, 'Ruleset', label);
    expect(rulesetOf('Other')?.kind === 'type' && rulesetOf('Other')!.open).toBe(true);
    // Only the publisher is checked, so Other's creature is out of the results but still listed.
    const creature = find(nodes, 'Ruleset', 'Other', 'Types', 'Creature');
    expect(creature?.kind === 'type' && [creature.id, creature.value.count]).toEqual(['other/creature', 0]);
    const own = find(nodes, 'Ruleset', reg['dnd-5e-2024']!.label, 'Types', 'Creature');
    expect(own?.kind === 'type' && [own.id, own.value.count]).toEqual(['dnd-5e-2024/creature', 1]);
    // A checked type of a ruleset with no entries keeps its ruleset in the tree, so it can be cleared.
    const stale = filterTree(home, parseQuery('?f.type=other/spell', home), records(), searchIndex(records()));
    const spell = find(stale, 'Ruleset', 'Other', 'Types', 'Spell');
    expect(spell?.kind === 'type' && [spell.value.selected, spell.value.count]).toEqual([true, 0]);
  });

  it('adds each checked ruleset, source, or author to the results, and the other filters narrow them', () => {
    const home = galleryConfig(reg, data);
    expect(ids(home, '?f.author=publisher&f.source=ember%20codex')).toEqual(['fireball', 'frost-lance', 'goblin']);
    expect(ids(home, '?f.source=moss%20notes&f.author=bardic-inspiration')).toEqual(['cinder-hound', 'frost-lance', 'moss-imp']);
    expect(ids(home, '?f.ruleset=dnd-5e-2024')).toEqual(['cinder-hound', 'fireball', 'frost-lance', 'goblin', 'moss-imp']);
    expect(ids(home, '?f.author=publisher&f.source=ember%20codex&f.type=spell')).toEqual(['fireball', 'frost-lance']);
  });

  it('shows nothing when nothing in the set is checked', () => {
    const home = galleryConfig(reg, data);
    expect(ids(home, '?f.ruleset=')).toEqual([]);
    expect(ids(home, '?f.ruleset=&f.type=spell')).toEqual([]);
  });

  it('counts a source or author by what checking it adds, under the other filters', () => {
    const home = galleryConfig(reg, data);
    const nodes = filterTree(home, parseQuery('?f.type=spell', home), records(), searchIndex(records()));
    expect(values(find(nodes, 'Ruleset', reg['dnd-5e-2024']!.label, 'Source and author', 'Source')).map((v) => [v.label, v.count])).toEqual([
      ['SRD 5.2', 1],
      ['Ember Codex', 1],
      ['Moss Notes', 0],
    ]);
    // A type counts the entries of it in the results: only the official spell by default.
    expect(ofType(nodes, 'Spell')?.kind === 'type' && (ofType(nodes, 'Spell') as { value: ValueNode }).value.count).toBe(1);
  });
});

describe('official sources first in the Source menu (#375)', () => {
  it('pins every official source above the homebrew ones, each part keeping its order', async () => {
    const home = galleryConfig(await registry(), data);
    const records = [
      record({ id: 'a', source: 'Ash Tome', author: 'bardic-inspiration' }),
      record({ id: 'b', source: 'Zephyr Rules', author: 'publisher' }),
      record({ id: 'c', source: 'Basic Rules', author: 'publisher' }),
      record({ id: 'd', source: 'Moss Notes', author: 'someone' }),
    ];
    const source = values(find(tree(records, home), 'Ruleset', 'D&D 5e', 'Source and author', 'Source')).map((v) => v.label);
    expect(source).toEqual(['Basic Rules', 'Zephyr Rules', 'Ash Tome', 'Moss Notes']);
  });
});

describe('a path two types share (#296)', () => {
  const records = (): LibraryRecord[] => [
    record({ id: 'alert', type: 'feat', facets: { 'stats.category': 'origin', 'stats.level': 1 } }),
    record({ id: 'bag', type: 'item', facets: { 'stats.category': 'wondrous' } }),
    record({ id: 'fireball', type: 'spell', facets: { 'stats.level': 3 } }),
  ];

  it('opens and checks a category only under the type whose entries have it', () => {
    const home = galleryConfig(reg, data);
    const nodes = tree(records(), home, '?f.type=feat&f.stats.category=origin');
    expect(ofType(nodes, 'Feat')?.open).toBe(true);
    expect(ofType(nodes, 'Feat', 'Category')?.open).toBe(true);
    expect(values(ofType(nodes, 'Feat', 'Category')).map((v) => [v.key, v.selected])).toEqual([['origin', true]]);
    expect(ofType(nodes, 'Item')?.open).toBe(false);
    expect(ofType(nodes, 'Item', 'Category')?.open).toBe(false);
    expect(values(ofType(nodes, 'Item', 'Category')).map((v) => [v.key, v.selected])).toEqual([['wondrous', false]]);
  });

  it('keeps a selected value no entry has visible under every type, so it can be cleared', () => {
    const home = galleryConfig(reg, data);
    const nodes = tree(records(), home, '?f.stats.category=gone');
    for (const type of ['Feat', 'Item']) expect(values(ofType(nodes, type, 'Category')).find((v) => v.key === 'gone')?.selected, type).toBe(true);
  });

  it('opens a shared range under a checked type only, and under every type when none is checked', () => {
    const home = galleryConfig(reg, data);
    const checked = tree(records(), home, '?f.type=spell&f.stats.level=2..');
    expect(ofType(checked, 'Spell', 'Level')?.open).toBe(true);
    expect(ofType(checked, 'Feat')?.open).toBe(false);
    expect(ofType(checked, 'Feat', 'Prerequisite level')?.open).toBe(false);
    const unchecked = tree(records(), home, '?f.stats.level=2..');
    expect([ofType(unchecked, 'Spell', 'Level')?.open, ofType(unchecked, 'Feat', 'Prerequisite level')?.open]).toEqual([true, true]);
  });
});
