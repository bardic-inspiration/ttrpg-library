import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyDefaults, checkDefaults, loadDefaults, type Defaults } from '../scripts/generate/defaults.ts';
import { loadRegistry } from '../scripts/validate/schema.ts';

// SPEC.md §8.3 (Defaults); issue #61.
const ROOT = join(import.meta.dirname, '..');

const base = (): Defaults => ({
  ruleset: 'dnd-5e-2024',
  count: 5,
  maxBatch: 10,
  tags: {},
  gapFill: { enabled: true, count: 3 },
  validateRetries: 3,
});

describe('config/defaults.json', () => {
  it('matches the §8.3 example', async () => {
    const file = JSON.parse(await readFile(join(ROOT, 'config/defaults.json'), 'utf8'));
    expect(file).toEqual(base());
  });

  it('passes its own checks and loads', async () => {
    const registry = await loadRegistry();
    expect(checkDefaults(await loadDefaults(), registry)).toEqual([]);
  });
});

describe('checkDefaults', () => {
  const registry = { 'dnd-5e-2024': { types: { creature: {} } } };

  it('accepts the base defaults', () => {
    expect(checkDefaults(base(), registry)).toEqual([]);
  });

  it('rejects a missing or unknown key', () => {
    const { validateRetries: _, ...missing } = base();
    expect(checkDefaults(missing, registry)).toContainEqual(expect.stringMatching(/validateRetries/));
    expect(checkDefaults({ ...base(), extra: 1 }, registry)).toContainEqual(expect.stringMatching(/extra/));
  });

  it('rejects a ruleset the registry does not know', () => {
    expect(checkDefaults({ ...base(), ruleset: 'nope' }, registry)).toContainEqual(expect.stringMatching(/ruleset/));
  });

  it('requires whole-number counts within maxBatch', () => {
    expect(checkDefaults({ ...base(), count: 0 }, registry)).toContainEqual(expect.stringMatching(/^count/));
    expect(checkDefaults({ ...base(), count: 11 }, registry)).toContainEqual(expect.stringMatching(/^count/));
    expect(checkDefaults({ ...base(), count: 2.5 }, registry)).toContainEqual(expect.stringMatching(/^count/));
    expect(checkDefaults({ ...base(), maxBatch: 0 }, registry)).toContainEqual(expect.stringMatching(/^maxBatch/));
    expect(checkDefaults({ ...base(), gapFill: { enabled: true, count: 11 } }, registry)).toContainEqual(
      expect.stringMatching(/^gapFill\.count/),
    );
    expect(checkDefaults({ ...base(), validateRetries: -1 }, registry)).toContainEqual(
      expect.stringMatching(/^validateRetries/),
    );
  });

  it('rejects a non-boolean gapFill.enabled', () => {
    expect(checkDefaults({ ...base(), gapFill: { enabled: 'yes', count: 3 } }, registry)).toContainEqual(
      expect.stringMatching(/^gapFill\.enabled/),
    );
  });

  it('applies the §5.3 tag rules to default tags', () => {
    expect(checkDefaults({ ...base(), tags: { world: 'Aldmere', themes: ['frost'] } }, registry)).toEqual([]);
    expect(checkDefaults({ ...base(), tags: { World: 'x' } }, registry)).toContainEqual(expect.stringMatching(/tags/));
    expect(checkDefaults({ ...base(), tags: { world: { a: 1 } } }, registry)).toContainEqual(
      expect.stringMatching(/tags/),
    );
  });
});

describe('applyDefaults', () => {
  it('fills only the fields the request leaves out', () => {
    expect(applyDefaults({ type: 'spell', brief: 'frost magic' }, base())).toEqual({
      type: 'spell',
      brief: 'frost magic',
      ruleset: 'dnd-5e-2024',
      count: 5,
      tags: {},
    });
  });

  it('keeps fields the request gives', () => {
    const request = applyDefaults({ type: 'creature', count: 2, ruleset: 'other' }, base());
    expect(request.count).toBe(2);
    expect(request.ruleset).toBe('other');
  });

  it('merges request tags over default tags', () => {
    const defaults = { ...base(), tags: { world: 'Aldmere', author: 'routine' } };
    const request = applyDefaults({ type: 'creature', tags: { world: 'Vell', theme: ['ice'] } }, defaults);
    expect(request.tags).toEqual({ world: 'Vell', author: 'routine', theme: ['ice'] });
    expect(defaults.tags).toEqual({ world: 'Aldmere', author: 'routine' });
  });

  it('reduces a count above maxBatch to maxBatch', () => {
    expect(applyDefaults({ type: 'creature', count: 10 }, base()).count).toBe(10);
    expect(applyDefaults({ type: 'creature', count: 11 }, base()).count).toBe(10);
    expect(applyDefaults({ type: 'creature', count: 10_000_000_000 }, base()).count).toBe(10);
  });
});
