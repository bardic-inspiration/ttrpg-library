import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIndex, loadRegistryFile, writeIndex } from '../scripts/build-index/index.ts';
import { isFlag, refOrTextValues, type Schema } from '../scripts/build-index/schema-walk.ts';
import { plainText } from '../scripts/validate/text.ts';
import { ruleset } from '../rulesets/dnd-5e-2024/index.ts';
import { FIXTURES, cinderHound, frostLance, tempLibrary, wandOfFrostLances } from './helpers.ts';

// SPEC.md §9.1 (Build) and §7 (Type registry); issue #9.
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
  it('have exactly the §9.1 keys, in order', async () => {
    const { errors, records } = await buildIndex(valid);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(3);
    for (const record of records) {
      expect(Object.keys(record)).toEqual([
        'id', 'ruleset', 'type', 'name', 'summary', 'url', 'image', 'facets', 'tags', 'createdAt', 'refs', 'refBy', 'search',
      ]);
    }
  });

  it('match the §9.1 example for the cinder hound', async () => {
    const { records } = await buildIndex(valid);
    const hound = records.find((r) => r.id === 'cinder-hound');
    expect(hound).toMatchObject({
      ruleset: 'dnd-5e-2024',
      type: 'creature',
      name: 'Cinder Hound',
      url: '/ttrpg-library/dnd-5e-2024/creature/cinder-hound/',
      image: null,
      tags: { theme: 'fire', environment: ['underdark', 'mountains'] },
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
    const registry = await loadRegistryFile();
    const { records } = await buildIndex(valid);
    for (const record of records) {
      const paths = registry[record.ruleset]!.types[record.type]!.facets.map((f) => f.path);
      expect(paths).toEqual(expect.arrayContaining(Object.keys(record.facets)));
      expect(Object.keys(record.facets)).toEqual(paths.filter((p) => p in record.facets));
    }
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
          attribution: 'srd-5.2',
          types: {
            creature: { label: 'C', plural: 'Cs', template: 't', facets: [{ path: 'stats.speed.fly', label: 'Fly', kind: 'range' }] },
            'magic-item': { label: 'M', plural: 'Ms', template: 't', facets: [] },
            spell: { label: 'S', plural: 'Ss', template: 't', facets: [] },
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
      { path: 'stats.spells[0].spell', key: 'magic-item/wand-of-frost-lances' },
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

describe('search text', () => {
  it('holds action and trait names, description, and rules text, with markup and tokens stripped', async () => {
    const hound = await cinderHound();
    hound.description = 'Bred in **forges**, they *smolder*.\n\n- loyal\n- hungry';
    const lib = await temp([hound]);
    const { records } = await buildIndex(lib.content, { assetsRoot: lib.repo });
    const search = records[0]!.search;
    for (const word of ['Bite', 'Ember Breath', 'Smoldering Hide', 'Bred in forges, they smolder.', 'loyal hungry', 'within 5 feet of it takes']) {
      expect(search).toContain(word);
    }
    expect(search).not.toMatch(/[*{}]/);
    expect(search).not.toMatch(/\s{2}/);
  });

  it('names spells, by target name for a ref and as written for plain text', async () => {
    const hound = await cinderHound();
    hound.stats.spellcasting = { ability: 'cha', atWill: [{ ref: 'spell/frost-lance' }, 'Light'] };
    hound.stats.gear = ['Iron Collar'];
    const lib = await temp([hound, await frostLance()]);
    const { errors, records } = await buildIndex(lib.content, { assetsRoot: lib.repo });
    expect(errors).toEqual([]);
    const search = records.find((r) => r.id === 'cinder-hound')!.search;
    expect(search).toContain('Frost Lance');
    expect(search).toContain('Light');
    expect(search).toContain('Iron Collar');
    expect(search).not.toContain('spell/frost-lance');
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
    expect(await readdir(out)).toEqual([]);
  });

  it('writes library.json and a raw copy of each entry', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    const library = JSON.parse(await readFile(join(out, 'library.json'), 'utf8')) as { id: string }[];
    expect(library.map((r) => r.id)).toEqual(['cinder-hound', 'wand-of-frost-lances', 'frost-lance']);
    for (const path of ['creature/cinder-hound.json', 'magic-item/wand-of-frost-lances.json', 'spell/frost-lance.json']) {
      expect(await readFile(join(out, 'data/dnd-5e-2024', path), 'utf8')).toBe(await readFile(join(valid, 'dnd-5e-2024', path), 'utf8'));
    }
  });

  it('writes each entry’s export bundle, the entry with its derived values, beside the raw copy', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    for (const path of ['creature/cinder-hound', 'magic-item/wand-of-frost-lances', 'spell/frost-lance']) {
      const entry = JSON.parse(await readFile(join(valid, 'dnd-5e-2024', `${path}.json`), 'utf8')) as { type: string; stats: unknown };
      const bundle = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024', `${path}.export.json`), 'utf8')) as unknown;
      expect(bundle).toEqual({ entry, derived: ruleset.derive(entry.type, entry.stats) });
    }
    const creature = JSON.parse(await readFile(join(out, 'data/dnd-5e-2024/creature/cinder-hound.export.json'), 'utf8')) as {
      derived: { xp: number };
    };
    expect(creature.derived.xp).toBe(450);
  });

  it('removes the copy of a deleted entry', async () => {
    const out = await tempDir();
    await writeIndex(valid, out, await buildIndex(valid));
    const lib = await temp([await cinderHound()]);
    await writeIndex(lib.content, out, await buildIndex(lib.content, { assetsRoot: lib.repo }));
    expect(await readdir(join(out, 'data/dnd-5e-2024'))).toEqual(['creature']);
  });

  it('is byte-identical across two independent builds', async () => {
    const [a, b] = [await tempDir(), await tempDir()];
    await writeIndex(valid, a, await buildIndex(valid));
    await writeIndex(valid, b, await buildIndex(valid));
    expect(await readFile(join(a, 'library.json'))).toEqual(await readFile(join(b, 'library.json')));
  });
});

describe('the type registry', () => {
  it('registers every type the ruleset defines, with the §7 keys', async () => {
    const registry = await loadRegistryFile();
    expect(Object.keys(registry['dnd-5e-2024']!.types).sort()).toEqual([...ruleset.definition.types].sort());
    for (const config of Object.values(registry['dnd-5e-2024']!.types)) {
      for (const key of ['label', 'plural', 'template', 'facets', 'cardFields', 'defaultSort', 'defaultFilters', 'summaryField']) {
        expect(config).toHaveProperty(key);
      }
      const paths = config.facets.map((f) => f.path);
      for (const field of config.cardFields as string[]) expect(paths).toContain(field);
      expect(paths).toContain(String(config.defaultSort).replace(/:(asc|desc)$/, ''));
      for (const filter of config.defaultFilters as string[]) if (!filter.startsWith('tags.')) expect(paths).toContain(filter);
    }
  });

  it('declares each ordered enum in the schema order', async () => {
    const registry = await loadRegistryFile();
    const types = registry['dnd-5e-2024']!.types;
    const creature = await readSchema('creature.schema.json');
    const item = await readSchema('magic-item.schema.json');
    const sizes = ((creature.properties as any).size.items.enum) as string[];
    const rarities = ((item.properties as any).rarity.enum) as string[];
    expect(types.creature!.facets.find((f) => f.path === 'stats.size')?.order).toEqual(sizes);
    expect(types['magic-item']!.facets.find((f) => f.path === 'stats.rarity')?.order).toEqual(rarities);
  });

  // §7.1: every axis is a facet of its type; bins sit on range facets, ascending
  // and disjoint; categorical values sit on enum facets and are values the schema allows.
  it('gives every type gap buckets whose axes are its facets', async () => {
    const registry = await loadRegistryFile();
    for (const [type, config] of Object.entries(registry['dnd-5e-2024']!.types)) {
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
  it('finds values at RefOrText fields, through $ref and nested objects', async () => {
    const stats = { spellcasting: { ability: 'cha', atWill: ['Light'], perDay: { '1': [{ ref: 'spell/x' }] } }, gear: ['Rope'], actions: [{ name: 'Bite' }] };
    expect(refOrTextValues(stats, await schemaSet('creature'))).toEqual([['Light'], [{ ref: 'spell/x' }], ['Rope']].flat());
  });

  it('tells an optional flag from a required boolean', async () => {
    expect(isFlag('cursed', await schemaSet('magic-item'))).toBe(true);
    expect(isFlag('attunement.required', await schemaSet('magic-item'))).toBe(false);
    expect(isFlag('ritual', await schemaSet('spell'))).toBe(false);
  });
});

describe('plainText', () => {
  it('strips the markdown subset, keeping words and punctuation', () => {
    expect(plainText('A **bold** and *italic* word.\n\n- one\n- two\n\n1. three\n\nline  \nbreak')).toBe(
      'A bold and italic word. one two three line break',
    );
  });
});
