// Rules data in the validator (docs/rulesets.md#rules-data): primitives and groups as link
// targets, extensions, the key space, and rules pages, on the fixture ruleset.
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { brokenFixture, fixtureJson, validateFixture } from './fixture.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Validates a copy of the fixture with `changes`, returning its error messages as `file: message`. */
async function errorsWith(changes: Record<string, unknown | null>): Promise<string[]> {
  const root = await brokenFixture(changes);
  temps.push(root);
  const result = await validateFixture(root);
  return result.errors.map((e) => `${e.file}: ${e.message}`);
}

const NOTE = 'content/fixture-rules/note/field-notes.json';
const MALLET = 'content/fixture-rules/gear/mallet.json';
const PAGES = 'rulesets/fixture-rules/rules/pages.json';

describe('the fixture ruleset', () => {
  it('validates, with its rules data', async () => {
    const result = await validateFixture();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    const [data] = result.rules;
    expect(data?.ruleset).toBe('fixture-rules');
    expect(data?.primitives.map((p) => `${p.type}/${p.id}`).sort()).toEqual(['gear/hammer', 'gear/ladder', 'term/advantage', 'term/disadvantage']);
    expect(data?.groups.get('gear')?.groups.map((g) => g.id)).toEqual(['tools', 'hand-tools', 'big-tools', 'any-tools']);
    expect(data?.pages.map((p) => p.id)).toEqual(['glossary', 'tools']);
  });

  it('resolves links to a primitive, a group, and an extension, from tokens and ref objects', async () => {
    const result = await validateFixture();
    const note = result.entries.find((e) => e.entry.id === 'field-notes')!;
    expect(note.refs).toEqual([
      { path: 'stats.text', key: 'gear/hammer' },
      { path: 'stats.text', key: 'term/advantage' },
      { path: 'stats.text', key: 'gear/hand-tools' },
      { path: 'stats.text', key: 'gear/mallet' },
      { path: 'stats.gear[0]', key: 'gear/ladder' },
    ]);
    const mallet = result.entries.find((e) => e.entry.id === 'mallet')!;
    expect(mallet.refBy).toEqual([{ path: 'stats.text', key: 'note/field-notes' }]);
  });
});

describe('links to rules', () => {
  it('fail on a missing primitive, from a token or a ref object', async () => {
    const note = await fixtureJson(NOTE);
    note.stats.text = 'See {ref:term/inspiration}.';
    note.stats.gear = [{ ref: 'gear/rope' }];
    const errors = await errorsWith({ [NOTE]: note });
    expect(errors).toContain(`fixture-rules/note/field-notes.json: stats.text: ref "term/inspiration" does not resolve: no term has id "inspiration"`);
    expect(errors).toContain(`fixture-rules/note/field-notes.json: stats.gear[0]: ref "gear/rope" does not resolve: no gear has id "rope"`);
  });

  it('fail on a missing target in a primitive’s or a group’s text', async () => {
    const term = await fixtureJson('rulesets/fixture-rules/rules/term/advantage.json');
    term.stats.text = 'See also {ref:term/luck}.';
    const groups = await fixtureJson('rulesets/fixture-rules/rules/gear-groups.json');
    groups[0].text = 'Like a {ref:gear/saw}.';
    const errors = await errorsWith({ 'rulesets/fixture-rules/rules/term/advantage.json': term, 'rulesets/fixture-rules/rules/gear-groups.json': groups });
    expect(errors).toContain('rulesets/fixture-rules/rules/term/advantage.json: stats.text: ref "term/luck" does not resolve: no term has id "luck"');
    expect(errors).toContain('rulesets/fixture-rules/rules/gear-groups.json: tools.text: ref "gear/saw" does not resolve: no gear has id "saw"');
  });
});

describe('primitives', () => {
  it('validate against their type schema and the primitive file schema', async () => {
    const errors = await errorsWith({
      'rulesets/fixture-rules/rules/term/advantage.json': { type: 'term', id: 'advantage', name: 'Advantage', stats: {} },
      'rulesets/fixture-rules/rules/term/luck.json': { type: 'term', id: 'luck', name: 'Luck', summary: 'Extra key.', stats: { text: 'Luck.' } },
    });
    expect(errors).toContain('rulesets/fixture-rules/rules/term/advantage.json: stats: missing required key "text"');
    expect(errors).toContain('rulesets/fixture-rules/rules/term/luck.json: summary: unknown key');
  });

  it('must sit at rules/<type>/<id>.json', async () => {
    const errors = await errorsWith({ 'rulesets/fixture-rules/rules/term/lucky.json': { type: 'term', id: 'luck', name: 'Luck', stats: { text: 'Luck.' } } });
    expect(errors).toContain('rulesets/fixture-rules/rules/term/lucky.json: file path must be rulesets/fixture-rules/rules/term/luck.json to match type and id');
  });

  it('take text checks: the markdown subset and tokens only in text', async () => {
    const errors = await errorsWith({
      'rulesets/fixture-rules/rules/term/luck.json': { type: 'term', id: 'luck', name: 'Luck {ref:term/advantage}', stats: { text: '# Heading' } },
    });
    expect(errors.some((e) => e.startsWith('rulesets/fixture-rules/rules/term/luck.json: stats.text:'))).toBe(true);
    expect(errors).toContain('rulesets/fixture-rules/rules/term/luck.json: name: a {ref:…} token works only in text fields (rules text and description)');
  });

  it('name a leaf group of their type', async () => {
    const errors = await errorsWith({
      'rulesets/fixture-rules/rules/gear/hammer.json': { type: 'gear', id: 'hammer', name: 'Hammer', stats: { group: 'tools', text: 'A Hammer.' } },
      'rulesets/fixture-rules/rules/gear/ladder.json': { type: 'gear', id: 'ladder', name: 'Ladder', stats: { group: 'ropes', text: 'A Ladder.' } },
    });
    expect(errors).toContain('rulesets/fixture-rules/rules/gear/hammer.json: stats.group: "tools" has groups in it; name a group with none');
    expect(errors).toContain('rulesets/fixture-rules/rules/gear/ladder.json: stats.group: "ropes" is not a gear group');
  });
});

describe('groups', () => {
  it('check parents, unions, and loops', async () => {
    const errors = await errorsWith({
      'rulesets/fixture-rules/rules/gear-groups.json': [
        { id: 'tools', name: 'Tools', parent: 'kit' },
        { id: 'hand-tools', name: 'Hand Tools', parent: 'big-tools' },
        { id: 'big-tools', name: 'Big Tools', parent: 'hand-tools' },
        { id: 'any-tools', name: 'Any Tools', union: ['hand-tools', 'saws'] },
      ],
    });
    const file = 'rulesets/fixture-rules/rules/gear-groups.json';
    expect(errors).toContain(`${file}: tools: parent "kit" is not a gear group`);
    expect(errors).toContain(`${file}: hand-tools: its parents loop back to it`);
    expect(errors).toContain(`${file}: any-tools: union names "saws", which is not a gear group`);
  });
});

describe('the key space (docs/rulesets.md#rules-data)', () => {
  it('is shared by primitives, groups, and extensions, for ids and names', async () => {
    const mallet = await fixtureJson(MALLET);
    const errors = await errorsWith({
      'content/fixture-rules/gear/hammer.json': { ...mallet, id: 'hammer', name: 'Claw Hammer' },
      'content/fixture-rules/gear/hand-tools.json': { ...mallet, id: 'hand-tools', name: 'Hand Tool Kit' },
      'content/fixture-rules/gear/ladder-two.json': { ...mallet, id: 'ladder-two', name: 'ladder' },
    });
    expect(errors).toContain('fixture-rules/gear/hammer.json: id "hammer" is already used by rulesets/fixture-rules/rules/gear/hammer.json');
    expect(errors).toContain('fixture-rules/gear/hand-tools.json: id "hand-tools" is already used by rulesets/fixture-rules/rules/gear-groups.json');
    expect(errors).toContain('fixture-rules/gear/ladder-two.json: name "ladder" is already used by rulesets/fixture-rules/rules/gear/ladder.json');
  });
});

describe('extensions', () => {
  it('are custom: an SRD marker is an error', async () => {
    const mallet = await fixtureJson(MALLET);
    mallet.meta.source.srd = true;
    expect(await errorsWith({ [MALLET]: mallet })).toContain(
      'fixture-rules/gear/mallet.json: meta.source.srd: an extension is custom; the SRD rules are kept in the ruleset as primitives',
    );
  });

  it('exist only for a rules type that takes them', async () => {
    const mallet = await fixtureJson(MALLET);
    const errors = await errorsWith({
      'content/fixture-rules/term/luck.json': { ...mallet, type: 'term', id: 'luck', name: 'Luck', stats: { text: 'Luck.' } },
    });
    expect(errors).toContain(
      'fixture-rules/term/luck.json: type: "term" is a rules type that takes no extensions; its rules are kept in rulesets/fixture-rules/rules/',
    );
  });

  it('name a leaf group, as primitives do', async () => {
    const mallet = await fixtureJson(MALLET);
    mallet.stats.group = 'any-tools';
    expect(await errorsWith({ [MALLET]: mallet })).toContain('fixture-rules/gear/mallet.json: stats.group: "any-tools" has groups in it; name a group with none');
  });
});

describe('rules pages', () => {
  it('place every primitive and group exactly once', async () => {
    const pages = await fixtureJson(PAGES);
    pages[0].blocks.push({ kind: 'group', group: 'gear/hand-tools' });
    pages[1].blocks = [{ kind: 'group', group: 'gear/big-tools' }];
    const errors = await errorsWith({ [PAGES]: pages });
    expect(errors).toContain(`${PAGES}: gear/tools appears on no page; add a block that shows it`);
    expect(errors).toContain(`${PAGES}: gear/any-tools appears on no page; add a block that shows it`);
    // The Hammer sits in Hand Tools, placed on the glossary page; the Ladder in Big Tools, on the tools page.
    expect(errors.filter((e) => /gear\/(hammer|ladder) appears/.test(e))).toEqual([]);
    const twice = await fixtureJson(PAGES);
    twice[1].blocks.push({ kind: 'group', group: 'gear/hand-tools' });
    expect(await errorsWith({ [PAGES]: twice })).toContain(`${PAGES}: gear/hand-tools appears on more than one page: tools, tools`);
  });

  it('name known types and groups, and leave the Extensions page’s id free', async () => {
    const pages = await fixtureJson(PAGES);
    pages.push({ id: 'extensions', title: 'Mine', blocks: [{ kind: 'prose', title: 'Hi', text: 'Hello.' }] });
    expect((await errorsWith({ [PAGES]: pages })).some((e) => e.startsWith(`${PAGES}: [6]`) || e.startsWith(`${PAGES}: [2].id`))).toBe(true);
    const bad = await fixtureJson(PAGES);
    bad[1].blocks.push({ kind: 'group', group: 'gear/saws' }, { kind: 'primitives', type: 'spell' }, { kind: 'primitives', type: 'gear' });
    const errors = await errorsWith({ [PAGES]: bad });
    expect(errors).toContain(`${PAGES}: tools: "gear/saws" is not a group`);
    expect(errors).toContain(`${PAGES}: tools: "spell" is not a rules type of this ruleset`);
    expect(errors).toContain(`${PAGES}: tools: "gear" has groups; show it with group blocks`);
  });

  it('cross-list only other rules types, without placing them', async () => {
    const pages = await fixtureJson(PAGES);
    pages[0].blocks[1].crossList = ['gear', 'spell', 'term'];
    const errors = await errorsWith({ [PAGES]: pages });
    expect(errors).toContain(`${PAGES}: glossary: cross-listed "spell" is not a rules type of this ruleset`);
    expect(errors).toContain(`${PAGES}: glossary: "term" can't be cross-listed among its own primitives`);
    expect(errors.filter((e) => e.includes('more than one page'))).toEqual([]);
  });

  it('must exist when there are primitives', async () => {
    expect(await errorsWith({ [PAGES]: null })).toContain(`${PAGES}: missing: every primitive and group must appear on a rules page`);
  });
});
