import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GapAxis, GapRecord } from '../lib/buckets.ts';
import { pickGap, type GapRegistry } from '../scripts/generate/gap.ts';

// docs/generation.md#run-order step 5 (the gap-fill picker); issue #72. Bucket counting is in tests/lib/buckets.test.ts.
const ROOT = join(import.meta.dirname, '..');
const R = 'dnd-5e-2024';

const rec = (type: string, facets: Record<string, unknown>, ruleset = R): GapRecord => ({ ruleset, type, facets });

const CR: GapAxis = { path: 'stats.cr', bins: [[0, 1], [2, 4], [5, 10]] };
const RARITY: GapAxis = { path: 'stats.rarity', enum: ['common', 'rare'] };
const LEVEL: GapAxis = { path: 'stats.level', bins: [[0, 0], [1, 3]] };
const SCHOOL: GapAxis = { path: 'stats.school', enum: ['abjuration', 'evocation'] };

describe('pickGap', () => {
  const registry: GapRegistry = {
    [R]: {
      types: {
        creature: { gapBuckets: [CR] },
        'item': { gapBuckets: [RARITY] },
        spell: { gapBuckets: [LEVEL, SCHOOL] },
      },
    },
  };

  /** Fills every bucket of every type with `n` entries. */
  const full = (n: number): GapRecord[] =>
    Array.from({ length: n }, () => [
      ...[0, 2, 5].map((cr) => rec('creature', { 'stats.cr': cr })),
      ...['common', 'rare'].map((r) => rec('item', { 'stats.rarity': r })),
      ...[0, 1].flatMap((level) => ['abjuration', 'evocation'].map((s) => rec('spell', { 'stats.level': level, 'stats.school': s }))),
    ]).flat();

  it('picks the first empty bucket of the smallest type in an empty library', () => {
    expect(pickGap([], registry, R)).toEqual({
      ruleset: R,
      type: 'creature',
      bucket: { label: 'stats.cr=0..1', count: 0 },
      typeCount: 0,
    });
  });

  it('picks the bucket with the fewest entries across types', () => {
    const records = full(2).filter((r) => !(r.type === 'item' && r.facets['stats.rarity'] === 'rare'));
    expect(pickGap([...records, rec('item', { 'stats.rarity': 'rare' })], registry, R)).toMatchObject({
      type: 'item',
      bucket: { label: 'stats.rarity=rare', count: 1 },
    });
  });

  it('breaks a tie between types by the fewest entries overall', () => {
    // Every bucket holds one entry; spells have the most entries, creatures
    // three plus two unbucketed, magic items two.
    const records = [...full(1), rec('creature', {}), rec('creature', { 'stats.cr': 20 })];
    expect(pickGap(records, registry, R)).toMatchObject({ type: 'item', typeCount: 2 });
  });

  it('breaks a tie between buckets of one type by gapBuckets order', () => {
    const records = full(1).filter((r) => r.type !== 'creature' || r.facets['stats.cr'] === 0);
    expect(pickGap(records, registry, R)).toMatchObject({ type: 'creature', bucket: { label: 'stats.cr=2..4', count: 0 } });
  });

  it('breaks a full tie by registry order', () => {
    const tied: GapRegistry = { [R]: { types: { a: { gapBuckets: [RARITY] }, b: { gapBuckets: [RARITY] } } } };
    expect(pickGap([], tied, R)?.type).toBe('a');
  });

  it('reads only the given ruleset and skips types without gap buckets', () => {
    const mixed: GapRegistry = {
      [R]: { types: { npc: {}, 'item': { gapBuckets: [RARITY] } } },
      other: { types: { 'item': { gapBuckets: [RARITY] } } },
    };
    const records = [rec('item', { 'stats.rarity': 'common' }, 'other')];
    expect(pickGap(records, mixed, R)).toMatchObject({ type: 'item', bucket: { label: 'stats.rarity=common', count: 0 } });
    expect(pickGap([], { [R]: { types: { npc: {} } } }, R)).toBeUndefined();
    expect(pickGap([], mixed, 'missing')).toBeUndefined();
  });

  it('picks from config/types.json', async () => {
    const file = JSON.parse(await readFile(join(ROOT, 'config/types.json'), 'utf8')) as GapRegistry;
    const records = [rec('creature', { 'stats.cr': 2 })];
    // Feats, items, and spells are empty; feats come first in the registry (backgrounds have no buckets).
    expect(pickGap(records, file, R)).toMatchObject({ type: 'feat', bucket: { label: 'stats.category=origin' } });
  });
});
