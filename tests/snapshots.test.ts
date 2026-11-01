import { describe, expect, it } from 'vitest';
import { defaultLabel, isValidLabel, snapshotPages } from '../scripts/snapshots/index.ts';

const record = (ruleset: string, type: string, id: string) => ({
  id,
  ruleset,
  type,
  name: id,
  url: `/ttrpg-library/${ruleset}/${type}/${id}/`,
  facets: {},
});

describe('snapshotPages (SPEC.md §9.8)', () => {
  it('captures home, the style guide, and the first detail page of each type', () => {
    const pages = snapshotPages([
      record('dnd-5e-2024', 'creature', 'cinder-hound'),
      record('dnd-5e-2024', 'creature', 'ash-wolf'),
      record('dnd-5e-2024', 'spell', 'frost-lance'),
    ]);
    expect(pages).toEqual([
      { file: 'home', path: '' },
      { file: 'styleguide', path: 'styleguide/' },
      { file: 'dnd-5e-2024-creature', path: 'dnd-5e-2024/creature/cinder-hound/' },
      { file: 'dnd-5e-2024-spell', path: 'dnd-5e-2024/spell/frost-lance/' },
    ]);
  });

  it('keeps the same type in two rulesets apart', () => {
    const files = snapshotPages([record('a', 'spell', 'x'), record('b', 'spell', 'y')]).map((p) => p.file);
    expect(files).toEqual(['home', 'styleguide', 'a-spell', 'b-spell']);
  });

  it('captures only home and the style guide for an empty library', () => {
    expect(snapshotPages([]).map((p) => p.file)).toEqual(['home', 'styleguide']);
  });
});

describe('snapshot labels', () => {
  it('accepts a plain folder name', () => {
    for (const label of ['before', 'after-2', 'v1.2_tweak']) expect(isValidLabel(label)).toBe(true);
  });

  it('refuses anything that could leave snapshots/', () => {
    for (const label of ['', '.', '..', 'a/b', 'a\\b', '../x', '.hidden']) expect(isValidLabel(label)).toBe(false);
  });

  it('defaults to a UTC timestamp that is itself a valid label', () => {
    const label = defaultLabel(new Date('2026-11-01T09:05:03.250Z'));
    expect(label).toBe('2026-11-01T09-05-03Z');
    expect(isValidLabel(label)).toBe(true);
  });
});
