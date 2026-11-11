// Page types and components (docs/content-model.md#components), on the fixture ruleset: the
// `manual` page type lists `chapter` components, which are validated, kept out of the index,
// rendered on their parent's page, and linked at their anchors there.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../../scripts/build-index/index.ts';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, refPaths, refTargets } from '../../site/src/lib/library.ts';
import { groupPageRefs } from '../../site/src/lib/refs.ts';
import { renderMarkdown } from '../../site/src/lib/markdown.ts';
import RulesPage from '../../site/src/components/rules/RulesPage.astro';
import { brokenFixture, fixtureJson, fixtureSite, RULES_FIXTURE, validateFixture } from './fixture.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function errorsWith(changes: Record<string, unknown | null>): Promise<string[]> {
  const root = await brokenFixture(changes);
  temps.push(root);
  return (await validateFixture(root)).errors.map((e) => `${e.file}: ${e.message}`);
}

const HANDBOOK = 'content/fixture-rules/manual/handbook.json';
const BASICS = 'content/fixture-rules/chapter/handbook-basics.json';
const RULESET = 'rulesets/fixture-rules/ruleset.json';
const render = async (component: any, props: Record<string, unknown>) =>
  (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

describe('validation', () => {
  it('keeps components apart from entries, each with its parent', async () => {
    const result = await validateFixture();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.entries.map((e) => e.entry.type)).not.toContain('chapter');
    expect(result.components.map((c) => [`${c.entry.type}/${c.entry.id}`, c.parent])).toEqual([
      ['chapter/handbook-advanced', 'manual/handbook'],
      ['chapter/handbook-basics', 'manual/handbook'],
      ['chapter/pocket-guide-basics', 'manual/pocket-guide'],
    ]);
  });

  it('lets components of different parents share a name', async () => {
    const result = await validateFixture();
    expect(result.components.filter((c) => c.entry.name === 'Basics')).toHaveLength(2);
  });

  it('gives components their own envelope, with no summary', async () => {
    const basics = await fixtureJson(BASICS);
    const errors = await errorsWith({ [BASICS]: { ...basics, summary: 'A chapter with a summary.' } });
    // Like an entry that fails its envelope, it isn't a link target, so links to it fail too.
    expect(errors).toContain('fixture-rules/chapter/handbook-basics.json: summary: unknown key');
  });

  it('needs no registry entry, but a schema and a listing in ruleset.json', async () => {
    const ruleset = await fixtureJson(RULESET);
    expect(await errorsWith({ 'rulesets/fixture-rules/schemas/chapter.schema.json': null })).toContain(
      'fixture-rules/chapter/handbook-basics.json: type: component type "chapter" for fixture-rules has no schema; it needs schemas/chapter.schema.json',
    );
    const errors = await errorsWith({ [RULESET]: { ...ruleset, components: undefined } });
    expect(errors).toContain('fixture-rules/chapter/handbook-basics.json: (entry): missing required key "summary"');
  });

  it('fails on a component no parent lists, or that two parents list', async () => {
    const handbook = await fixtureJson(HANDBOOK);
    const pocket = await fixtureJson('content/fixture-rules/manual/pocket-guide.json');
    expect(await errorsWith({ [HANDBOOK]: { ...handbook, stats: { chapters: [{ ref: 'chapter/handbook-basics' }] } } })).toContain(
      'fixture-rules/chapter/handbook-advanced.json: chapter/handbook-advanced is listed by no parent; a manual lists it by ref in its stats',
    );
    pocket.stats.chapters.push({ ref: 'chapter/handbook-basics' });
    expect(await errorsWith({ 'content/fixture-rules/manual/pocket-guide.json': pocket })).toContain(
      'fixture-rules/chapter/handbook-basics.json: chapter/handbook-basics is listed by manual/handbook and manual/pocket-guide; a component has exactly one parent',
    );
  });

  it('fails on a parent of a type that may not list it, or a component listed twice', async () => {
    const ruleset = await fixtureJson(RULESET);
    expect(await errorsWith({ [RULESET]: { ...ruleset, components: [{ type: 'chapter', parents: ['note'] }] } })).toContain(
      'fixture-rules/chapter/handbook-basics.json: chapter/handbook-basics is listed by manual/handbook, but only a note may list a chapter',
    );
    const handbook = await fixtureJson(HANDBOOK);
    handbook.stats.chapters.push({ ref: 'chapter/handbook-basics' });
    expect(await errorsWith({ [HANDBOOK]: handbook })).toEqual([
      'fixture-rules/chapter/handbook-basics.json: chapter/handbook-basics is listed more than once by manual/handbook',
    ]);
  });

  it('fails on an id that doesn’t start with its parent’s, and on a repeated name in one parent', async () => {
    const handbook = await fixtureJson(HANDBOOK);
    const basics = await fixtureJson(BASICS);
    handbook.stats.chapters.push({ ref: 'chapter/basics-again' }, { ref: 'chapter/handbook-basics-17' });
    const errors = await errorsWith({
      [HANDBOOK]: handbook,
      'content/fixture-rules/chapter/basics-again.json': { ...basics, id: 'basics-again', name: 'Again' },
      'content/fixture-rules/chapter/handbook-basics-17.json': { ...basics, id: 'handbook-basics-17' },
    });
    expect(errors).toEqual(['fixture-rules/chapter/basics-again.json: id "basics-again" must start with its parent\'s id, "handbook-"']);
    const repeated = await errorsWith({
      [HANDBOOK]: { ...handbook, stats: { chapters: [...handbook.stats.chapters.slice(0, 2), { ref: 'chapter/handbook-basics-again' }] } },
      'content/fixture-rules/chapter/handbook-basics-again.json': { ...basics, id: 'handbook-basics-again' },
    });
    expect(repeated).toEqual([
      'fixture-rules/chapter/handbook-basics-again.json: name "Basics" is already used by fixture-rules/chapter/handbook-basics.json in the same parent; a name printed again at a later level adds the level to its id ("handbook-basics-17")',
    ]);
  });

  it('fails on a link to a missing component', async () => {
    const handbook = await fixtureJson(HANDBOOK);
    handbook.stats.text = 'Start with {ref:chapter/handbook-intro}.';
    expect(await errorsWith({ [HANDBOOK]: handbook })).toContain(
      'fixture-rules/manual/handbook.json: stats.text: ref "chapter/handbook-intro" does not resolve: no chapter has id "handbook-intro"',
    );
  });
});

describe('the index', () => {
  it('has no record for a component, and finds its text through its parent', async () => {
    const registry = JSON.parse(await readFile(join(RULES_FIXTURE, 'types.json'), 'utf8'));
    const { errors, records } = await buildIndex(join(RULES_FIXTURE, 'content'), { rulesetsRoot: join(RULES_FIXTURE, 'rulesets'), registry });
    expect(errors).toEqual([]);
    expect(records.map((r) => r.type)).not.toContain('chapter');
    const handbook = records.find((r) => r.id === 'handbook')!;
    expect(handbook.search).toBe('Start with Basics . Basics Carry a Hammer . Advanced Read Basics first.');
  });
});

describe('the site', async () => {
  const { all, data, module } = await fixtureSite();
  const labelFor = (type: string, path: string) => module.refLabels(type, path);
  const handbook = all.find(({ entry }) => entry.id === 'handbook')!;

  it('loads components onto their parent, in its order, and nowhere else', () => {
    expect(all.map(({ entry }) => entry.type)).not.toContain('chapter');
    expect(handbook.components?.map(({ entry }) => entry.id)).toEqual(['handbook-basics', 'handbook-advanced']);
    expect(all.find(({ entry }) => entry.id === 'field-notes')!.components).toBeUndefined();
  });

  it('links a component at its anchor on its parent’s page, named with its parent', () => {
    expect(entryNames(all, [data]).get('chapter/handbook-advanced')).toBe('Advanced');
    expect(refPaths([data], all).get('chapter/handbook-advanced')).toBe('fixture-rules/manual/handbook/#chapter-handbook-advanced');
    expect(refTargets(all, [data]).get('chapter/pocket-guide-basics')).toEqual({
      type: 'chapter',
      name: 'Pocket Guide › Basics',
      path: 'fixture-rules/manual/pocket-guide/#chapter-pocket-guide-basics',
    });
    const html = renderMarkdown('See {ref:chapter/handbook-advanced}.', { names: entryNames(all, [data]), ruleset: 'fixture-rules', paths: refPaths([data], all) });
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/manual/handbook/#chapter-handbook-advanced">Advanced</a>');
  });

  it('renders the components after the parent’s template, in order, at their anchors', async () => {
    const names = entryNames(all, [data]);
    const html = await render(EntryTemplate, { ...handbook, names, paths: refPaths([data], all), components: handbook.components, level: 2 });
    expect(html).toContain('<details class="accordion page-component" id="chapter-handbook-basics" data-type="chapter"><summary class="accordion__summary"><h3>Basics</h3>');
    expect(html).toContain('<details class="accordion page-component" id="chapter-handbook-advanced" data-type="chapter"><summary class="accordion__summary"><h3>Advanced</h3>');
    expect(html.indexOf('id="chapter-handbook-basics"')).toBeLessThan(html.indexOf('id="chapter-handbook-advanced"'));
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/manual/handbook/#chapter-handbook-basics">Basics</a>');
    expect(html).toContain('<dt>Level</dt><dd>2</dd>');
  });

  it('gives a page its links and its components’, but not the links among them', () => {
    const { forward, back } = groupPageRefs(handbook, handbook.components!, refTargets(all, [data]), labelFor);
    expect(forward).toEqual([{ label: 'References', targets: [{ type: 'gear', name: 'Hammer', path: 'fixture-rules/rules/tools/#gear-hammer' }] }]);
    expect(back).toEqual([{ label: 'Referenced by', targets: [{ type: 'note', name: 'Reading List', path: 'fixture-rules/note/reading-list/' }] }]);
  });

  it('names a component "Parent › Component" in links to it and back-links from it', async () => {
    const targets = refTargets(all, [data]);
    expect(targets.get('chapter/handbook-advanced')?.name).toBe('Handbook › Advanced');
    const { ctx } = await fixtureSite();
    const tools = await render(RulesPage, { ctx, page: data.pages.find((p) => p.id === 'tools')! });
    expect(tools).toContain('<a href="/fixture-rules/manual/handbook/#chapter-handbook-basics">Handbook › Basics</a>');
  });
});
