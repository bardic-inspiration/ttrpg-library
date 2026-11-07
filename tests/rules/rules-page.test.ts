// Rules pages and links to rules on the site (docs/site.md#rules-pages, docs/content-model.md#references),
// rendered from the fixture ruleset.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { anchorId, extensionPage, placeRules, rulePath } from '../../lib/rules.ts';
import ExtensionsPage from '../../site/src/components/rules/ExtensionsPage.astro';
import RulesPage from '../../site/src/components/rules/RulesPage.astro';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, refPaths, refTargets } from '../../site/src/lib/library.ts';
import { renderMarkdown } from '../../site/src/lib/markdown.ts';
import { textOf } from '../site/library-fixtures.ts';
import { fixtureSite } from './fixture.ts';

const { data, all, ctx } = await fixtureSite();
const page = (id: string) => data.pages.find((p) => p.id === id)!;
/** Renders a component, without Astro's scoped-style attributes. */
const render = async (component: any, props: Record<string, unknown>) =>
  (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

describe('placement', () => {
  it('puts each primitive and group on one page, at an anchor', () => {
    const { pages, twice, unplaced } = placeRules(data);
    expect(twice).toEqual([]);
    expect(unplaced).toEqual([]);
    expect(Object.fromEntries(pages)).toEqual({
      'term/advantage': 'glossary',
      'term/disadvantage': 'glossary',
      'gear/tools': 'tools',
      'gear/hand-tools': 'tools',
      'gear/big-tools': 'tools',
      'gear/any-tools': 'tools',
      'gear/hammer': 'tools',
      'gear/ladder': 'tools',
    });
    expect(anchorId('gear/hand-tools')).toBe('gear-hand-tools');
    expect(rulePath('fixture-rules', 'tools', 'gear/hammer')).toBe('fixture-rules/rules/tools/#gear-hammer');
  });

  it('lists an extension on the page that shows its type or its group', () => {
    const mallet = all.find(({ entry }) => entry.id === 'mallet')!.entry;
    expect(extensionPage(data, mallet)).toBe('tools');
  });
});

describe('links to rules', () => {
  it('name primitives and groups, and point to their anchors', () => {
    const names = entryNames(all, [data]);
    expect(names.get('gear/hand-tools')).toBe('Hand Tools');
    expect(names.get('term/advantage')).toBe('Advantage');
    expect(refPaths([data]).get('term/advantage')).toBe('fixture-rules/rules/glossary/#term-advantage');
    expect(refTargets(all, [data]).get('gear/mallet')).toEqual({ type: 'gear', name: 'Mallet', path: 'fixture-rules/gear/mallet/' });
  });

  it('render a {ref:…} token as the name linked to the anchor, and an extension to its card', () => {
    const html = renderMarkdown('A {ref:gear/hammer}, the {ref:gear/hand-tools}, a {ref:gear/mallet}.', {
      names: ctx.names,
      ruleset: 'fixture-rules',
      paths: ctx.paths,
    });
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/rules/tools/#gear-hammer">Hammer</a>');
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/rules/tools/#gear-hand-tools">Hand Tools</a>');
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/gear/mallet/">Mallet</a>');
  });

  it('render a ref object in the generic template as the name linked to the anchor', async () => {
    const note = all.find(({ entry }) => entry.id === 'field-notes')!;
    const html = await render(EntryTemplate, { entry: note.entry, derived: note.derived, names: ctx.names, paths: ctx.paths });
    expect(html).toContain('<a class="ref-link" href="/fixture-rules/rules/tools/#gear-ladder">Ladder</a>');
    expect(html).toContain('href="/fixture-rules/rules/glossary/#term-advantage">Advantage</a>');
  });
});

describe('a rules page', () => {
  it('renders its prose, then every primitive of a type, each in an anchored section with its back-references', async () => {
    const html = await render(RulesPage, { ctx, page: page('glossary') });
    const text = textOf(html);
    expect(text.trim()).toMatch(/^Glossary Conventions Terms are listed alphabetically\. Tags Some terms have tags\. Advantage/);
    expect(html).toContain('id="term-advantage"');
    expect(html).toContain('id="term-disadvantage"');
    // Advantage links Disadvantage in its text, and the note links Advantage.
    expect(html).toMatch(/id="term-advantage"[\s\S]*References[\s\S]*Disadvantage[\s\S]*Referenced by[\s\S]*Field Notes/);
    expect(html).toMatch(/id="term-disadvantage"[\s\S]*Referenced by[\s\S]*href="\/fixture-rules\/rules\/glossary\/#term-advantage">Advantage/);
    expect(text).not.toContain('Extensions');
  });

  it('renders a group tree: anchored groups with notes and text, members under their leaf, a union’s members as links', async () => {
    const html = await render(RulesPage, { ctx, page: page('tools') });
    for (const id of ['gear-tools', 'gear-hand-tools', 'gear-big-tools', 'gear-any-tools', 'gear-hammer', 'gear-ladder']) expect(html).toContain(`id="${id}"`);
    expect(textOf(html)).toContain('Hand Tools (1 Hand)');
    expect(html).toMatch(/id="gear-hand-tools"[\s\S]*id="gear-hammer"[\s\S]*id="gear-big-tools"[\s\S]*id="gear-ladder"[\s\S]*id="gear-any-tools"/);
    // The Tools group's text links Advantage.
    expect(html).toMatch(/id="gear-tools"[\s\S]*href="\/fixture-rules\/rules\/glossary\/#term-advantage">Advantage/);
    // The union lists its members as links.
    expect(html).toMatch(/id="gear-any-tools"[\s\S]*href="\/fixture-rules\/rules\/tools\/#gear-hammer">Hammer[\s\S]*#gear-ladder">Ladder/);
    // Back-references: the note links the Hammer, the Hand Tools group, and the Ladder.
    expect(html).toMatch(/id="gear-hand-tools"[\s\S]*Referenced by[\s\S]*Field Notes/);
    expect(html).toMatch(/id="gear-ladder"[\s\S]*Used by[\s\S]*Field Notes/);
  });

  it('lists its extensions at the bottom, searchable, linked to their cards', async () => {
    const html = await render(RulesPage, { ctx, page: page('tools') });
    expect(html).toMatch(/<h2 id="extensions-heading">Extensions<\/h2>[\s\S]*<input type="search"[\s\S]*href="\/fixture-rules\/gear\/mallet\/">Mallet<\/a>/);
  });
});

describe('the Extensions page', () => {
  it('lists each rules type that takes extensions, with its extensions linked to their cards', async () => {
    const html = await render(ExtensionsPage, { ctx, plurals: { gear: 'Gear' } });
    const text = textOf(html);
    expect(text).toContain('Extensions Gear');
    expect(text).not.toContain('term');
    expect(html).toContain('href="/fixture-rules/gear/mallet/">Mallet</a>');
  });
});
