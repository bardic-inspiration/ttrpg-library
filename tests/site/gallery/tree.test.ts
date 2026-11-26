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
import { rulesetRegistry } from '../../../site/src/lib/gallery/library-url.ts';
import { computeView } from '../../../site/src/lib/gallery/view.ts';
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

const tree = (records: LibraryRecord[], config: GalleryConfig, query = '') => filterTree(config, parseQuery(whole(query), config), records);

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

/** The types, from the Types node. */
const types = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((n) => (n.kind === 'field' && n.id === 'types' ? n.children : []));

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
    expect(computeView(elemental, creature, state).results.map((r) => r.id)).toEqual(['air-elemental']);
    expect(computeView(elemental, creature, parseQuery('?f.stats.immunities.conditions=condition%2Fblinded', creature)).results).toEqual([]);
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
    const ids = (query: string) => computeView(gear, equipment, parseQuery(whole(query), equipment)).results.map((r) => r.id).sort();
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
    // Sources and Types start open, so Official and every type show; nothing else does without a
    // filter in it.
    expect(openAtStart(tree(gear, equipment))).toEqual(new Set(['sources', 'types']));
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
    // The SRD weapons' cards sit beside it, so their properties and masteries are listed too.
    const property = values(ofType(tree(records, config), 'Equipment', 'Weapon', 'Property')).map((v) => [v.label, v.key]);
    expect(property).toContainEqual(['Finesse', 'weapon-property/finesse']);
    expect(property).toContainEqual(['Light', 'weapon-property/light']);
    expect(values(ofType(tree(records, config), 'Equipment', 'Weapon', 'Mastery')).map((v) => [v.label, v.key])).toContainEqual(['Nick', 'mastery-property/nick']);
  });

  it('filters by a property and by a mastery, beside the SRD weapons', () => {
    const ids = (query: string) => computeView(records, config, parseQuery(whole(query), config)).results.map((r) => r.id);
    expect(ids('?f.stats.weapon.properties=weapon-property%2Ffinesse')).toEqual(expect.arrayContaining(['reef-knife', 'dagger', 'rapier']));
    expect(ids('?f.stats.weapon.properties=weapon-property%2Fheavy')).not.toContain('reef-knife');
    expect(ids('?f.stats.weapon.properties=weapon-property%2Fheavy')).toContain('greatsword');
    expect(ids('?f.stats.weapon.mastery=mastery-property%2Fnick')).toContain('reef-knife');
    expect(ids('?f.stats.weapon.mastery=mastery-property%2Fsap')).not.toContain('reef-knife');
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
    // Sources and Types are the only top-level nodes, and an old tag filter adds none.
    expect(nodes.map((n) => n.id)).toEqual(['sources', 'types']);
    expect(tree(full(), home, '?f.type=creature&f.tags.theme=fire').map((n) => n.id)).toEqual(['sources', 'types']);
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

  it('has no Ruleset node: a Library offers only its own ruleset, and nothing groups by ruleset', () => {
    const other = { ...reg, other: { ...reg['dnd-5e-2024']!, label: 'Other' } } as Registry;
    const two = [...full(), record({ id: 'stranger', ruleset: 'other' })];
    const own = galleryConfig(rulesetRegistry(other, 'dnd-5e-2024'), data);
    const nodes = tree(two.filter((r) => r.ruleset === 'dnd-5e-2024'), own);
    expect(nodes.map(labelOf)).toEqual(['Sources', 'Types']);
    expect(types(nodes).every((n) => n.id.startsWith('dnd-5e-2024/'))).toBe(true);
    expect(rulesetRegistry(other, 'other')).toEqual({ other: other.other });
    // An unregistered ruleset leaves the whole registry, as the style guide's gallery has it.
    expect(rulesetRegistry(other, undefined)).toBe(other);
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
    computeView(records(), config, parseQuery(query, config)).results.map((r) => r.id).sort();

  it('starts on the official content alone, with Official checked', () => {
    const home = galleryConfig(reg, data);
    expect(ids(home, '')).toEqual(['fireball', 'goblin']);
    const nodes = filterTree(home, parseQuery('', home), records());
    expect(nodes[0]).toMatchObject({ kind: 'field', id: 'sources', label: 'Sources', open: true });
    const official = find(nodes, 'Sources', 'Official');
    expect(official?.kind === 'type' && [official.path, official.value.key, official.value.selected, official.value.count, official.children]).toEqual([
      'author', 'publisher', true, 2, [],
    ]);
    expect(openAtStart(nodes)).toEqual(new Set(['sources', 'types']));
  });

  it('puts the homebrew sources and authors under Homebrew, without the official ones', () => {
    const home = galleryConfig(reg, { ...data, publishers: { 'dnd-5e-2024': 'Wizards of the Coast' } });
    const nodes = filterTree(home, parseQuery('', home), records());
    expect(find(nodes, 'Sources')?.kind === 'field' && (find(nodes, 'Sources') as { children: TreeNode[] }).children.map(labelOf)).toEqual(['Official', 'Homebrew']);
    expect(values(find(nodes, 'Sources', 'Homebrew', 'Source')).map((v) => [v.label, v.count, v.selected])).toEqual([
      ['Ember Codex', 1, false],
      ['Moss Notes', 1, false],
    ]);
    expect(values(find(nodes, 'Sources', 'Homebrew', 'Author')).map((v) => [v.key, v.count, v.selected])).toEqual([
      ['bardic-inspiration', 2, false],
      ['someone', 1, false],
    ]);
    // Homebrew is a group, not a checkbox, and starts closed until a filter in it is active.
    expect(find(nodes, 'Sources', 'Homebrew')).toMatchObject({ kind: 'field', open: false });
    const checked = filterTree(home, parseQuery('?f.author=publisher,someone', home), records());
    expect(find(checked, 'Sources', 'Homebrew')?.open).toBe(true);
    expect(find(checked, 'Sources', 'Homebrew', 'Author')?.open).toBe(true);
    expect(find(checked, 'Sources', 'Official')?.kind === 'type' && (find(checked, 'Sources', 'Official') as { value: ValueNode }).value.selected).toBe(true);
    expect(ids(home, '?f.author=publisher,someone')).toEqual(['fireball', 'goblin', 'moss-imp']);
  });

  it('reads each box checked only when its filter holds it', () => {
    const home = galleryConfig(reg, data);
    // The whole ruleset shows every entry, but no box in Sources holds it, so none reads checked.
    const nodes = filterTree(home, parseQuery('?f.ruleset=dnd-5e-2024', home), records());
    const official = find(nodes, 'Sources', 'Official');
    expect(official?.kind === 'type' && official.value.selected).toBe(false);
    expect(values(find(nodes, 'Sources', 'Homebrew', 'Source')).some((v) => v.selected)).toBe(false);
    // With no type checked, no type reads checked, though each has results.
    expect(types(nodes).some((n) => n.kind === 'type' && n.value.selected)).toBe(false);
  });

  it('has no homebrew group when every entry is official', () => {
    const home = galleryConfig(reg, data);
    const official = records().filter((r) => r.author === 'publisher');
    const nodes = filterTree(home, parseQuery('', home), official);
    expect((find(nodes, 'Sources') as { children: TreeNode[] }).children.map(labelOf)).toEqual(['Official']);
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

  it('counts Official, a source, or an author by what checking it adds, under the other filters', () => {
    const home = galleryConfig(reg, data);
    const nodes = filterTree(home, parseQuery('?f.type=spell', home), records());
    const official = find(nodes, 'Sources', 'Official');
    expect(official?.kind === 'type' && official.value.count).toBe(1);
    expect(values(find(nodes, 'Sources', 'Homebrew', 'Source')).map((v) => [v.label, v.count])).toEqual([
      ['Ember Codex', 1],
      ['Moss Notes', 0],
    ]);
    // A type counts the entries of it in the results: only the official spell by default.
    expect(ofType(nodes, 'Spell')?.kind === 'type' && (ofType(nodes, 'Spell') as { value: ValueNode }).value.count).toBe(1);
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
