import { describe, expect, it } from 'vitest';
import {
  checkManifest,
  componentCoverage,
  coverage,
  formatReport,
  loadComponentHeads,
  loadComponentTypes,
  loadEntryHeads,
  loadManifest,
  loadRuleHeads,
  loadRulesTypes,
  rulesCoverage,
  type ComponentHead,
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

// Components are listed by parent, without tiers, and a name printed twice is listed twice (docs/content-model.md#components).
const withComponents = (): Manifest => ({
  ...manifest(),
  components: [
    { type: 'class-feature', name: 'Rage', parent: 'class/barbarian' },
    { type: 'class-feature', name: 'Improved Brutal Strike', parent: 'class/barbarian' },
    { type: 'class-feature', name: 'Improved Brutal Strike', parent: 'class/barbarian' },
    { type: 'class-feature', name: 'Frenzy', parent: 'subclass/path-of-the-berserker' },
    { type: 'species-trait', name: 'Darkvision', parent: 'species/dwarf' },
  ],
});
const COMPONENT_TYPES = [
  { type: 'class-feature', parents: ['class', 'subclass'] },
  { type: 'species-trait', parents: ['species'] },
];
const component = (type: string, name: string, parent: string): ComponentHead => ({ type, name, parent });

describe('component coverage', () => {
  it('matches components by type, exact name, and parent, counting a name printed twice', () => {
    const result = componentCoverage(withComponents(), [
      component('class-feature', 'Improved Brutal Strike', 'class/barbarian'),
      component('class-feature', 'Frenzy', 'subclass/path-of-the-berserker'),
      component('species-trait', 'Darkvision', 'species/elf'),
    ]);
    expect(result.groups.map((g) => [g.type, g.missing.map((r) => `${r.parent} ${r.name}`), g.total])).toEqual([
      ['class-feature', ['class/barbarian Rage', 'class/barbarian Improved Brutal Strike'], 4],
      ['species-trait', ['species/dwarf Darkvision'], 1],
    ]);
    // The Elf's Darkvision has no record: the Dwarf's is another parent's.
    expect(result.unlisted).toEqual([component('species-trait', 'Darkvision', 'species/elf')]);
  });

  it('reports a third printing of a name listed twice as unlisted', () => {
    const twice = component('class-feature', 'Improved Brutal Strike', 'class/barbarian');
    expect(componentCoverage(withComponents(), [twice, twice, twice]).unlisted).toEqual([twice]);
  });

  it('filters by type and is part of the report', () => {
    expect(componentCoverage(withComponents(), [], { type: 'species-trait' }).groups.map((g) => g.type)).toEqual(['species-trait']);
    const report = formatReport(coverage(withComponents(), []), undefined, componentCoverage(withComponents(), []));
    expect(report).toContain('5 of 5 SRD component records missing.');
    expect(report).toContain('species-trait: 1 missing of 1\n  species/dwarf › Darkvision');
  });
});

describe('checkManifest', () => {
  it('accepts component records of the ruleset\'s component types, with a parent of an allowed type', () => {
    expect(checkManifest(withComponents(), R, TYPES, [], COMPONENT_TYPES)).toEqual([]);
  });

  it('rejects a component record of an unknown type, with a tier, without a parent key, or under a parent type it can\'t have', () => {
    const bad = withComponents();
    bad.components!.push(
      { type: 'spell', name: 'Bless', parent: 'class/cleric' },
      { type: 'species-trait', name: 'Luck', parent: 'species/halfling', tier: 'simple' } as never,
      { type: 'species-trait', name: 'Brave', parent: 'Halfling' },
      { type: 'species-trait', name: 'Trance', parent: 'class/elf' },
    );
    expect(checkManifest(bad, R, TYPES, [], COMPONENT_TYPES)).toEqual([
      expect.stringMatching(/^components\[5\]: type "spell" is not a component type/),
      expect.stringMatching(/^components\[6\]: a component record has no tier/),
      expect.stringMatching(/^components\[7\]: parent must be a key/),
      expect.stringMatching(/^components\[8\]: a species-trait has no class parent/),
    ]);
  });

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
  it('is valid and lists every SRD 5.2 entry of each type', async () => {
    const file = await loadManifest(PROJECT_ROOT, R);
    const types = Object.keys((await loadRegistry())[R]!.types);
    expect(checkManifest(file, R, types, await loadRulesTypes(PROJECT_ROOT, R), await loadComponentTypes(PROJECT_ROOT, R))).toEqual([]);
    const count = (type: string, tier?: string) => file.entries.filter((r) => r.type === type && (!tier || r.tier === tier)).length;
    expect({
      creature: count('creature'),
      'item': count('item'),
      spell: count('spell'),
      feat: count('feat', 'simple'),
      background: count('background', 'simple'),
      species: count('species', 'complex'),
      class: count('class', 'complex'),
      subclass: count('subclass', 'complex'),
    }).toEqual({ creature: 329, 'item': 243, spell: 339, feat: 17, background: 4, species: 9, class: 12, subclass: 12 });
  });

  it('lists every SRD class feature, class option, and species trait by parent', async () => {
    const file = await loadManifest(PROJECT_ROOT, R);
    const count = (type: string) => (file.components ?? []).filter((r) => r.type === type).length;
    expect({ 'class-feature': count('class-feature'), 'class-option': count('class-option'), 'species-trait': count('species-trait') }).toEqual({
      'class-feature': 232,
      'class-option': 38,
      'species-trait': 33,
    });
    const parents = new Set(file.entries.filter((r) => ['class', 'subclass', 'species'].includes(r.type)).map((r) => `${r.type}/${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`));
    expect((file.components ?? []).filter((c) => !parents.has(c.parent))).toEqual([]);
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
    expect(componentCoverage(await loadManifest(PROJECT_ROOT, R), await loadComponentHeads(PROJECT_ROOT, R)).unlisted).toEqual([]);
  });
});
