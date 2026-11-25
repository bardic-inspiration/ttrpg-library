import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyDefaults, checkDefaults, loadDefaults, type Defaults } from '../scripts/generate/defaults.ts';
import { loadRegistry } from '../scripts/validate/schema.ts';

// docs/generation.md#defaults (Defaults); issue #61.
const ROOT = join(import.meta.dirname, '..');

const base = (): Defaults => ({
  ruleset: 'dnd-5e-2024',
  count: 5,
  author: 'bardic-inspiration',
  gapFill: { enabled: true, count: 3 },
  validateRetries: 3,
});

describe('config/defaults.json', () => {
  it('matches the defaults docs/generation.md#defaults describes, apart from whether gap fill is on', async () => {
    const file = JSON.parse(await readFile(join(ROOT, 'config/defaults.json'), 'utf8'));
    const expected = base();
    expected.gapFill.enabled = file.gapFill?.enabled;
    expect(file).toEqual(expected);
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

  it('requires whole-number counts of at least 1, with no upper limit', () => {
    expect(checkDefaults({ ...base(), count: 0 }, registry)).toContainEqual(expect.stringMatching(/^count/));
    expect(checkDefaults({ ...base(), count: 2.5 }, registry)).toContainEqual(expect.stringMatching(/^count/));
    expect(checkDefaults({ ...base(), count: 500 }, registry)).toEqual([]);
    expect(checkDefaults({ ...base(), gapFill: { enabled: true, count: 0 } }, registry)).toContainEqual(
      expect.stringMatching(/^gapFill\.count/),
    );
    expect(checkDefaults({ ...base(), gapFill: { enabled: true, count: 50 } }, registry)).toEqual([]);
    expect(checkDefaults({ ...base(), maxBatch: 10 }, registry)).toContainEqual('maxBatch: unknown key');
    expect(checkDefaults({ ...base(), validateRetries: -1 }, registry)).toContainEqual(
      expect.stringMatching(/^validateRetries/),
    );
  });

  it('rejects a non-boolean gapFill.enabled', () => {
    expect(checkDefaults({ ...base(), gapFill: { enabled: 'yes', count: 3 } }, registry)).toContainEqual(
      expect.stringMatching(/^gapFill\.enabled/),
    );
  });

  it('rejects default tags, since entries have none', () => {
    expect(checkDefaults({ ...base(), tags: {} }, registry)).toEqual(['tags: unknown key']);
  });

  it('requires an author other than "publisher", and takes an optional source', () => {
    const { author: _, ...missing } = base();
    expect(checkDefaults(missing, registry)).toContainEqual('author: missing');
    expect(checkDefaults({ ...base(), author: 'publisher' }, registry)).toContainEqual(expect.stringMatching(/^author:/));
    expect(checkDefaults({ ...base(), author: '' }, registry)).toContainEqual(expect.stringMatching(/^author:/));
    expect(checkDefaults({ ...base(), source: 'Ember Codex' }, registry)).toEqual([]);
    expect(checkDefaults({ ...base(), source: '' }, registry)).toContainEqual(expect.stringMatching(/^source:/));
  });
});

describe('applyDefaults', () => {
  it('fills only the fields the request leaves out', () => {
    expect(applyDefaults({ type: 'spell', brief: 'frost magic' }, base())).toEqual({
      type: 'spell',
      brief: 'frost magic',
      ruleset: 'dnd-5e-2024',
      count: 5,
      author: 'bardic-inspiration',
    });
  });

  it('keeps fields the request gives', () => {
    const request = applyDefaults({ type: 'creature', count: 2, ruleset: 'other' }, base());
    expect(request.count).toBe(2);
    expect(request.ruleset).toBe('other');
  });

  it('takes a request\'s source and author over the defaults', () => {
    const request = applyDefaults({ type: 'spell', source: 'Ember Codex', author: 'A. Author' }, { ...base(), source: 'Default Book' });
    expect(request).toMatchObject({ source: 'Ember Codex', author: 'A. Author' });
    expect(applyDefaults({ type: 'spell' }, { ...base(), source: 'Default Book' }).source).toBe('Default Book');
    expect(applyDefaults({ type: 'spell' }, base())).not.toHaveProperty('source');
  });

  it('takes any count as given, with no batch size limit', () => {
    expect(applyDefaults({ type: 'creature', count: 11 }, base()).count).toBe(11);
    expect(applyDefaults({ type: 'spell', count: 300 }, base()).count).toBe(300);
  });
});
