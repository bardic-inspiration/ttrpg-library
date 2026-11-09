import { describe, expect, it } from 'vitest';
import {
  checkManifest,
  coverage,
  formatReport,
  loadEntryHeads,
  loadManifest,
  loadRuleHeads,
  loadRulesTypes,
  rulesCoverage,
  type EntryHead,
  type Manifest,
  type RuleHead,
} from '../scripts/srd-coverage/coverage.ts';
import { loadRegistry, PROJECT_ROOT } from '../scripts/validate/schema.ts';

// docs/content-model.md#srd-manifest-and-coverage (SRD manifest and coverage); issue #130.
const R = 'dnd-5e-2024';
const TYPES = ['creature', 'item', 'spell'];

const manifest = (): Manifest => ({
  ruleset: R,
  source: 'docs/SRD_CC_v5.2.pdf',
  entries: [
    { type: 'creature', name: 'Lich', tier: 'complex' },
    { type: 'creature', name: 'Wolf', tier: 'simple' },
    { type: 'creature', name: 'Ogre', tier: 'simple' },
    { type: 'spell', name: 'Shield', tier: 'complex' },
    { type: 'spell', name: 'Light', tier: 'simple' },
  ],
});

const srd = (type: string, name: string): EntryHead => ({ type, name, srd: true });

describe('coverage', () => {
  it('matches SRD entries by type and exact name', () => {
    const result = coverage(manifest(), [srd('creature', 'Wolf'), srd('spell', 'Shield')]);
    const missing = result.groups.flatMap((g) => g.missing.map((r) => r.name));
    expect(missing).toEqual(['Lich', 'Ogre', 'Light']);
    expect(result.unlisted).toEqual([]);
  });

  it('ignores custom entries, and a name under the wrong type or case does not match', () => {
    const result = coverage(manifest(), [
      { type: 'creature', name: 'Wolf', srd: false },
      srd('spell', 'Wolf'),
      srd('creature', 'ogre'),
    ]);
    expect(result.groups.find((g) => g.type === 'creature' && g.tier === 'simple')?.missing.map((r) => r.name)).toEqual([
      'Wolf',
      'Ogre',
    ]);
    expect(result.unlisted).toEqual([srd('spell', 'Wolf'), srd('creature', 'ogre')]);
  });

  it('groups by type in manifest order, complex before simple, with counts', () => {
    const result = coverage(manifest(), [srd('creature', 'Wolf')]);
    expect(result.groups.map((g) => [g.type, g.tier, g.missing.length, g.total])).toEqual([
      ['creature', 'complex', 1, 1],
      ['creature', 'simple', 1, 2],
      ['spell', 'complex', 1, 1],
      ['spell', 'simple', 1, 1],
    ]);
  });

  it('filters by type and tier', () => {
    const byType = coverage(manifest(), [], { type: 'spell' });
    expect(byType.groups.map((g) => `${g.type} ${g.tier}`)).toEqual(['spell complex', 'spell simple']);
    const byTier = coverage(manifest(), [], { tier: 'simple' });
    expect(byTier.groups.map((g) => `${g.type} ${g.tier}`)).toEqual(['creature simple', 'spell simple']);
    const both = coverage(manifest(), [], { type: 'creature', tier: 'complex' });
    expect(both.groups.flatMap((g) => g.missing.map((r) => r.name))).toEqual(['Lich']);
  });

  it('reports SRD entries not in the manifest, limited to the filtered type', () => {
    const entries = [srd('creature', 'Cinder Wolf'), srd('spell', 'Lite')];
    expect(coverage(manifest(), entries).unlisted).toEqual(entries);
    expect(coverage(manifest(), entries, { type: 'spell' }).unlisted).toEqual([srd('spell', 'Lite')]);
  });

  it('formats counts, missing names, and unlisted entries', () => {
    const report = formatReport(coverage(manifest(), [srd('creature', 'Wolf'), srd('spell', 'Lite')]));
    expect(report).toContain('4 of 5 SRD records missing.');
    expect(report).toContain('creature simple: 1 missing of 2\n  Ogre');
    expect(report).toContain('1 SRD entries not in the manifest:\n  spell Lite');
    expect(formatReport(coverage(manifest(), []))).toContain('Every SRD entry is in the manifest.');
  });
});

// docs/content-model.md#srd-manifest-and-coverage: the rules data's primitives and groups, tierless.
const RULES_TYPES = ['condition', 'equipment'];
const withRules = (): Manifest => ({
  ...manifest(),
  rules: [
    { type: 'condition', name: 'Blinded' },
    { type: 'condition', name: 'Prone' },
    { type: 'equipment', name: 'Shield' },
    { type: 'equipment', name: 'Shields', group: true },
  ],
});
const rule = (type: string, name: string, group?: true): RuleHead => ({ type, name, ...(group ? { group } : {}) });

describe('rules coverage', () => {
  it('matches primitives and groups by type, exact name, and kind, and reports any the manifest lacks', () => {
    const result = rulesCoverage(withRules(), [rule('condition', 'Prone'), rule('equipment', 'Shield'), rule('equipment', 'Shields'), rule('condition', 'Dazed')]);
    expect(result.groups.map((g) => [g.type, g.missing.map((r) => r.name), g.total])).toEqual([
      ['condition', ['Blinded'], 2],
      ['equipment', ['Shields'], 2],
    ]);
    // "Shields" exists only as a primitive here, so the group record is missing and the primitive unlisted.
    expect(result.unlisted).toEqual([rule('equipment', 'Shields'), rule('condition', 'Dazed')]);
  });

  it('filters by type', () => {
    expect(rulesCoverage(withRules(), [], { type: 'equipment' }).groups.map((g) => g.type)).toEqual(['equipment']);
  });

  it('is part of the report', () => {
    const report = formatReport(coverage(withRules(), []), rulesCoverage(withRules(), [rule('condition', 'Prone')]));
    expect(report).toContain('condition rules: 1 missing of 2\n  Blinded');
    expect(report).toContain('equipment rules: 2 missing of 2\n  Shield\n  Shields (group)');
  });
});

describe('checkManifest', () => {
  it('accepts rules records of the ruleset\'s rules types, without a tier', () => {
    expect(checkManifest(withRules(), R, TYPES, RULES_TYPES)).toEqual([]);
  });

  it('rejects a rules record of an unknown rules type, with a tier, or duplicated', () => {
    const bad = withRules();
    bad.rules!.push(
      { type: 'spell', name: 'Bless' },
      { type: 'condition', name: 'Dazed', tier: 'simple' } as never,
      { type: 'condition', name: 'Prone' },
    );
    expect(checkManifest(bad, R, TYPES, RULES_TYPES)).toEqual([
      expect.stringMatching(/^rules\[4\]: type "spell" is not a rules type/),
      expect.stringMatching(/^rules\[5\]: a rules record has no tier/),
      expect.stringMatching(/^rules\[6\]: duplicate condition "Prone"/),
    ]);
  });

  it('accepts a valid manifest', () => {
    expect(checkManifest(manifest(), R, TYPES)).toEqual([]);
  });

  it('rejects a wrong ruleset, unknown type, bad tier, padded name, and duplicate', () => {
    const bad = manifest();
    bad.ruleset = 'other';
    bad.entries.push(
      { type: 'trap', name: 'Pit', tier: 'simple' },
      { type: 'spell', name: 'Aid', tier: 'hard' as 'simple' },
      { type: 'spell', name: ' Bless', tier: 'simple' },
      { type: 'spell', name: 'Light', tier: 'complex' },
    );
    const problems = checkManifest(bad, R, TYPES);
    expect(problems).toEqual([
      expect.stringMatching(/^ruleset/),
      expect.stringMatching(/type "trap"/),
      expect.stringMatching(/tier/),
      expect.stringMatching(/name/),
      expect.stringMatching(/duplicate spell "Light"/),
    ]);
  });
});

describe(`rulesets/${R}/srd-manifest.json`, () => {
  it('is valid and lists every SRD 5.2 spell, magic item, and creature', async () => {
    const file = await loadManifest(PROJECT_ROOT, R);
    const types = Object.keys((await loadRegistry())[R]!.types);
    expect(checkManifest(file, R, types, await loadRulesTypes(PROJECT_ROOT, R))).toEqual([]);
    const count = (type: string) => file.entries.filter((r) => r.type === type).length;
    expect({ creature: count('creature'), 'item': count('item'), spell: count('spell') }).toEqual({
      creature: 329,
      'item': 243,
      spell: 339,
    });
  });

  it('lists every SRD primitive and equipment group, and the rules data holds every one', async () => {
    const file = await loadManifest(PROJECT_ROOT, R);
    const count = (type: string, group = false) => (file.rules ?? []).filter((r) => r.type === type && (r.group === true) === group).length;
    expect({
      glossary: count('glossary'),
      condition: count('condition'),
      equipment: count('equipment'),
      groups: count('equipment', true),
      'weapon-property': count('weapon-property'),
      'mastery-property': count('mastery-property'),
    }).toEqual({ glossary: 140, condition: 15, equipment: 180, groups: 22, 'weapon-property': 10, 'mastery-property': 8 });
    const result = rulesCoverage(file, await loadRuleHeads(PROJECT_ROOT, R));
    expect(result.groups.flatMap((g) => g.missing)).toEqual([]);
    expect(result.unlisted).toEqual([]);
  });

  it('covers every SRD entry in the library', async () => {
    const entries = await loadEntryHeads(PROJECT_ROOT, R);
    const result = coverage(await loadManifest(PROJECT_ROOT, R), entries);
    expect(result.unlisted).toEqual([]);
    const missing = result.groups.reduce((n, g) => n + g.missing.length, 0);
    const total = result.groups.reduce((n, g) => n + g.total, 0);
    expect(total - missing).toBe(entries.filter((e) => e.srd).length);
  });
});
