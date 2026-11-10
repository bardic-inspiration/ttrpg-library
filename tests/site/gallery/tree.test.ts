// The filter tree (docs/site.md#gallery "Filters"), on spec/v2/ui.md's cases: `creature/air-elemental`
// through Creature › Immunities › Conditions, and Equipment › Weapon › Martial › Melee.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { galleryConfig, type FacetData, type GalleryConfig, type LibraryRecord, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { facetData } from '../../../site/src/lib/gallery/facet-data.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { filterTree, type TreeNode, type ValueNode } from '../../../site/src/lib/gallery/tree.ts';
import { computeView, searchIndex } from '../../../site/src/lib/gallery/view.ts';
import { entryNames, loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { loadRules } from '../../../site/src/lib/rules.ts';
import { tempLibrary } from '../../helpers.ts';
import { record, registry } from './helpers.ts';

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

const tree = (records: LibraryRecord[], config: GalleryConfig, query = '') => filterTree(config, parseQuery(query, config), records, searchIndex(records));

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

/** Every facet path in a tree. */
const paths = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === 'type' || n.kind === 'field' ? paths(n.children) : [n.def.path]));

describe('creature/air-elemental through Creature › Immunities › Conditions', () => {
  it('lists its condition immunities by name, as a ref facet over condition keys', () => {
    const home = galleryConfig(reg, data);
    const conditions = find(tree(elemental, home), 'Creature', 'Immunities', 'Conditions');
    expect(conditions?.kind).toBe('enum');
    expect(values(conditions).map((v) => v.label)).toEqual([
      'Exhaustion', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious',
    ]);
    expect(values(conditions).find((v) => v.label === 'Poisoned')).toMatchObject({ key: 'condition/poisoned', count: 1, selected: false });
    // Damage immunities sit beside them, in the same Immunities node.
    expect(values(find(tree(elemental, home), 'Creature', 'Immunities', 'Damage')).map((v) => v.label)).toEqual(['Poison', 'Thunder']);
  });

  it('filters by a condition, in the v1 URL form, and checks the value', () => {
    const creature = galleryConfig(reg, data);
    const query = '?f.stats.immunities.conditions=condition%2Fpoisoned';
    const state = parseQuery(query, creature);
    expect(computeView(elemental, creature, state, searchIndex(elemental)).results.map((r) => r.id)).toEqual(['air-elemental']);
    expect(computeView(elemental, creature, parseQuery('?f.stats.immunities.conditions=condition%2Fblinded', creature), searchIndex(elemental)).results).toEqual([]);
    const node = find(tree(elemental, creature, query), 'Creature', 'Immunities', 'Conditions');
    expect(node?.open).toBe(true);
    expect(values(node).find((v) => v.key === 'condition/poisoned')?.selected).toBe(true);
  });

  it('opens a checked type’s default filters, as its old gallery did', () => {
    const library = galleryConfig(reg, data);
    const closed = find(tree(elemental, library), 'Creature');
    expect(closed?.kind === 'type' && closed.children.map(labelOf)).toEqual(['CR', 'Size', 'Creature type', 'Abilities', 'AC', 'HP', 'XP', 'Immunities']);
    expect(find(tree(elemental, library), 'Creature', 'CR')?.open).toBe(false);
    const nodes = tree(elemental, library, '?f.type=creature');
    expect(find(nodes, 'Creature')?.open).toBe(true);
    expect(find(nodes, 'Creature', 'CR')?.open).toBe(true);
    expect(find(nodes, 'Creature', 'Size')?.open).toBe(false);
    expect(find(nodes, 'Creature', 'Abilities', 'STR')?.kind).toBe('range');
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
    const groups = values(find(tree(gear, equipment), 'Equipment', 'Group'));
    expect(groups.map((g) => g.label)).toEqual(['Weapon', 'Adventuring Gear']);
    const weapon = groups[0]!;
    expect(weapon.count).toBe(2);
    expect(weapon.children.map((g) => g.label)).toEqual(['Simple', 'Martial', 'Melee', 'Ranged']);
    const martial = weapon.children.find((g) => g.label === 'Martial')!;
    expect(martial.children.map((g) => [g.label, g.count])).toEqual([['Martial Melee Weapons', 1]]);
  });

  it('matches a group by every leaf group in it, a union by its parts', () => {
    const ids = (query: string) => computeView(gear, equipment, parseQuery(query, equipment), searchIndex(gear)).results.map((r) => r.id).sort();
    expect(ids('?f.stats.group=weapons')).toEqual(['longsword-plus', 'sling-plus']);
    expect(ids('?f.stats.group=martial-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=melee-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=martial-melee-weapons')).toEqual(['longsword-plus']);
    expect(ids('?f.stats.group=martial-weapons,adventuring-gear')).toEqual(['longsword-plus', 'rope-plus']);
  });

  it('opens the groups down to a selected one', () => {
    const groups = values(find(tree(gear, equipment, '?f.stats.group=martial-melee-weapons'), 'Equipment', 'Group'));
    const martial = groups[0]!.children.find((g) => g.label === 'Martial')!;
    expect([groups[0]!.open, martial.open, martial.children[0]!.selected]).toEqual([true, true, true]);
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
      const node = nodes.find((n) => n.kind === 'type' && n.id === `dnd-5e-2024/${type}`);
      expect(node, type).toBeDefined();
      expect(paths(node?.kind === 'type' ? node.children : []), type).toEqual(config.facets.map((f) => f.path));
    }
    expect(find(nodes, 'Tags', 'Theme')?.kind).toBe('enum');
    // A tag a checked type lists among its default filters starts open too.
    expect(find(nodes, 'Tags', 'Theme')?.open).toBe(false);
    expect(find(tree(full(), home, '?f.type=creature'), 'Tags', 'Theme')?.open).toBe(true);
  });

  it('checks a type as the type filter, counting what checking it adds', () => {
    const home = galleryConfig(reg, data);
    const nodes = tree(full(), home, '?f.type=spell');
    const spell = nodes.find((n) => n.kind === 'type' && n.value.key === 'spell');
    const feat = nodes.find((n) => n.kind === 'type' && n.value.key === 'feat');
    expect(spell?.kind === 'type' && spell.value).toMatchObject({ selected: true, count: 1 });
    expect(feat?.kind === 'type' && feat.value).toMatchObject({ selected: false, count: 1 });
  });

  it('shows the Ruleset node only with more than one ruleset, or when it filters', () => {
    const home = galleryConfig(reg, data);
    expect(tree(full(), home).map((n) => n.id)).not.toContain('ruleset');
    const filtered = tree(full(), home, '?f.ruleset=dnd-5e-2024');
    expect(filtered[0]).toMatchObject({ kind: 'enum', id: 'ruleset', open: true });
    expect(values(filtered[0])).toEqual([expect.objectContaining({ key: 'dnd-5e-2024', label: 'D&D 5e (SRD 5.2)', selected: true })]);
    const other = { ...reg, other: { ...reg['dnd-5e-2024']!, label: 'Other' } } as Registry;
    const two = [...full(), record({ id: 'stranger', ruleset: 'other' })];
    const nodes = tree(two, galleryConfig(other, data));
    expect(values(nodes[0]).map((v) => [v.label, v.count])).toEqual([
      ['D&D 5e (SRD 5.2)', full().length],
      ['Other', 1],
    ]);
  });
});
