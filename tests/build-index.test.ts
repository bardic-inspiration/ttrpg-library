import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIndex, writeIndex } from '../scripts/build-index/index.ts';
import { loadRegistry } from '../scripts/validate/schema.ts';
import { displayIssues, isChip, isFlag, type Schema } from '../scripts/build-index/schema-walk.ts';
import { ruleset } from '../rulesets/dnd-5e-2024/index.ts';
import { FIXTURES, cinderHound, frostLance, tempLibrary, wandOfFrostLances } from './helpers.ts';

// docs/site.md#index-build (Build) and docs/site.md#type-registry (Type registry); issue #9.
const ROOT = join(import.meta.dirname, '..');
const valid = join(FIXTURES, 'library/valid');
const temps: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ttrpg-index-'));
  temps.push(dir);
  return dir;
};
const temp = async (...args: Parameters<typeof tempLibrary>) => {
  const lib = await tempLibrary(...args);
  temps.push(lib.repo);
  return lib;
};
const readSchema = async (file: string) =>
  JSON.parse(await readFile(join(ROOT, 'rulesets/dnd-5e-2024/schemas', file), 'utf8')) as Schema;
const schemaSet = async (type: string) => ({
  root: await readSchema(`${type}.schema.json`),
  files: new Map([['common.schema.json', await readSchema('common.schema.json')]]),
});

describe('library.json records', () => {
  it('have exactly the docs/site.md#index-build keys, in order', async () => {
    const { errors, records } = await buildIndex(valid);
    expect(errors).toEqual([]);
    // The three example entries, and the two classes Frost Lance names, then a card per SRD condition and equipment primitive.
    expect(records.filter((r) => r.createdAt !== null)).toHaveLength(5);
    expect(records.length).toBeGreaterThan(5);
    for (const record of records) {
      expect(Object.keys(record)).toEqual([
        'id', 'ruleset', 'source', 'author', 'type', 'name', 'summary', 'url', 'image', 'diagram', 'facets', 'createdAt', 'refs', 'refBy',
      ]);
    }
  });

  it('match the docs/site.md#index-build example for the cinder hound', async () => {
    const { records } = await buildIndex(valid);
    const hound = records.find((r) => r.id === 'cinder-hound');
    expect(hound).toMatchObject({
      ruleset: 'dnd-5e-2024',
      source: null,
      author: 'bardic-inspiration',
      type: 'creature',
      name: 'Cinder Hound',
      url: '/ttrpg-library/dnd-5e-2024/creature/cinder-hound/',
      image: null,
      diagram: null,
      refs: [],
      refBy: [],
    });
    expect(hound?.facets).toMatchObject({
      'stats.cr': 2,
      'stats.size': ['medium'],
      'stats.creatureType': 'monstrosity',
      'derived.hp.average': 32,
      'derived.xp': 450,
    });
  });

  it('lift facets in registry order, from the registry only', async () => {
    const registry = await loadRegistry();
    const { records } = await buildIndex(valid);
    for (const record of records) {
      const paths = registry[record.ruleset]!.types[record.type]!.facets.map((f) => f.path);
      expect(paths).toEqual(expect.arrayContaining(Object.keys(record.facets)));
      expect(Object.keys(record.facets)).toEqual(paths.filter((p) => p in record.facets));
    }
  });

  it('lift a ref facet as its refs’ keys (docs/site.md#type-registry)', async () => {
    const { records } = await buildIndex(valid);
    expect(records.find((r) => r.id === 'frost-lance')?.facets['stats.classes']).toEqual(['class/sorcerer', 'class/wizard']);
    const hound = await cinderHound();
    hound.stats.immunities = { damage: ['fire'], conditions: [{ ref: 'condition/poisoned' }, { ref: 'condition/charmed', note: 'magical' }] };
    const lib = await temp([hound]);
    const { errors, records: own } = await buildIndex(lib.content, { assetsRoot: lib.repo });
    expect(errors).toEqual([]);
    expect(own.find((r) => r.id === 'cinder-hound')?.facets).toMatchObject({
      'stats.immunities.damage': ['fire'],
      'stats.immunities.conditions': ['condition/poisoned', 'condition/charmed'],
    });
  });

  it('read a path through an array of objects as each item’s value at the rest of it (docs/site.md#type-registry)', async () => {
    const facets = [
      { path: 'stats.actions.name', label: 'Action', kind: 'enum' },
      { path: 'stats.actions.damage.type', label: 'Damage', kind: 'enum' },
      { path: 'stats.traits.recharge', label: 'Recharge', kind: 'enum' },
    ] as const;
    const { records } = await buildIndex(valid, {
      registry: {
        'dnd-5e-2024': {
          label: 'x',
          types: {
            creature: { label: 'C', plural: 'Cs', template: 't', facets: [...facets] },
            'item': { label: 'M', plural: 'Ms', template: 't', facets: [] },
            spell: { label: 'S', plural: 'Ss', template: 't', facets: [] },
            class: { label: 'Cl', plural: 'Cls', template: 't', facets: [] },
          },
        },
      },
    });
    // Nested arrays flatten, each value once in first-seen order, and an item without the value adds
    // nothing; with no item having it, the facet is left out.
    expect(records.find((r) => r.id === 'cinder-hound')?.facets).toEqual({
      'stats.actions.name': ['Bite', 'Ember Breath'],
      'stats.actions.damage.type': ['piercing', 'fire'],
    });
  });

  it('read an omitted optional flag as false and keep a present one', async () => {
    const cursed = await wandOfFrostLances();
    Object.assign(cursed, { id: 'cursed-wand', name: 'Cursed Wand' });
    cursed.stats.cursed = true;
    const lib = await temp([await frostLance(), await wandOfFrostLances(), cursed]);
    const { errors, records } = await buildIndex(lib.content, { assetsRoot: lib.repo });
    expect(errors).toEqual([]);
    expect(records.find((r) => r.id === 'wand-of-frost-lances')?.facets['stats.cursed']).toBe(false);
    expect(records.find((r) => r.id === 'cursed-wand')?.facets['stats.cursed']).toBe(true);
  });

  it('leave out a facet whose optional value is missing', async () => {
    const { records } = await buildIndex(valid, {
      registry: {
        'dnd-5e-2024': {
          label: 'x',
          types: {
            creature: { label: 'C', plural: 'Cs', template: 't', facets: [{ path: 'stats.speed.fly', label: 'Fly', kind: 'range' }] },
            'item': { label: 'M', plural: 'Ms', template: 't', facets: [] },
            spell: { label: 'S', plural: 'Ss', template: 't', facets: [] },
            class: { label: 'Cl', plural: 'Cls', template: 't', facets: [] },
          },
        },
      },
    });
    expect(records.find((r) => r.id === 'cinder-hound')?.facets).toEqual({});
  });

  it('carry resolved refs and back-refs', async () => {
    const { records } = await buildIndex(valid);
    expect(records.find((r) => r.id === 'wand-of-frost-lances')?.refs).toEqual([
      { path: 'stats.spells[0].spell', key: 'spell/frost-lance' },
    ]);
    expect(records.find((r) => r.id === 'frost-lance')?.refBy).toEqual([
      { path: 'stats.spells[0].spell', key: 'item/wand-of-frost-lances' },
    ]);
  });

  it('take derived values from the ruleset module, never recomputed', async () => {
    const real = ruleset.derive.bind(ruleset);
    const derive = vi.spyOn(ruleset, 'derive').mockImplementation((type, stats) =>
      type === 'creature' ? { ...real(type, stats), xp: 12345, hp: { average: 999 } } : real(type, stats),
    );
    const { records } = await buildIndex(valid);
    expect(derive).toHaveBeenCalled();
    const facets = records.find((r) => r.id === 'cinder-hound')?.facets;
    expect(facets?.['derived.xp']).toBe(12345);
    expect(facets?.['derived.hp.average']).toBe(999);
  });
});

describe('ruleset primitives (docs/site.md#index-build)', () => {
  it('get a record for each primitive of a rules type that takes extensions, and none for the others', async () => {
    const { records } = await buildIndex(valid);
    const primitives = records.filter((r) => r.createdAt === null);
    const types = new Set(primitives.map((r) => r.type));
    expect([...types].sort()).toEqual(['condition', 'equipment']);
    expect(primitives.filter((r) => r.type === 'condition')).toHaveLength(15);
  });

  it('read as official SRD rules with no summary, opening their section on the rules page', async () => {
    const { records } = await buildIndex(valid);
    const blinded = records.find((r) => r.type === 'condition' && r.id === 'blinded')!;
    expect(blinded).toEqual({
      id: 'blinded',
      ruleset: 'dnd-5e-2024',
      source: null,
      author: 'publisher',
      type: 'condition',
      name: 'Blinded',
      summary: '',
      url: '/ttrpg-library/dnd-5e-2024/rules/conditions/#condition-blinded',
      image: null,
      diagram: null,
      facets: {},
      createdAt: null,
      refs: expect.any(Array),
      refBy: expect.any(Array),
    });
  });

  it('lift facets from their stats and derived values, as an extension does', async () => {
    const { records } = await buildIndex(valid);
    const longsword = records.find((r) => r.type === 'equipment' && r.id === 'longsword')!;
    expect(longsword.facets).toMatchObject({ 'stats.group': 'martial-melee-weapons', 'derived.costGp': 15, 'stats.weapon.mastery': 'mastery-property/sap' });
    expect(longsword.url).toMatch(/\/dnd-5e-2024\/rules\/[a-z-]+\/#equipment-longsword$/);
  });

  it('write a raw copy of the primitive and its export bundle', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    const file = join(ROOT, 'rulesets/dnd-5e-2024/rules/equipment/acid.json');
    expect(await readFile(join(out, 'data/dnd-5e-2024/equipment/acid.json'), 'utf8')).toBe(await readFile(file, 'utf8'));
    const primitive = JSON.parse(await readFile(file, 'utf8')) as { type: string; stats: unknown };
    const bundle = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024/equipment/acid.export.json'), 'utf8')) as Record<string, unknown>;
    expect(bundle).toEqual({ entry: { ruleset: 'dnd-5e-2024', ...primitive }, derived: expect.objectContaining({ costGp: 25 }), names: expect.any(Object) });
  });
});

describe('the build', () => {
  it('fails, with no records, when validation fails', async () => {
    const broken = await cinderHound();
    delete broken.stats.cr;
    const lib = await temp([broken]);
    const result = await buildIndex(lib.content, { assetsRoot: lib.repo });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toEqual([]);
  });

  it('CLI exits 1 and writes nothing when validation fails', async () => {
    const broken = await cinderHound();
    delete broken.stats.cr;
    const lib = await temp([broken]);
    const out = await tempDir();
    const result = spawnSync('npx', ['tsx', join(ROOT, 'scripts/build-index/cli.ts'), lib.content, out], { encoding: 'utf8', cwd: ROOT });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('validation errors');
    // Each error names its file from the repo root (docs/content-model.md#validation).
    expect(result.stderr).toContain('content/dnd-5e-2024/creature/cinder-hound.json: stats: missing required key "cr"');
    expect(await readdir(out)).toEqual([]);
  });

  it('writes library.json and a raw copy of each entry', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    const library = JSON.parse(await readFile(join(out, 'library.json'), 'utf8')) as { id: string }[];
    const entries = library.filter((r) => !['condition', 'equipment'].includes((r as { type?: string }).type ?? ''));
    expect(entries.map((r) => r.id)).toEqual(['sorcerer', 'wizard', 'cinder-hound', 'wand-of-frost-lances', 'frost-lance']);
    for (const path of ['creature/cinder-hound.json', 'item/wand-of-frost-lances.json', 'spell/frost-lance.json']) {
      expect(await readFile(join(out, 'data/dnd-5e-2024', path), 'utf8')).toBe(await readFile(join(valid, 'dnd-5e-2024', path), 'utf8'));
    }
  });

  it('writes each entry’s export bundle, the entry with its derived values and its links\' names, beside the raw copy', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    for (const path of ['creature/cinder-hound', 'item/wand-of-frost-lances', 'spell/frost-lance']) {
      const entry = JSON.parse(await readFile(join(valid, 'dnd-5e-2024', `${path}.json`), 'utf8')) as { type: string; stats: unknown };
      const bundle = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024', `${path}.export.json`), 'utf8')) as Record<string, unknown>;
      expect(bundle).toEqual({ entry, derived: ruleset.derive(entry.type, entry.stats), names: expect.any(Object) });
    }
    const creature = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024/creature/cinder-hound.export.json'), 'utf8')) as {
      derived: { xp: number };
    };
    expect(creature.derived.xp).toBe(450);
    const spell = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024/spell/frost-lance.export.json'), 'utf8')) as { names: Record<string, string> };
    expect(spell.names).toMatchObject({ 'class/sorcerer': 'Sorcerer', 'class/wizard': 'Wizard' });
  });

  it('removes the copy of a deleted entry', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    const lib = await temp([await cinderHound()]);
    await writeIndex(lib.content, out, await buildIndex(lib.content, { assetsRoot: lib.repo }));
    expect(await readdir(join(out, 'data/dnd-5e-2024'))).toEqual(['condition', 'creature', 'equipment']);
    expect(await readdir(join(out, 'data/dnd-5e-2024/creature'))).toEqual(['cinder-hound.export.json', 'cinder-hound.json']);
  });

  it('is byte-identical across two independent builds', async () => {
    const [a, b] = [await tempDir(), await tempDir()];
    await writeIndex(valid, a, await buildIndex(valid));
    await writeIndex(valid, b, await buildIndex(valid));
    expect(await readFile(join(a, 'library.json'))).toEqual(await readFile(join(b, 'library.json')));
  });
});

// Content types that come only by request, so they have no gap buckets, and have no key stat for
// PR bodies (docs/generation.md#gap-buckets, docs/site.md#type-registry).
const REQUEST_ONLY = ['background', 'character', 'class', 'encounter', 'map', 'species', 'subclass'];

describe('the type registry', () => {
  it('registers every content type, and every rules type that takes extensions, with the docs/site.md#type-registry keys', async () => {
    const registry = await loadRegistry();
    const extensionTypes = (ruleset.definition.rules ?? []).filter((r) => r.extensions).map((r) => r.type);
    expect(Object.keys(registry['dnd-5e-2024']!.types).sort()).toEqual([...ruleset.definition.types, ...extensionTypes].sort());
    for (const [type, config] of Object.entries(registry['dnd-5e-2024']!.types)) {
      // A rules extension and a request-only type have no key stat to show in PR bodies (docs/site.md#type-registry).
      const keys = ['label', 'plural', 'template', 'facets', 'cardFields', 'defaultSort', 'defaultFilters'];
      const keyStat = !extensionTypes.includes(type) && !REQUEST_ONLY.includes(type);
      for (const key of keyStat ? [...keys, 'summaryField'] : keys) expect(config).toHaveProperty(key);
      if (!keyStat) expect(config, `${type} summaryField`).not.toHaveProperty('summaryField');
      const paths = config.facets.map((f) => f.path);
      for (const field of config.cardFields as string[]) expect(paths).toContain(field);
      // The default sort is a facet, or a path every record has (docs/site.md#gallery "Sort").
      expect([...paths, 'name', 'createdAt']).toContain(String(config.defaultSort).replace(/:(asc|desc)$/, ''));
      // Every default filter is one of the type's facets.
      for (const filter of config.defaultFilters as string[]) expect(paths).toContain(filter);
    }
  });

  it('declares each ordered enum in the schema order', async () => {
    const registry = await loadRegistry();
    const types = registry['dnd-5e-2024']!.types;
    const creature = await readSchema('creature.schema.json');
    const item = await readSchema('item.schema.json');
    const sizes = ((creature.properties as any).size.items.enum) as string[];
    const rarities = ((item.properties as any).rarity.enum) as string[];
    expect(types.creature!.facets.find((f) => f.path === 'stats.size')?.order).toEqual(sizes);
    expect(types['item']!.facets.find((f) => f.path === 'stats.rarity')?.order).toEqual(rarities);
  });

  // docs/generation.md#gap-buckets: every axis is a facet of its type; bins sit on range facets, ascending
  // and disjoint; categorical values sit on enum facets and are values the schema allows.
  it('gives every content type gap buckets whose axes are its facets, and a rules extension or request-only type none', async () => {
    const registry = await loadRegistry();
    const extensionTypes = new Set((ruleset.definition.rules ?? []).map((r) => r.type));
    for (const [type, config] of Object.entries(registry['dnd-5e-2024']!.types)) {
      // Gap fill never adds a rules extension or a request-only type (docs/generation.md#gap-buckets).
      if (extensionTypes.has(type) || REQUEST_ONLY.includes(type)) {
        expect(config.gapBuckets, `${type} gapBuckets`).toBeUndefined();
        continue;
      }
      const axes = config.gapBuckets as Array<{ path: string; bins?: [number, number][]; enum?: string[] }>;
      expect(Array.isArray(axes) && axes.length > 0, `${type} gapBuckets`).toBe(true);
      const schema = await readSchema(`${type}.schema.json`);
      for (const axis of axes) {
        const facet = config.facets.find((f) => f.path === axis.path);
        expect(facet, `${type} ${axis.path} is a facet`).toBeDefined();
        expect(Object.keys(axis).sort(), `${type} ${axis.path} has one kind`).toEqual(['path', axis.bins ? 'bins' : 'enum'].sort());
        if (axis.bins) {
          expect(facet!.kind).toBe('range');
          expect(axis.bins.length).toBeGreaterThan(0);
          axis.bins.forEach(([min, max], i) => {
            expect(min).toBeLessThanOrEqual(max);
            if (i > 0) expect(min).toBeGreaterThan(axis.bins![i - 1]![1]);
          });
        } else {
          expect(facet!.kind).toBe('enum');
          // stats.<a>.<b> → properties.a.properties.b; an array's values sit in items.
          const node = axis.path
            .split('.')
            .slice(1)
            .reduce<any>((at, key) => at?.properties?.[key], schema);
          const allowed = (node?.enum ?? node?.items?.enum) as string[] | undefined;
          expect(allowed, `${type} ${axis.path} has a schema enum`).toBeDefined();
          expect(axis.enum!.length).toBeGreaterThan(0);
          expect(new Set(axis.enum).size).toBe(axis.enum!.length);
          for (const value of axis.enum!) expect(allowed).toContain(value);
        }
      }
    }
  });
});

describe('schema walk', () => {
  it('tells an optional flag from a required boolean', async () => {
    expect(isFlag('cursed', await schemaSet('item'))).toBe(true);
    expect(isFlag('attunement.required', await schemaSet('item'))).toBe(false);
    expect(isFlag('ritual', await schemaSet('spell'))).toBe(false);
  });

  it('reads a chip field beside the field or through its shared definition (docs/content-model.md#display)', async () => {
    expect(isChip('level', await schemaSet('spell'))).toBe(true);
    expect(isChip('name', await schemaSet('spell'))).toBe(false);
    const common: Schema = { $defs: { Size: { enum: ['s', 'm'], display: 'chip' } } };
    const set = { root: { type: 'object', properties: { size: { $ref: 'common.schema.json#/$defs/Size' } } }, files: new Map([['common.schema.json', common]]) };
    expect(isChip('size', set)).toBe(true);
  });

  it('allows display only as "chip", only on a string, number, boolean, or string-array field', () => {
    const doc: Schema = {
      type: 'object',
      $defs: { Kind: { enum: ['a', 'b'] }, Box: { type: 'object' } },
      properties: {
        level: { type: 'integer', display: 'chip' },
        kind: { $ref: '#/$defs/Kind', display: 'chip' },
        flag: { const: true, display: 'chip' },
        tags: { type: 'array', items: { $ref: '#/$defs/Kind' }, display: 'chip' },
        display: { type: 'string' },
        loud: { type: 'string', display: 'badge' },
        box: { $ref: '#/$defs/Box', display: 'chip' },
        boxes: { type: 'array', items: { type: 'object' }, display: 'chip' },
        nums: { type: 'array', items: { type: 'integer' }, display: 'chip' },
        maybe: { anyOf: [{ type: 'string' }, { type: 'null' }], display: 'chip' },
        nested: { type: 'object', properties: { deep: { type: 'object', display: 'chip' } } },
      },
    };
    expect(displayIssues(doc, { root: doc, files: new Map() })).toEqual([
      '/properties/loud: display must be "chip"',
      '/properties/box: display "chip" is only for a string, number, boolean, or string-array field',
      '/properties/boxes: display "chip" is only for a string, number, boolean, or string-array field',
      '/properties/nums: display "chip" is only for a string, number, boolean, or string-array field',
      '/properties/maybe: display "chip" is only for a string, number, boolean, or string-array field',
      '/properties/nested/properties/deep: display "chip" is only for a string, number, boolean, or string-array field',
    ]);
  });
});
