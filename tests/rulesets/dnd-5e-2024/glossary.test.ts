// dnd-5e-2024 glossary terms (docs/rulesets.md#glossary): the SRD Rules Glossary as primitives on
// the Glossary page, with the conditions cross-listed, and links to terms.
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import RulesPage from '../../../site/src/components/rules/RulesPage.astro';
import { loadLibrary } from '../../../site/src/lib/library.ts';
import { renderMarkdown } from '../../../site/src/lib/markdown.ts';
import { rulesContext, rulesData } from '../../../site/src/lib/rules.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, tempLibrary } from '../../helpers.ts';
import { textOf, withoutContents } from '../../site/library-fixtures.ts';

const ROOT = join(import.meta.dirname, '../../..');
const RULES = join(ROOT, 'rulesets/dnd-5e-2024/rules');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

const files: Record<string, unknown> = {};
for (const file of (await readdir(RULES, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(RULES, file));
const data = rulesData(definition, files);
const all = loadLibrary([], [data]);
const ctx = rulesContext(data, all, [data]);
const terms = data.primitives.filter((p) => p.type === 'glossary');
const term = (id: string) => terms.find((p) => p.id === id)!;
const page = data.pages.find((p) => p.id === 'glossary')!;
const render = async (component: any, props: Record<string, unknown>) =>
  (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

const temps: string[] = [];
afterAll(async () => {
  await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('the SRD glossary terms', () => {
  it('are 140 primitive-only terms, none of them a condition', () => {
    expect(terms).toHaveLength(140);
    expect(definition.rules).toContainEqual({ type: 'glossary', extensions: false });
    const conditions = new Set(data.primitives.filter((p) => p.type === 'condition').map((p) => p.name));
    expect(terms.filter((t) => conditions.has(t.name))).toEqual([]);
    expect(terms.map((t) => t.name)).toEqual(expect.arrayContaining(['Ability Check', 'Attack', 'Unarmed Strike', 'Weapon Attack']));
  });

  it('keep the bracketed tag as a field and the name without it', () => {
    expect(term('attack').stats.tag).toBe('action');
    expect(term('cone').stats.tag).toBe('area-of-effect');
    expect(term('hostile').stats.tag).toBe('attitude');
    expect(term('falling').stats.tag).toBe('hazard');
    expect(term('advantage').stats.tag).toBeUndefined();
    expect(terms.filter((t) => t.stats.tag).length).toBe(26);
  });

  it('link mentions of conditions, equipment, and terms: a term at its first mention, not in a table or a chapter reference', () => {
    expect(term('heavily-obscured').stats.text).toBe(
      'You have the {ref:condition/blinded} condition while trying to see something in a Heavily Obscured space. *See also* "{ref:condition/blinded}," "{ref:glossary/darkness}," and "Playing the Game" ("Exploration").',
    );
    expect(term('healing').stats.text).toContain('"Playing the Game" ("Damage and Healing")');
    expect(term('armor-training').stats.text).toContain('If you use a {ref:equipment/shield} and lack training');
  });

  it('keep the definition as printed, with its See also sentence, lists, and tables', () => {
    expect(term('adventure').stats.text).toBe('An adventure is a series of encounters. A story emerges through playing them. *See also* "{ref:glossary/encounter}."');
    expect(term('action').stats.text).toContain('These actions are defined elsewhere in this glossary:\n\n- {ref:glossary/attack}\n- {ref:glossary/dash}\n');
    expect(term('breaking-objects').stats.text).toContain('**Object Armor Class**\n\n| AC | Substance |\n|---|---|\n| 11 | Cloth, paper, rope |');
    expect(term('high-jump').stats.text).toContain('plus 1½ times your height');
  });
});

describe('the Glossary page', () => {
  it('opens with the conventions and abbreviations, then anchors every term at its alphabetical place', async () => {
    expect(data.pages[0]!.id).toBe('glossary');
    const html = await render(RulesPage, { ctx, page });
    const text = textOf(withoutContents(html));
    expect(text.trim()).toMatch(/^Glossary Glossary Conventions The glossary uses the following conventions: Tags in Brackets\./);
    expect(text).toContain('AC Armor Class');
    expect(text).toMatch(/Rules Definitions Here are definitions of various rules\. Ability Check An ability check/);
    for (const t of terms) expect(html).toContain(`id="glossary-${t.id}"`);
    expect(html).toMatch(/id="glossary-armor-training"[\s\S]*id="glossary-attack"[\s\S]*id="glossary-attack-roll"/);
  });

  it('prints a tag in brackets after the name', async () => {
    const text = textOf(withoutContents(await render(RulesPage, { ctx, page })));
    expect(text).toContain('Attack [Action] When you take the Attack action');
    expect(text).toContain('Cone [Area of Effect] A Cone is');
  });

  it('lists each condition at its alphabetical place, linked to the Conditions page, not stored twice', async () => {
    const html = await render(RulesPage, { ctx, page });
    expect(html).toMatch(/id="glossary-attunement"[\s\S]*<a href="\/dnd-5e-2024\/rules\/conditions\/#condition-blinded">Blinded \[Condition\]<\/a>[\s\S]*id="glossary-blindsight"/);
    expect(html).not.toContain('id="condition-blinded"');
    expect(page.blocks).toContainEqual({ kind: 'primitives', type: 'glossary', crossList: ['condition'] });
  });
});

describe('links to glossary terms', () => {
  it('render as the name linked to its anchor on the Glossary page', () => {
    const html = renderMarkdown('Roll with {ref:glossary/advantage}.', { names: ctx.names, ruleset: 'dnd-5e-2024', paths: ctx.paths });
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/rules/glossary/#glossary-advantage">Advantage</a>');
  });

  it('fail when the term is missing', async () => {
    const mired = await readJson(join(FIXTURES, 'condition/mired.json'));
    const note = { ...mired, stats: { effects: [{ name: 'Dazed', text: 'You have {ref:glossary/advantage} and {ref:glossary/luck}.' }] } };
    const { repo, content } = await tempLibrary([note]);
    temps.push(repo);
    const messages = (await validateLibrary(content)).errors.map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('glossary/luck');
  });

  it('can’t target an authored term: a term isn’t an extension', async () => {
    const mired = await readJson(join(FIXTURES, 'condition/mired.json'));
    const { repo, content } = await tempLibrary([{ ...mired, type: 'glossary', id: 'luck', name: 'Luck', stats: { text: 'Luck is luck.' } }]);
    temps.push(repo);
    expect((await validateLibrary(content)).errors.map((e) => `${e.file}: ${e.message}`)).toEqual([
      'dnd-5e-2024/glossary/luck.json: type: "glossary" is a rules type that takes no extensions; its rules are kept in rulesets/dnd-5e-2024/rules/',
    ]);
  });
});

describe('a glossary term primitive', () => {
  it('validates against the glossary schema: a known tag, text, and nothing else', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ttrpg-glossary-'));
    temps.push(root);
    await cp(join(ROOT, 'rulesets'), join(root, 'rulesets'), { recursive: true });
    const file = join(root, 'rulesets/dnd-5e-2024/rules/glossary/bloodied.json');
    const bloodied = await readJson(file);
    await writeFile(file, JSON.stringify({ ...bloodied, stats: { ...bloodied.stats, tag: 'condition', hp: 0 } }));
    const { content } = await tempLibrary([]);
    const messages = (await validateLibrary(content, { rulesetsRoot: join(root, 'rulesets') })).errors.map((e) => e.message);
    expect(messages).toEqual(['stats.hp: unknown key', 'stats.tag: must be one of "action", "area-of-effect", "attitude", "hazard"']);
  });
});
