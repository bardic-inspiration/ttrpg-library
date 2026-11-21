// The Open5e translator (docs/export.md#open5e): a round trip over every library entry it covers,
// Open5e's published schema, field names against records taken from the API, and the pilot's cases.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildIndex, type ExportBundle } from '../../scripts/build-index/index.ts';
import { validateLibrary } from '../../scripts/validate/index.ts';
import { PROJECT_ROOT } from '../../scripts/validate/schema.ts';
import { ruleNames } from '../../lib/rules.ts';
import { open5e, MAPPINGS } from '../../site/src/translators/open5e/index.ts';
import { checkOpen5e, CORRECTIONS } from '../../site/src/translators/open5e/schema.ts';
import type { ImportContext, Skip, TranslatorItem } from '../../site/src/translators/types.ts';
import { FIXTURES, tempLibrary } from '../helpers.ts';

const OPEN5E = join(FIXTURES, 'open5e');
const fixture = async (name: string): Promise<Record<string, any>> => JSON.parse(await readFile(join(OPEN5E, name), 'utf8'));
const readJson = async (path: string): Promise<Record<string, any>> => JSON.parse(await readFile(path, 'utf8'));

let bundles: ExportBundle[] = [];
let context: ImportContext;

/** The whole library, plus a custom condition and equipment (the library has none), as export bundles. */
beforeAll(async () => {
  const library = await buildIndex(join(PROJECT_ROOT, 'content'));
  const extras = await tempLibrary([
    await readJson(join(FIXTURES, 'condition/mired.json')),
    await readJson(join(FIXTURES, 'equipment/tidewater-net.json')),
  ]);
  const custom = await buildIndex(extras.content, { assetsRoot: extras.repo });
  expect([...library.errors, ...custom.errors]).toEqual([]);
  bundles = [...library.bundles, ...custom.bundles];
  // Names resolve against the ruleset's rules and the library's entries, as the import flow gives them.
  const { rules } = await validateLibrary(join(PROJECT_ROOT, 'content'));
  const names = new Map<string, string>(rules.flatMap((data) => [...ruleNames(data)]));
  for (const b of bundles) {
    for (const [key, name] of Object.entries(b.names)) names.set(key, name);
    names.set(`${b.entry.type}/${b.entry.id}`, b.entry.name);
  }
  context = { ruleset: 'dnd-5e-2024', names };
}, 120_000);

const item = (b: ExportBundle): TranslatorItem => b as unknown as TranslatorItem;
const bundle = (key: string): ExportBundle => bundles.find((b) => `${b.entry.type}/${b.entry.id}` === key)!;
const covered = () => bundles.filter((b) => open5e.types.includes(b.entry.type));

/** Paths where two values differ, as `stats.actions[2].onHit`. */
function diffPaths(a: unknown, b: unknown, path: string): string[] {
  if (a === b) return [];
  const isObject = (v: unknown) => v !== null && typeof v === 'object';
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return [path];
  const at = (k: string) => (Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k);
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  return [...keys].flatMap((k) => diffPaths((a as any)[k], (b as any)[k], at(k)));
}

/** A difference is reported when a skip names it, a field inside it, or a field it's inside. */
const reported = (diff: string, skips: Skip[]): boolean =>
  skips.some(({ path: p }) => p === '' || p === diff || [`${p}.`, `${p}[`].some((s) => diff.startsWith(s)) || [`${diff}.`, `${diff}[`].some((s) => p.startsWith(s)));

describe('Open5e round trip (docs/export.md#open5e)', () => {
  it('returns every covered entry, apart from what the export reports', () => {
    expect(covered().length).toBeGreaterThan(900);
    const unreported: string[] = [];
    for (const b of covered()) {
      const key = `${b.entry.type}/${b.entry.id}`;
      const out = open5e.export([item(b)]);
      const skips = out.skipped.filter((s) => s.entry === key);
      if (!out.exported.includes(key)) {
        expect(skips.some((s) => s.path === '')).toBe(true);
        continue;
      }
      const back = open5e.import(JSON.parse(out.data), context).entries[0];
      const original = { name: b.entry.name, summary: b.entry.summary, description: b.entry.description, stats: b.entry.stats };
      const after = back && { name: back.name, summary: undefined, description: back.description, stats: back.stats };
      for (const diff of after ? diffPaths(original, after, '') : ['']) {
        if (!reported(diff, skips)) unreported.push(`${key} ${diff}`);
      }
      if (back) expect(back.id).toBe(b.entry.id);
    }
    expect(unreported).toEqual([]);
  });
});

const KIND_FIXTURES: Record<string, string[]> = {
  Creature: ['creatures-lich.json'],
  Spell: ['spells-fireball.json', 'spells-shield.json'],
  MagicItem: ['magicitems-boots-of-levitation.json'],
  Item: ['items-longsword.json', 'items-chain-mail.json', 'items-shortbow.json'],
  Condition: ['conditions-poisoned.json', 'conditions-bloodied.json'],
};

/** Every field path in a record: `actions[].attacks[].to_hit_mod`. Skill bonuses are keyed by skill, so they're named once. */
function fieldPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => fieldPaths(v, `${path}[]`));
  if (value === null || typeof value !== 'object') return [path];
  return Object.entries(value).flatMap(([k, v]) => {
    const at = path ? `${path}.${k}` : k;
    return [at, ...(/^(skill_bonuses|skill_bonuses_all|saving_throws|saving_throws_all)$/.test(at) ? [] : fieldPaths(v, at))];
  });
}

const exportOne = (key: string) => {
  const out = open5e.export([item(bundle(key))]);
  const file = JSON.parse(out.data) as Record<string, Record<string, any>[]>;
  return { out, record: Object.values(file)[0]![0]!, file };
};

describe('Open5e schema and field names (docs/export.md#open5e)', () => {
  it('passes Open5e\'s published schema for every exported record', () => {
    const failures: string[] = [];
    const out = open5e.export(covered().map(item));
    const file = JSON.parse(out.data) as Record<string, Record<string, any>[]>;
    for (const mapping of Object.values(MAPPINGS)) {
      for (const record of file[mapping.endpoint] ?? []) {
        for (const error of checkOpen5e(mapping.kind, record)) failures.push(`${record.key}: ${error}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(out.exported.length).toBe(Object.values(file).flat().length);
  });

  it('accepts the records taken from the API, with each correction backed by its fixture', async () => {
    for (const [kind, files] of Object.entries(KIND_FIXTURES)) {
      for (const name of files) expect(checkOpen5e(kind as 'Creature', await fixture(name)), name).toEqual([]);
    }
    const fixtures = await readdir(OPEN5E);
    for (const correction of CORRECTIONS) expect(fixtures).toContain(correction.fixture);
  });

  it('writes only field names a live Open5e record has, or its schema names', async () => {
    const schemas = (await readJson(join(PROJECT_ROOT, 'site/src/translators/open5e/open5e.schema.json'))).components.schemas;
    /** The field paths a component schema names, following `$ref` and `allOf`. */
    const named = (node: any, path: string, depth = 0): string[] => {
      if (!node || depth > 12) return [];
      if (node.$ref) return named(schemas[String(node.$ref).split('/').at(-1)!], path, depth + 1);
      if (node.allOf) return node.allOf.flatMap((n: unknown) => named(n, path, depth + 1));
      if (node.type === 'array') return named(node.items, `${path}[]`, depth + 1);
      return Object.entries(node.properties ?? {}).flatMap(([k, v]) => {
        const at = path ? `${path}.${k}` : k;
        return [at, ...named(v, at, depth + 1)];
      });
    };
    const out = open5e.export(covered().map(item));
    const file = JSON.parse(out.data) as Record<string, Record<string, any>[]>;
    for (const mapping of Object.values(MAPPINGS)) {
      const live = new Set((await Promise.all(KIND_FIXTURES[mapping.kind]!.map(fixture))).flatMap((f) => fieldPaths(f)));
      const required = new Set<string>(named(schemas[mapping.kind], ''));
      const written = new Set((file[mapping.endpoint] ?? []).flatMap((r) => fieldPaths(r)));
      const unknown = [...written].filter((p) => !live.has(p) && !required.has(p));
      expect(unknown, mapping.kind).toEqual([]);
    }
  });
});

describe('Open5e pilot cases (spec/tracks/integrations.md "Cases")', () => {
  it('exports creature/lich with the numbers Open5e gives the SRD lich', async () => {
    const { record, out } = exportOne('creature/lich');
    const srd = await fixture('creatures-lich.json');
    for (const field of ['name', 'challenge_rating', 'armor_class', 'hit_points', 'hit_dice', 'experience_points', 'ability_scores', 'modifiers', 'initiative_bonus', 'saving_throws', 'skill_bonuses', 'passive_perception', 'truesight_range', 'alignment']) {
      expect(record[field], field).toEqual(srd[field]);
    }
    expect(record.speed).toEqual({ unit: 'feet', walk: 30 });
    expect(record.resistances_and_immunities.condition_immunities.map((c: { name: string }) => c.name)).toEqual(
      srd.resistances_and_immunities.condition_immunities.map((c: { name: string }) => c.name),
    );
    const action = (name: string) => record.actions.find((a: { name: string }) => a.name === name);
    expect(action('Paralyzing Touch').desc).toBe('*Melee Attack Roll:* +12, reach 5 ft. *Hit:* 15 (3d6 + 5) Cold damage, and the target has the Paralyzed condition until the start of the lich\'s next turn.');
    expect(action('Paralyzing Touch').attacks[0]).toMatchObject({ to_hit_mod: 12, reach: 5, damage_die_count: 3, damage_die_type: 'D6', damage_bonus: 5, damage_type: { key: 'cold' } });
    expect(action('Disrupt Life').action_type).toBe('LEGENDARY_ACTION');
    expect(action('Spellcasting').desc).toContain('*At Will:* Detect Magic, Detect Thoughts, Dispel Magic, Fireball (level 5 version)');
    expect(record.traits[1].desc).toContain('reviving with all its Hit Points.');
    const skipped = out.skipped.map((s) => s.path);
    expect(skipped).toEqual(expect.arrayContaining(['stats.traits[1].text', 'stats.actions[2].onHit', 'stats.gear', 'stats.lair', 'stats.legendaryActions.uses']));
  });

  it('exports spell/fireball and item/boots-of-levitation as Open5e gives them', async () => {
    const fireball = exportOne('spell/fireball').record;
    const srdSpell = await fixture('spells-fireball.json');
    for (const field of ['name', 'level', 'higher_level', 'range_text', 'range', 'ritual', 'casting_time', 'verbal', 'somatic', 'material', 'material_specified', 'material_consumed', 'duration', 'concentration']) {
      expect(fireball[field], field).toEqual(srdSpell[field]);
    }
    expect(fireball.school).toEqual(srdSpell.school);
    expect(fireball.classes.map((c: { name: string }) => c.name)).toEqual(['Sorcerer', 'Wizard']);
    const boots = exportOne('item/boots-of-levitation');
    const srdItem = await fixture('magicitems-boots-of-levitation.json');
    for (const field of ['name', 'category', 'rarity', 'requires_attunement', 'size', 'weight']) expect(boots.record[field], field).toEqual(srdItem[field]);
    expect(boots.out.skipped.map((s) => `${s.path}: ${s.reason}`)).toEqual([
      'summary: Open5e has no field for a summary.',
      'tags: Open5e has no field for tags.',
      'stats.spells: Open5e has no field for the spells an item casts.',
      'stats.effect: The link to Levitate became plain text.',
    ]);
  });

  it('round-trips each case through export and import', () => {
    for (const key of ['creature/lich', 'spell/fireball', 'item/boots-of-levitation']) {
      const b = bundle(key);
      const back = open5e.import(JSON.parse(open5e.export([item(b)]).data), context).entries[0]!;
      expect(back.name).toBe(b.entry.name);
      if (key === 'item/boots-of-levitation') {
        expect(back.stats).toEqual({ ...(b.entry.stats as object), spells: undefined, effect: 'While you wear these boots, you can cast *Levitate* on yourself.' } as never);
      }
    }
  });
});

describe('Open5e import (docs/export.md#open5e)', () => {
  it('reads the SRD lich as Open5e gives it into inputs', async () => {
    const { entries, skipped } = open5e.import(await fixture('creatures-lich.json'), context);
    const s = entries[0]!.stats as Record<string, any>;
    expect(entries[0]).toMatchObject({ ruleset: 'dnd-5e-2024', type: 'creature', id: 'lich', name: 'Lich' });
    expect(s).toMatchObject({ size: ['medium'], creatureType: 'undead', hitDice: 42, cr: 21, ac: { value: 20, note: 'natural armor' } });
    expect(s.saveProficiencies).toEqual(['dex', 'con', 'int', 'wis']);
    expect(s.skills).toEqual({ arcana: 'expertise', history: 'proficient', insight: 'proficient', perception: 'proficient' });
    expect(s.initiative).toEqual({ proficiency: 'expertise' });
    expect(s.immunities.conditions).toEqual(['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'].map((c) => ({ ref: `condition/${c}` })));
    const paralyzing = s.actions.find((a: { name: string }) => a.name === 'Paralyzing Touch');
    expect(paralyzing).toEqual({
      name: 'Paralyzing Touch',
      kind: 'melee-attack',
      ability: 'int',
      reach: 5,
      damage: [{ dice: '3d6', ability: 'int', type: 'cold' }],
      onHit: 'and the target has the Paralyzed condition until the start of the lich\'s next turn.',
    });
    expect(s.traits[1].text).toBe('If destroyed, the lich reforms in 1d10 days if it has a spirit jar, reviving with all its Hit Points. The new body appears in an unoccupied space within the lich\'s lair.');
    expect(s.traits[0]).toMatchObject({ name: 'Legendary Resistance', uses: '4/day, or 5/day in lair' });
    expect(skipped.map((k) => k.path)).toContain('stats.legendaryActions');
    expect(s.legendaryActions).toBeUndefined();
  });

  it('reads Open5e spells, magic items, conditions, and equipment', async () => {
    const spell = open5e.import(await fixture('spells-shield.json'), context).entries[0]!;
    expect(spell.stats).toMatchObject({
      level: 1,
      school: 'abjuration',
      classes: [{ ref: 'class/sorcerer' }, { ref: 'class/wizard' }],
      castingTime: { amount: 1, unit: 'reaction', trigger: 'when you are hit by an attack roll or targeted by the Magic Missile spell' },
      range: { kind: 'self' },
      duration: { kind: 'timed', amount: 1, unit: 'round', concentration: false },
    });
    const boots = open5e.import(await fixture('magicitems-boots-of-levitation.json'), context).entries[0]!;
    expect(boots.stats).toEqual({ category: 'wondrous-item', rarity: 'rare', attunement: { required: true }, effect: 'While you wear these boots, you can cast Levitate on yourself.' });
    const poisoned = open5e.import(await fixture('conditions-poisoned.json'), context).entries[0]!;
    expect(poisoned.stats).toEqual({ effects: [{ name: 'Ability Checks and Attacks Affected', text: 'You have Disadvantage on attack rolls and ability checks.' }] });
    // Open5e's live weapons leave out `is_melee`, so they skip; the export writes it.
    expect(open5e.import(await fixture('items-longsword.json'), context).skipped[0]?.reason).toMatch(/melee or ranged/);
    const melee = (record: Record<string, any>, isMelee: boolean) => ({ ...record, weapon: { ...record.weapon, is_melee: String(isMelee) } });
    const longsword = open5e.import(melee(await fixture('items-longsword.json'), true), context).entries[0]!;
    expect(longsword.stats).toMatchObject({ group: 'martial-melee-weapons', cost: { amount: 15, unit: 'gp' }, weight: 3 });
    expect((longsword.stats.weapon as Record<string, unknown>).damage).toEqual({ dice: '1d8', type: 'slashing' });
    const shortbow = open5e.import(melee(await fixture('items-shortbow.json'), false), context).entries[0]!;
    expect(shortbow.stats.weapon).toMatchObject({ range: { normal: 80, long: 320 }, ammunition: 'Arrow' });
  });

  it('takes a record, a list, a page of results, or an export file, and lists what it skips', async () => {
    const lich = await fixture('creatures-lich.json');
    const ids = (file: unknown) => open5e.import(file, context).entries.map((e) => e.id);
    expect(ids(lich)).toEqual(['lich']);
    expect(ids([lich])).toEqual(['lich']);
    expect(ids({ count: 1, results: [lich] })).toEqual(['lich']);
    expect(ids({ creatures: [lich] })).toEqual(['lich']);
    const { skipped } = open5e.import({ name: 'Bard', hit_die: 8 }, context);
    expect(skipped).toEqual([{ entry: 'Bard', path: '', reason: expect.stringContaining('isn\'t a record type') }]);
  });

  it('exports only the types it covers, and says so for the rest', () => {
    const feat = bundles.find((b) => b.entry.type === 'feat')!;
    const out = open5e.export([item(feat)]);
    expect(out.exported).toEqual([]);
    expect(out.skipped).toEqual([{ entry: `feat/${feat.entry.id}`, path: '', reason: 'Open5e doesn\'t cover the feat type, so it isn\'t exported.' }]);
  });
});

describe('Open5e translator metadata', () => {
  it('lists the types its mappings cover, in the file\'s order', () => {
    expect(open5e.types).toEqual(Object.keys(MAPPINGS));
  });
});
