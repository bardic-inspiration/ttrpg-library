import { describe, expect, it } from 'vitest';
import { countBuckets, type GapAxis, type GapRecord } from '../../lib/buckets.ts';

// SPEC.md §7.1 (Gap buckets); issue #72.
const R = 'dnd-5e-2024';

const rec = (type: string, facets: Record<string, unknown>, ruleset = R): GapRecord => ({ ruleset, type, facets });

const CR: GapAxis = { path: 'stats.cr', bins: [[0, 1], [2, 4], [5, 10]] };
const RARITY: GapAxis = { path: 'stats.rarity', enum: ['common', 'rare'] };
const LEVEL: GapAxis = { path: 'stats.level', bins: [[0, 0], [1, 3]] };
const SCHOOL: GapAxis = { path: 'stats.school', enum: ['abjuration', 'evocation'] };

describe('countBuckets', () => {
  it('counts one-axis numeric bins, inclusive at both ends', () => {
    const records = [0.125, 1, 2, 4, 4, 7].map((cr) => rec('creature', { 'stats.cr': cr }));
    expect(countBuckets([CR], records)).toEqual([
      { label: 'stats.cr=0..1', count: 2 },
      { label: 'stats.cr=2..4', count: 3 },
      { label: 'stats.cr=5..10', count: 1 },
    ]);
  });

  it('counts a categorical axis, ignoring values it does not list', () => {
    const records = ['rare', 'rare', 'artifact'].map((r) => rec('magic-item', { 'stats.rarity': r }));
    expect(countBuckets([RARITY], records)).toEqual([
      { label: 'stats.rarity=common', count: 0 },
      { label: 'stats.rarity=rare', count: 2 },
    ]);
  });

  it('crosses two axes in axis order, first axis outermost', () => {
    const records = [
      rec('spell', { 'stats.level': 0, 'stats.school': 'evocation' }),
      rec('spell', { 'stats.level': 2, 'stats.school': 'evocation' }),
      rec('spell', { 'stats.level': 3, 'stats.school': 'evocation' }),
    ];
    expect(countBuckets([LEVEL, SCHOOL], records)).toEqual([
      { label: 'stats.level=0..0&stats.school=abjuration', count: 0 },
      { label: 'stats.level=0..0&stats.school=evocation', count: 1 },
      { label: 'stats.level=1..3&stats.school=abjuration', count: 0 },
      { label: 'stats.level=1..3&stats.school=evocation', count: 2 },
    ]);
  });

  it('counts an entry with no value on an axis in no bucket', () => {
    const records = [rec('spell', { 'stats.level': 1 }), rec('spell', { 'stats.school': 'evocation' }), rec('spell', {})];
    expect(countBuckets([LEVEL, SCHOOL], records).every((b) => b.count === 0)).toBe(true);
    expect(countBuckets([CR], [rec('creature', { 'stats.cr': null })]).every((b) => b.count === 0)).toBe(true);
  });

  it('counts an array value in each bucket it holds', () => {
    const records = [rec('magic-item', { 'stats.rarity': ['common', 'rare'] })];
    expect(countBuckets([RARITY], records).map((b) => b.count)).toEqual([1, 1]);
  });

  it('has no buckets without axes', () => {
    expect(countBuckets([], [rec('creature', {})])).toEqual([]);
  });
});
