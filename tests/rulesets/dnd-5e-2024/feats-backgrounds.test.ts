// dnd-5e-2024 feats and backgrounds (docs/rulesets.md#feats, docs/rulesets.md#backgrounds): their
// schemas and checks, a background's link to its feat, labels, and the cards.
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { backgroundLines } from '../../../site/src/lib/background.ts';
import { featHeading } from '../../../site/src/lib/feat.ts';
import { entryNames, loadLibrary, refPaths, refTargets, type Entry } from '../../../site/src/lib/library.ts';
import { groupRefs } from '../../../site/src/lib/refs.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { startingEquipment } from '../../../site/src/lib/starting-equipment.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { BackgroundStats, FeatStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const fixture = async (path: string) => (await readJson(join(FIXTURES, path))) as Entry & Record<string, any>;
const FIXTURE_FILES = ['feat/magic-initiate.json', 'feat/grappler.json', 'feat/savage-attacker.json', 'background/acolyte.json', 'background/soldier.json'];
const fixtures = async () => Promise.all(FIXTURE_FILES.map(fixture));

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Validates the fixtures with `change` applied to copies of them. */
async function validate(change: (entries: Record<string, any>[]) => void = () => {}) {
  const entries = structuredClone(await fixtures());
  change(entries);
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  return { ...result, messages: result.errors.map((e) => `${e.file}: ${e.message}`), warns: result.warnings.map((e) => `${e.file}: ${e.message}`) };
}
const byId = (entries: Record<string, any>[], id: string) => entries.find((e) => e.id === id)!;
const custom = (entry: Record<string, any>) => delete entry.meta.source.srd;

describe('validation', () => {
  it('passes the fixtures, deriving whether a feat is repeatable', async () => {
    const result = await validate();
    expect(result.messages).toEqual([]);
    expect(result.warns).toEqual([]);
    const derived = Object.fromEntries(result.entries.filter((e) => e.entry.type === 'feat').map((e) => [e.entry.id, e.derived]));
    expect(derived).toEqual({ grappler: { repeatable: false }, 'magic-initiate': { repeatable: true }, 'savage-attacker': { repeatable: false } });
  });

  it('resolves a background’s feat, tool, and equipment', async () => {
    const { entries } = await validate();
    const acolyte = entries.find((e) => e.entry.id === 'acolyte')!;
    expect(acolyte.refs.map((r) => `${r.path} ${r.key}`)).toEqual([
      'stats.feat feat/magic-initiate',
      'stats.tool equipment/calligraphers-supplies',
      'stats.equipment[0].items[0] equipment/calligraphers-supplies',
      'stats.equipment[0].items[1] equipment/book',
      'stats.equipment[0].items[2] equipment/holy-symbol',
      'stats.equipment[0].items[3] equipment/parchment',
      'stats.equipment[0].items[4] equipment/robe',
    ]);
  });

  it('rejects a feat with both or neither of benefits and text, or an unknown category', async () => {
    const { messages } = await validate((entries) => {
      byId(entries, 'savage-attacker').stats.benefits = [{ name: 'Extra', text: 'More.' }];
      delete byId(entries, 'grappler').stats.benefits;
      byId(entries, 'magic-initiate').stats.category = 'heroic';
    });
    expect(messages).toContain('dnd-5e-2024/feat/savage-attacker.json: stats: must match exactly one schema in oneOf');
    expect(messages).toContain('dnd-5e-2024/feat/grappler.json: stats: must match exactly one schema in oneOf');
    expect(messages).toContain('dnd-5e-2024/feat/magic-initiate.json: stats.category: must be one of "origin", "general", "fighting-style", "epic-boon"');
  });

  it('warns on a custom feat whose prerequisite breaks its category’s pattern, but not on an SRD one', async () => {
    const { warns } = await validate((entries) => {
      const savage = byId(entries, 'savage-attacker');
      custom(savage);
      savage.stats.level = 4;
      const grappler = byId(entries, 'grappler');
      custom(grappler);
      grappler.stats.level = 2;
      byId(entries, 'magic-initiate').stats.prerequisite = 'Spellcasting Feature';
    });
    expect(warns).toEqual([
      'dnd-5e-2024/feat/grappler.json: stats.level: a general feat has a prerequisite of level 4 or more',
      'dnd-5e-2024/feat/savage-attacker.json: stats.level: an origin feat has no prerequisite, since a background grants it at level 1',
    ]);
  });

  it('rejects a background with the wrong number of abilities or skills, or a feat ref of another type', async () => {
    const { messages } = await validate((entries) => {
      const acolyte = byId(entries, 'acolyte');
      acolyte.stats.abilities = ['int', 'wis'];
      acolyte.stats.skills = ['insight', 'insight'];
      byId(entries, 'soldier').stats.feat = { ref: 'spell/fireball' };
    });
    expect(messages).toContain('dnd-5e-2024/background/acolyte.json: stats.abilities: must NOT have fewer than 3 items');
    expect(messages).toContain('dnd-5e-2024/background/acolyte.json: stats.skills: must NOT have duplicate items (items ## 0 and 1 are identical)');
    expect(messages).toContain('dnd-5e-2024/background/soldier.json: stats.feat.ref: must match pattern "^feat/[a-z0-9]+(-[a-z0-9]+)*$"');
  });

  it('rejects a background whose feat isn’t an origin feat, or whose last option isn’t coins', async () => {
    const { messages } = await validate((entries) => {
      byId(entries, 'acolyte').stats.feat = { ref: 'feat/grappler' };
      byId(entries, 'soldier').stats.equipment[1].items = ['A Spear'];
    });
    expect(messages.sort()).toEqual([
      'dnd-5e-2024/background/acolyte.json: stats.feat: feat/grappler is a general feat; a background grants an origin feat',
      'dnd-5e-2024/background/soldier.json: stats.equipment[1]: the last option is coins only, the alternative to the package',
    ]);
  });

  it('warns on a custom background whose coin option isn’t 50 GP', async () => {
    const { warns } = await validate((entries) => {
      const soldier = byId(entries, 'soldier');
      custom(soldier);
      soldier.stats.equipment[1].gp = 60;
    });
    expect(warns).toEqual(['dnd-5e-2024/background/soldier.json: stats.equipment[1].gp: the coin option is 50 GP in every SRD background']);
  });
});

describe('labels', () => {
  it('name a background’s feat, tool, and equipment from both ends', () => {
    const labels = (path: string) => ruleset.refLabels('background', path);
    expect(labels('stats.feat')).toEqual({ forward: 'Grants', back: 'Granted by' });
    expect(labels('stats.tool')).toEqual({ forward: 'Tool proficiency', back: 'Backgrounds' });
    expect(labels('stats.equipment[0].items[3]')).toEqual({ forward: 'Starting equipment', back: 'Starting equipment of' });
    expect(ruleset.refLabels('feat', 'stats.benefits[0].text')).toEqual({ forward: 'References', back: 'Referenced by' });
  });
});

describe('wording', () => {
  it('words a feat’s category and prerequisite', async () => {
    expect(featHeading((await fixture('feat/magic-initiate.json')).stats as FeatStats)).toBe('Origin Feat');
    expect(featHeading((await fixture('feat/grappler.json')).stats as FeatStats)).toBe('General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)');
    expect(featHeading({ category: 'fighting-style', prerequisite: 'Fighting Style Feature', text: 'x' })).toBe(
      'Fighting Style Feat (Prerequisite: Fighting Style Feature)',
    );
  });

  it('words a background’s lines in the house style', async () => {
    const lines = (stats: unknown) => Object.fromEntries(backgroundLines(stats as BackgroundStats).map((l) => [l.label, l.value]));
    expect(lines((await fixture('background/acolyte.json')).stats)).toEqual({
      'Ability Scores': 'Intelligence, Wisdom, Charisma',
      Feat: '{ref:feat/magic-initiate} (Cleric) (see “Feats”)',
      'Skill Proficiencies': 'Insight and Religion',
      'Tool Proficiency': '{ref:equipment/calligraphers-supplies}',
      // An option's parts are an English list, for backgrounds as for classes (docs/rulesets.md#starting-equipment).
      Equipment:
        'Choose A or B: (A) {ref:equipment/calligraphers-supplies}, {ref:equipment/book} (prayers), {ref:equipment/holy-symbol}, {ref:equipment/parchment} (10 sheets), {ref:equipment/robe}, and 8 GP; or (B) 50 GP',
    });
    expect(lines((await fixture('background/soldier.json')).stats)['Tool Proficiency']).toBe('Choose one kind of {ref:equipment/gaming-set} (see “Equipment”)');
  });

  it('words lettered options, with a counted item’s plural as its link’s text', () => {
    const barbarian = [{ items: [{ ref: 'equipment/greataxe' }, { ref: 'equipment/handaxe', count: 4 }, { ref: 'equipment/explorers-pack' }], gp: 15 }, { gp: 75 }];
    expect(startingEquipment(barbarian, new Map([['equipment/handaxe', 'Handaxe']]))).toBe(
      'Choose A or B: (A) {ref:equipment/greataxe}, 4 {ref:equipment/handaxe Handaxes}, {ref:equipment/explorers-pack}, and 15 GP; or (B) 75 GP',
    );
    expect(startingEquipment([{ gp: 1 }, { gp: 2 }, { gp: 155 }])).toBe('Choose A, B, or C: (A) 1 GP; (B) 2 GP; or (C) 155 GP');
  });
});

describe('cards', async () => {
  const files: Record<string, unknown> = {};
  const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
  for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
  const data = rulesData(definition, files);
  const all = loadLibrary(await fixtures(), [data]);
  const names = entryNames(all, [data]);
  const paths = refPaths([data], all);
  const render = async (id: string) => {
    const loaded = all.find(({ entry }) => entry.id === id)!;
    return (await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, names, paths } })).replace(/ data-astro-cid-\w+/g, '');
  };

  it('render a feat’s benefits, then Repeatable', async () => {
    const html = await render('magic-initiate');
    expect(html).toContain('<p class="statblock-header__subtitle">Origin Feat</p>');
    expect(html).toContain('<p>You gain the following benefits.</p>');
    expect(html).toContain('<em><strong>Two Cantrips.</strong></em> You learn two cantrips');
    expect(html).toContain('<em><strong>Repeatable.</strong></em> You can take this feat more than once');
    expect(await render('savage-attacker')).not.toContain('You gain the following benefits.');
  });

  it('render a background’s lines, linking its feat and equipment', async () => {
    const html = await render('acolyte');
    expect(html).toContain('<dt>Feat</dt><dd><a class="ref-link" href="/dnd-5e-2024/feat/magic-initiate/">Magic Initiate</a> (Cleric) (see “Feats”)</dd>');
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/rules/adventuring-gear/#equipment-parchment">Parchment</a> (10 sheets)');
  });

  it('list the feat a background grants as "Granted by"', () => {
    const magic = all.find(({ entry }) => entry.id === 'magic-initiate')!;
    const { back } = groupRefs('feat', magic.refs, magic.refBy, refTargets(all, [data]), ruleset.refLabels);
    expect(back).toEqual([{ label: 'Granted by', targets: [{ type: 'background', name: 'Acolyte', path: 'dnd-5e-2024/background/acolyte/' }] }]);
  });
});
