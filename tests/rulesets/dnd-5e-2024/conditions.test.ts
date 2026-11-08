// dnd-5e-2024 conditions (docs/rulesets.md#conditions): the 15 SRD primitives, condition
// immunities as links, a custom condition, and how each renders.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import RulesPage from '../../../site/src/components/rules/RulesPage.astro';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { conditionIntro } from '../../../site/src/lib/condition.ts';
import { loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { renderMarkdown } from '../../../site/src/lib/markdown.ts';
import { rulesContext, rulesData } from '../../../site/src/lib/rules.ts';
import { defenseLines } from '../../../site/src/lib/creature.ts';
import type { CreatureStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, tempLibrary } from '../../helpers.ts';
import { textOf } from '../../site/library-fixtures.ts';

const ROOT = join(import.meta.dirname, '../../..');
const RULES = join(ROOT, 'rulesets/dnd-5e-2024/rules');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

/** The real rules data, as the site loads it. */
async function realRules() {
  const files: Record<string, unknown> = {};
  for (const file of (await readdir(RULES, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(RULES, file));
  return rulesData(definition, files);
}

const data = await realRules();
const entryOf = async (path: string) => (await readJson(join(ROOT, 'content/dnd-5e-2024', path))) as Entry;
const mired = (await readJson(join(FIXTURES, 'condition/mired.json'))) as Entry;
const airElemental = await entryOf('creature/air-elemental.json');
const contagion = await entryOf('spell/contagion.json');
const all = loadLibrary([airElemental, contagion, mired], [data]);
const ctx = rulesContext(data, all, [data]);
const render = async (component: any, props: Record<string, unknown>) =>
  (await (await AstroContainer.create()).renderToString(component, { props })).replace(/ data-astro-cid-\w+/g, '');

describe('the SRD conditions', () => {
  it('are the 15 primitives, on the Conditions page, with no enum or table left', async () => {
    expect(data.primitives.filter((p) => p.type === 'condition').map((p) => p.name).sort()).toEqual([
      'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
      'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
    ]);
    expect(data.pages.find((p) => p.id === 'conditions')).toEqual({ id: 'conditions', title: 'Conditions', blocks: [{ kind: 'primitives', type: 'condition' }] });
    const common = await readJson(join(ROOT, 'rulesets/dnd-5e-2024/schemas/common.schema.json'));
    expect(common.$defs.Condition).toBeUndefined();
  });

  it('word the SRD’s opening sentence from the name and the number of effects', () => {
    const stats = (id: string) => data.primitives.find((p) => p.id === id)!.stats as { effects: { name: string; text: string }[] };
    expect(conditionIntro('Poisoned', stats('poisoned'))).toBe('While you have the Poisoned condition, you experience the following effect.');
    expect(conditionIntro('Blinded', stats('blinded'))).toBe('While you have the Blinded condition, you experience the following effects.');
  });

  it('link the other conditions they name', () => {
    const effects = (id: string) => JSON.stringify(data.primitives.find((p) => p.id === id)!.stats);
    expect(effects('paralyzed')).toContain('You have the {ref:condition/incapacitated} condition.');
    expect(effects('unconscious')).toContain('You have the {ref:condition/incapacitated} and {ref:condition/prone} conditions');
    expect(effects('petrified')).toContain('Immunity to the {ref:condition/poisoned} condition.');
  });
});

describe('the Conditions page', () => {
  it('anchors every condition and prints it as the SRD does, with what links to it and the custom conditions', async () => {
    const html = await render(RulesPage, { ctx, page: data.pages.find((p) => p.id === 'conditions') });
    for (const p of data.primitives.filter((p) => p.type === 'condition')) expect(html).toContain(`id="condition-${p.id}"`);
    const text = textOf(html);
    expect(text).toContain(
      'Poisoned While you have the Poisoned condition, you experience the following effect. Ability Checks and Attacks Affected. You have Disadvantage on attack rolls and ability checks.',
    );
    expect(html).toMatch(/id="condition-poisoned"[\s\S]*Immune creatures[\s\S]*Air Elemental[\s\S]*Referenced by[\s\S]*Contagion/);
    expect(html).toMatch(/id="condition-incapacitated"[\s\S]*Referenced by[\s\S]*href="\/dnd-5e-2024\/rules\/conditions\/#condition-paralyzed">Paralyzed/);
    expect(html).toMatch(/Extensions[\s\S]*href="\/dnd-5e-2024\/condition\/mired\/">Mired<\/a>/);
  });
});

describe('condition links', () => {
  it('make a creature’s condition immunities links to the Conditions page (creature/air-elemental)', async () => {
    const s = airElemental.stats as CreatureStats;
    expect(s.immunities?.conditions?.[0]).toEqual({ ref: 'condition/exhaustion' });
    const [line] = defenseLines(s).filter((l) => l.label === 'Immunities');
    const html = renderMarkdown(line!.value, { names: ctx.names, ruleset: 'dnd-5e-2024', paths: ctx.paths });
    expect(textOf(html).trim()).toBe('Poison, Thunder; Exhaustion, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, Unconscious');
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/rules/conditions/#condition-exhaustion">Exhaustion</a>');
  });

  it('read the SRD text word for word in rules text (spell/contagion)', () => {
    const html = renderMarkdown((contagion.stats as { effect: string }).effect, { names: ctx.names, ruleset: 'dnd-5e-2024', paths: ctx.paths });
    expect(textOf(html)).toContain('have the Poisoned condition. Also, choose one ability when you cast the spell. While Poisoned, the target');
    expect(html).toContain('href="/dnd-5e-2024/rules/conditions/#condition-poisoned">Poisoned</a>');
  });

  it('resolve in the validator, with the condition immunity label', async () => {
    const hound = await readJson(join(FIXTURES, 'library/valid/dnd-5e-2024/creature/cinder-hound.json'));
    hound.stats.immunities = { conditions: [{ ref: 'condition/charmed', note: 'with Mind Blank' }, { ref: 'condition/sleepy' }] };
    const { content } = await tempLibrary([hound, mired]);
    const { errors } = await validateLibrary(content);
    expect(errors.map((e) => e.message)).toEqual(['stats.immunities.conditions[1]: ref "condition/sleepy" does not resolve: no condition has id "sleepy"']);
  });

  it('take only condition keys', async () => {
    const hound = await readJson(join(FIXTURES, 'library/valid/dnd-5e-2024/creature/cinder-hound.json'));
    hound.stats.immunities = { conditions: [{ ref: 'spell/frost-lance' }, 'poisoned'] };
    const { content } = await tempLibrary([hound]);
    const messages = (await validateLibrary(content)).errors.map((e) => e.message);
    expect(messages).toContain('stats.immunities.conditions[0].ref: must match pattern "^condition/[a-z0-9]+(-[a-z0-9]+)*$"');
    expect(messages).toContain('stats.immunities.conditions[1]: must be object');
  });
});

describe('a custom condition', () => {
  it('validates as an extension', async () => {
    const { content } = await tempLibrary([mired]);
    const result = await validateLibrary(content);
    expect(result.errors).toEqual([]);
    expect(result.entries.find((e) => e.entry.id === 'mired')?.refs).toEqual([{ path: 'stats.effects[1].text', key: 'condition/restrained' }]);
  });

  it('renders as a card with the SRD’s opening sentence and its effects', async () => {
    const loaded = all.find(({ entry }) => entry.id === 'mired')!;
    const html = await render(EntryTemplate, { entry: loaded.entry, derived: loaded.derived, names: ctx.names, paths: ctx.paths });
    expect(textOf(html)).toContain(
      'Mired Condition While you have the Mired condition, you experience the following effects. Slowed. Your Speed is halved. Unsteady.',
    );
    expect(html).toContain('href="/dnd-5e-2024/rules/conditions/#condition-restrained">Restrained</a>');
  });
});
