// dnd-5e-2024 classes and subclasses (docs/rulesets.md#classes, docs/rulesets.md#subclasses): page
// types whose features and options are class-feature and class-option components, their schemas,
// checks, derived Features table and spell list, and their pages.
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { classLines, featuresTable, spellListTables } from '../../../site/src/lib/class.ts';
import { entryNames, loadLibrary, refPaths, refTargets, type Entry } from '../../../site/src/lib/library.ts';
import { groupPageRefs } from '../../../site/src/lib/refs.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { deriveClass, deriveClassLinked } from '../../../rulesets/dnd-5e-2024/classes.ts';
import { ruleset, tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { ClassStats, DerivedClass, LinkedClass, SpellStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { linkedLibrary } from '../../../rulesets/module.ts';
import { FIXTURES, tempLibrary } from '../../helpers.ts';
import { withoutContents } from '../../site/library-fixtures.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) =>
  Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f)) as Promise<Entry & Record<string, any>>));
const fixtures = async () => [
  ...(await dir(join(FIXTURES, 'class'))),
  ...(await dir(join(FIXTURES, 'subclass'))),
  ...(await dir(join(FIXTURES, 'class-feature'))),
  ...(await dir(join(FIXTURES, 'class-option'))),
];
/**
 * The fixtures and the rest of the library: its SRD spells, which the features name and the spell
 * list derives from, and every other entry they or their links reach. The library's own classes and
 * their components stay out, since the fixtures stand in for the Sorcerer and Draconic Sorcery.
 */
const FIXTURE_TYPES = new Set(['class', 'class-feature', 'class-option', 'subclass']);
const loadWithSpells = async () => [
  ...(await fixtures()),
  ...(await Promise.all((await readdir(CONTENT)).filter((type) => !FIXTURE_TYPES.has(type)).map((type) => dir(join(CONTENT, type))))).flat(),
];
/** Read once per file; each caller gets its own copy, so a test's changes stay its own. */
let library: ReturnType<typeof loadWithSpells> | undefined;
const withSpells = async () => structuredClone(await (library ??= loadWithSpells()));
/**
 * Each validation test writes and validates the whole library, once or twice, which takes a few
 * seconds alone and more when other test files share the machine; Vitest's 5 s default is too tight.
 */
const VALIDATION_TIMEOUT = 30_000;

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function validate(change: (entries: Record<string, any>[]) => Record<string, any>[] | void = () => {}) {
  let entries: Record<string, any>[] = await withSpells();
  entries = change(entries) ?? entries;
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  return { ...result, messages: result.errors.map((e) => `${e.file}: ${e.message}`), warns: result.warnings.map((e) => `${e.file}: ${e.message}`) };
}
const byId = (entries: Record<string, any>[], type: string, id: string) => entries.find((e) => e.type === type && e.id === id)!;

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the fixtures, with each feature and option on its parent', async () => {
    const result = await validate();
    expect(result.messages).toEqual([]);
    // Only the fixtures' own warnings: the rest of the library is here so links resolve, and its
    // warnings, such as an authored DC on a creature, are notes for its reviewer (#350).
    expect(result.warnings.filter((w) => FIXTURE_TYPES.has(w.file.split('/')[2]!)).map((w) => `${w.file}: ${w.message}`)).toEqual([]);
    const on = (parent: string, type: string) => result.components.filter((c) => c.parent === parent && c.entry.type === type).map((c) => c.entry.id);
    expect(on('class/sorcerer', 'class-feature')).toHaveLength(10);
    expect(on('class/sorcerer', 'class-option')).toHaveLength(10);
    expect(on('subclass/draconic-sorcery', 'class-feature')).toEqual([
      'draconic-sorcery-draconic-resilience',
      'draconic-sorcery-draconic-spells',
      'draconic-sorcery-dragon-companion',
      'draconic-sorcery-dragon-wings',
      'draconic-sorcery-elemental-affinity',
    ]);
  });

  it('rejects a primary ability join with one ability, a third saving throw, a short column, and a ref of another type', async () => {
    const { messages } = await validate((entries) => {
      const s = byId(entries, 'class', 'sorcerer').stats;
      s.primaryAbility.join = 'or';
      s.savingThrows.push('wis');
      s.columns[0].values.pop();
      s.features.push({ ref: 'class-option/sorcerer-careful-spell' });
    });
    const file = 'content/dnd-5e-2024/class/sorcerer.json';
    expect(messages).toContain(`${file}: stats.primaryAbility: must NOT be valid`);
    expect(messages).toContain(`${file}: stats.savingThrows: must NOT have more than 2 items`);
    expect(messages).toContain(`${file}: stats.columns[0].values: must NOT have fewer than 20 items`);
    expect(messages).toContain(`${file}: stats.features[10].ref: must match pattern "^class-feature/[a-z0-9]+(-[a-z0-9]+)*$"`);
  });

  it('requires a join with two primary abilities, and 20 prepared-spell values', async () => {
    const { messages } = await validate((entries) => {
      const s = byId(entries, 'class', 'sorcerer').stats;
      s.primaryAbility.abilities.push('con');
      s.spellcasting.prepared.push(23);
    });
    expect(messages).toContain('content/dnd-5e-2024/class/sorcerer.json: stats.primaryAbility: missing required key "join"');
    expect(messages).toContain('content/dnd-5e-2024/class/sorcerer.json: stats.spellcasting.prepared: must NOT have more than 20 items');
  });

  it('rejects features out of level order, a first subclass level with no feature, and levels that descend', async () => {
    const { messages } = await validate((entries) => {
      const s = byId(entries, 'class', 'sorcerer').stats;
      [s.features[0], s.features[2]] = [s.features[2], s.features[0]];
      s.subclassLevels = [4, 3, 14, 18];
      byId(entries, 'class-feature', 'sorcerer-metamagic').stats.levels = [10, 2];
    });
    const file = 'content/dnd-5e-2024/class/sorcerer.json';
    expect(messages).toContain(`${file}: stats.features[1]: class-feature/sorcerer-innate-sorcery at level 1 is listed after class-feature/sorcerer-font-of-magic at level 2; features are in level order`);
    expect(messages).toContain(`${file}: stats.subclassLevels: subclass levels 4, 3, 14, 18 must ascend`);
    expect(messages).toContain('content/dnd-5e-2024/class-feature/sorcerer-metamagic.json: stats.levels: levels 10, 2 must ascend');
  });

  it('rejects an official class that lists spells, and allows a homebrew one', async () => {
    const srd = await validate((entries) => {
      byId(entries, 'class', 'sorcerer').stats.spells = [{ ref: 'spell/fireball' }];
    });
    expect(srd.messages).toContain(
      "content/dnd-5e-2024/class/sorcerer.json: stats.spells: an official class's spell list is derived from its spells' classes; only a homebrew class lists spells",
    );
    const custom = await validate((entries) => {
      const sorcerer = byId(entries, 'class', 'sorcerer');
      sorcerer.stats.spells = [{ ref: 'spell/fireball' }];
      sorcerer.author = 'bardic-inspiration';
    });
    expect(custom.messages.filter((m) => m.includes('class/sorcerer.json'))).toEqual([]);
  });

  it('warns a custom class about a missing level 1 feature and an empty level', async () => {
    const { warns } = await validate((entries) => {
      for (const e of entries.filter((e) => ['class', 'class-feature', 'class-option', 'subclass'].includes(e.type))) e.author = 'bardic-inspiration';
    });
    expect(warns).toContain('content/dnd-5e-2024/class/sorcerer.json: stats.features: no feature or subclass level at level 9, 11, 13, 15');
    const { warns: noFirst } = await validate((entries) => {
      const sorcerer = byId(entries, 'class', 'sorcerer');
      sorcerer.author = 'bardic-inspiration';
      byId(entries, 'class-feature', 'sorcerer-spellcasting').stats.levels = [2];
      byId(entries, 'class-feature', 'sorcerer-innate-sorcery').stats.levels = [2];
    });
    expect(noFirst).toContain('content/dnd-5e-2024/class/sorcerer.json: stats.features: no feature at level 1');
  });

  it("rejects a subclass feature off its class's subclass levels, and a subclass level with no feature", async () => {
    const { messages } = await validate((entries) => {
      byId(entries, 'class-feature', 'draconic-sorcery-dragon-wings').stats.levels = [13];
    });
    const file = 'content/dnd-5e-2024/subclass/draconic-sorcery.json';
    expect(messages).toContain(`${file}: stats.features[3]: class-feature/draconic-sorcery-dragon-wings is at level 13, not one of class/sorcerer's subclass levels (3, 6, 14, 18)`);
    expect(messages).toContain(`${file}: stats.features: no feature at subclass level 14 of class/sorcerer`);
  });

  it('rejects subclass features out of level order', async () => {
    const { messages } = await validate((entries) => {
      const s = byId(entries, 'subclass', 'draconic-sorcery').stats;
      [s.features[2], s.features[3]] = [s.features[3], s.features[2]];
    });
    expect(messages).toEqual([
      'content/dnd-5e-2024/subclass/draconic-sorcery.json: stats.features[3]: class-feature/draconic-sorcery-elemental-affinity at level 6 is listed after class-feature/draconic-sorcery-dragon-wings at level 14; features are in level order',
    ]);
  });

  it('rejects a subclass whose class is missing or another type', async () => {
    const { messages } = await validate((entries) => {
      byId(entries, 'subclass', 'draconic-sorcery').stats.class = { ref: 'class/artificer' };
    });
    expect(messages).toContain('content/dnd-5e-2024/subclass/draconic-sorcery.json: stats.class: ref "class/artificer" does not resolve: no class has id "artificer"');
  });
});

describe('derivation', () => {
  const sorcerer = async () => (await dir(join(FIXTURES, 'class')))[0]!.stats as ClassStats;
  const caster = (progression: 'full' | 'half' | 'pact'): ClassStats => ({
    ...({} as ClassStats),
    features: [],
    subclassLevels: [3],
    spellcasting: { ability: 'cha', progression, prepared: Array(20).fill(1) },
  });

  it('derives the proficiency bonus and full-caster slots from the tables', async () => {
    const d = deriveClass(await sorcerer(), tables);
    expect(d.proficiencyBonus).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
    expect(d.spellSlots![0]).toEqual([2]);
    expect(d.spellSlots![19]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(d.pactSlots).toBeUndefined();
  });

  it('reads a half caster at half its level rounded up, as the Paladin’s slots are', () => {
    const slots = deriveClass(caster('half'), tables).spellSlots!;
    expect(slots.slice(0, 5)).toEqual([[2], [2], [3], [3], [4, 2]]);
    expect(slots[19]).toEqual([4, 3, 3, 3, 2]);
  });

  it('reads a pact caster’s slots and slot level from the Pact Magic table, as the Warlock’s are', () => {
    const d = deriveClass(caster('pact'), tables);
    expect(d.spellSlots).toBeUndefined();
    expect(d.pactSlots!.map((r) => `${r.slots}/${r.slotLevel}`)).toEqual([
      '1/1', '2/1', '2/2', '2/2', '2/3', '2/3', '2/4', '2/4', '2/5', '2/5', '3/5', '3/5', '3/5', '3/5', '3/5', '3/5', '4/5', '4/5', '4/5', '4/5',
    ]);
  });

  it('names a feature at each of its levels, with a row’s note, and "Subclass feature" at the later subclass levels', () => {
    const stats: ClassStats = {
      ...caster('pact'),
      features: [{ ref: 'class-feature/warlock-pact-magic' }, { ref: 'class-feature/warlock-mystic-arcanum' }, { ref: 'class-feature/warlock-improved-x' }, { ref: 'class-feature/warlock-improved-x-17' }],
      subclassLevels: [3, 6, 10, 14],
    };
    const feature = (id: string, levels: unknown[]) => ({ type: 'class-feature', id, name: id, stats: { levels, text: 'x' } });
    const { featureRows } = deriveClassLinked('warlock', stats, linkedLibrary([
      feature('warlock-pact-magic', [1]),
      feature('warlock-mystic-arcanum', [{ level: 11, note: 'level 6 spell' }, { level: 13, note: 'level 7 spell' }]),
      feature('warlock-improved-x', [13]),
      feature('warlock-improved-x-17', [17]),
    ]));
    expect(featureRows[0]).toEqual({ features: [{ ref: 'class-feature/warlock-pact-magic' }], subclass: false });
    expect(featureRows[2]).toEqual({ features: [], subclass: false });
    expect(featureRows[5]).toEqual({ features: [], subclass: true });
    expect(featureRows[12]).toEqual({
      features: [{ ref: 'class-feature/warlock-mystic-arcanum', note: 'level 7 spell' }, { ref: 'class-feature/warlock-improved-x' }],
      subclass: false,
    });
    expect(featureRows[16]!.features).toEqual([{ ref: 'class-feature/warlock-improved-x-17' }]);
  });

  it('derives the spell list from the spells whose classes name it, and a custom class’s own spells', async () => {
    const entries = (await withSpells()).map((e) => ({ type: e.type, id: e.id, name: e.name, stats: e.stats, author: e.author }));
    const { spellList, subclasses } = deriveClassLinked('sorcerer', await sorcerer(), linkedLibrary(entries));
    expect(subclasses).toEqual(['subclass/draconic-sorcery']);
    // The SRD's Sorcerer cantrips, in its order.
    expect(spellList[0]!.spells.map((s) => s.ref.slice('spell/'.length))).toEqual([
      'acid-splash', 'chill-touch', 'dancing-lights', 'elementalism', 'fire-bolt', 'light', 'mage-hand', 'mending', 'message',
      'minor-illusion', 'poison-spray', 'prestidigitation', 'ray-of-frost', 'shocking-grasp', 'sorcerous-burst', 'true-strike',
    ]);
    expect(spellList.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const level1 = spellList[1]!.spells;
    expect(level1.find((s) => s.ref === 'spell/detect-magic')).toMatchObject({ concentration: true, ritual: true, material: false });
    expect(level1.find((s) => s.ref === 'spell/chromatic-orb')).toMatchObject({ concentration: false, ritual: false, material: true });
    const custom = deriveClassLinked('wayfinder', { ...(await sorcerer()), spells: [{ ref: 'spell/cure-wounds' }] }, linkedLibrary(entries));
    expect(custom.spellList.flatMap((l) => l.spells.map((s) => s.ref))).toEqual(['spell/cure-wounds']);
  });

  it('lists only official spells and subclasses for an official class, and homebrew too for a homebrew one (docs/rulesets.md#classes)', async () => {
    const entries = (await withSpells()).map((e) => ({ type: e.type, id: e.id, name: e.name, stats: e.stats, author: e.author }));
    const rattle = entries.find((e) => e.type === 'spell' && e.id === 'rattle')!;
    expect(rattle.author).not.toBe('publisher');
    expect((rattle.stats as SpellStats).classes).toContainEqual({ ref: 'class/sorcerer' });
    const draconic = entries.find((e) => e.type === 'subclass' && e.id === 'draconic-sorcery')!;
    const homebrewSubclass = { ...draconic, id: 'ember-soul', name: 'Ember Soul', author: 'bardic-inspiration' };
    const all = [...entries, homebrewSubclass];
    const srd = deriveClassLinked('sorcerer', await sorcerer(), linkedLibrary(all));
    expect(srd.spellList.flatMap((l) => l.spells.map((s) => s.ref))).not.toContain('spell/rattle');
    expect(srd.subclasses).toEqual(['subclass/draconic-sorcery']);
    // The same class as homebrew: its list takes every spell and subclass that names it.
    const self = all.find((e) => e.type === 'class' && e.id === 'sorcerer')!;
    const custom = all.map((e) => (e === self ? { ...e, author: 'bardic-inspiration' } : e));
    const homebrew = deriveClassLinked('sorcerer', await sorcerer(), linkedLibrary(custom));
    expect(homebrew.spellList.flatMap((l) => l.spells.map((s) => s.ref))).toContain('spell/rattle');
    expect(homebrew.subclasses).toEqual(['subclass/draconic-sorcery', 'subclass/ember-soul']);
  });
});

describe('the pages', async () => {
  const files: Record<string, unknown> = {};
  const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
  for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
  const data = rulesData(definition, files);
  const all = loadLibrary(await withSpells(), [data]);
  const names = entryNames(all, [data]);
  const paths = refPaths([data], all);
  const render = async (id: string) => {
    const loaded = all.find(({ entry }) => entry.id === id)!;
    const html = await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, names, paths, components: loaded.components } });
    return { loaded, html: html.replace(/ data-astro-cid-\w+/g, '') };
  };
  const { loaded: sorcerer, html } = await render('sorcerer');
  const s = sorcerer.entry.stats as ClassStats;
  const d = sorcerer.derived as unknown as DerivedClass & LinkedClass;

  it('words the Core Traits lines', () => {
    expect(classLines('Sorcerer', s, names).map((l) => `${l.label}: ${l.value}`)).toEqual([
      'Primary Ability: Charisma',
      'Hit Point Die: D6 per Sorcerer level',
      'Saving Throw Proficiencies: Constitution and Charisma',
      'Skill Proficiencies: Choose 2: Arcana, Deception, Insight, Intimidation, Persuasion, or Religion',
      'Weapon Proficiencies: Simple weapons',
      'Armor Training: None',
      'Starting Equipment: Choose A or B: (A) {ref:equipment/spear}, 2 {ref:equipment/dagger Daggers}, {ref:equipment/arcane-focus} (crystal), {ref:equipment/dungeoneers-pack}, and 28 GP; or (B) 50 GP',
    ]);
    const barbarian: ClassStats = { ...s, primaryAbility: { abilities: ['str', 'dex'], join: 'or' }, skills: { choose: 3 } };
    expect(classLines('Bard', barbarian).map((l) => l.value).slice(0, 4)).toEqual([
      'Strength or Dexterity',
      'D6 per Bard level',
      'Constitution and Charisma',
      'Choose any 3 skills (see “Playing the Game”)',
    ]);
  });

  it('builds the Features table with derived bonus, features, columns, and slots', () => {
    const table = featuresTable('Sorcerer', s, d).split('\n');
    expect(table[0]).toBe('**Sorcerer Features**');
    expect(table[2]).toBe(
      '| Level | Proficiency Bonus | Class Features | Sorcery Points | Cantrips | Prepared Spells | Level 1 Slots | Level 2 Slots | Level 3 Slots | Level 4 Slots | Level 5 Slots | Level 6 Slots | Level 7 Slots | Level 8 Slots | Level 9 Slots |',
    );
    expect(table[4]).toBe('| 1 | +2 | {ref:class-feature/sorcerer-spellcasting}, {ref:class-feature/sorcerer-innate-sorcery} | — | 4 | 2 | 2 | — | — | — | — | — | — | — | — |');
    expect(table[6]).toBe('| 3 | +2 | {ref:class-feature/sorcerer-sorcerer-subclass} | 3 | 4 | 6 | 4 | 2 | — | — | — | — | — | — | — |');
    expect(table[9]).toBe('| 6 | +3 | Subclass feature | 6 | 5 | 10 | 4 | 3 | 3 | — | — | — | — | — | — |');
    expect(table[12]).toBe('| 9 | +4 | — | 9 | 5 | 14 | 4 | 3 | 3 | 3 | 1 | — | — | — | — |');
    expect(table[13]).toBe('| 10 | +4 | {ref:class-feature/sorcerer-metamagic} | 10 | 6 | 15 | 4 | 3 | 3 | 3 | 2 | — | — | — | — |');
    expect(table[23]).toBe('| 20 | +6 | {ref:class-feature/sorcerer-arcane-apotheosis} | 20 | 6 | 22 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |');
  });

  it('prints a half caster’s slots to level 5 and a pact caster’s two columns', () => {
    const rows = (progression: 'half' | 'pact') => {
      const stats: ClassStats = { ...s, columns: undefined, spellcasting: { ability: 'cha', progression, prepared: Array(20).fill(2) } };
      return featuresTable('Test', stats, { ...d, ...deriveClass(stats, tables), spellSlots: deriveClass(stats, tables).spellSlots } as DerivedClass & LinkedClass).split('\n');
    };
    expect(rows('half')[2]).toMatch(/\| Prepared Spells \| Level 1 Slots \| Level 2 Slots \| Level 3 Slots \| Level 4 Slots \| Level 5 Slots \|$/);
    expect(rows('pact')[2]).toMatch(/\| Prepared Spells \| Spell Slots \| Slot Level \|$/);
    expect(rows('pact')[23]).toMatch(/\| 2 \| 4 \| 5 \|$/);
  });

  it('builds a table per spell level, with Special as C, R, and M', () => {
    const [cantrips, level1] = spellListTables('Sorcerer', d);
    expect(cantrips!.split('\n').slice(0, 5)).toEqual(['**Cantrips (Level 0 Sorcerer Spells)**', '', '| Spell | School | Special |', '|---|---|---|', '| {ref:spell/acid-splash} | Evocation | — |']);
    expect(level1).toContain('**Level 1 Sorcerer Spells**');
    expect(level1).toContain('| {ref:spell/detect-magic} | Divination | C, R |');
  });

  it('prints the class page in the SRD’s order, with each feature and option at its anchor', () => {
    const order = [
      '<h3 class="statblock-heading">Core Sorcerer Traits</h3>',
      '<h3 class="statblock-heading">Becoming a Sorcerer as a Level 1 or Multiclass Character</h3>',
      '<li>Gain all the traits in the Core Sorcerer Traits table.</li>',
      '<caption>Sorcerer Features</caption>',
      '<h3 class="statblock-heading">Sorcerer Class Features</h3>',
      'id="class-feature-sorcerer-spellcasting"',
      '<h4 class="statblock-heading statblock-heading--nested">Level 4: Ability Score Improvement</h4>',
      '<h3 class="statblock-heading">Metamagic Options</h3>',
      'id="class-option-sorcerer-careful-spell"',
      '<h3 class="statblock-heading">Sorcerer Spell List</h3>',
      '<caption>Cantrips (Level 0 Sorcerer Spells)</caption>',
      '<h3 class="statblock-heading">Sorcerer Subclasses</h3>',
    ].map((needle) => withoutContents(html).indexOf(needle));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('<p>As a Sorcerer, you gain the following class features when you reach the specified Sorcerer levels. These features are listed in the Sorcerer Features table.</p>');
    expect(html).toContain('<p class="class-option__line">Cost: 1 Sorcery Point</p>');
    expect(html).not.toContain('page-component');
  });

  it('shows the class page on screen as collapsed sections, with its features by level and its options in its summary', () => {
    const toc = html.match(/<nav class="toc"[\s\S]*?<\/nav>/)![0];
    expect(toc).toMatch(
      /href="#section-core-sorcerer-traits">Core Sorcerer Traits<[\s\S]*href="#section-becoming-a-sorcerer-as-a-level-1-or-multiclass-character">Becoming a Sorcerer as a Level 1 or Multiclass Character<[\s\S]*href="#section-sorcerer-class-features">Sorcerer Class Features<\/a><ul><li class="toc__run"><span class="toc__label">Level 1<\/span>: <a href="#class-feature-sorcerer-spellcasting">Spellcasting<\/a>, <a href="#class-feature-sorcerer-innate-sorcery">Innate Sorcery<\/a><\/li>[\s\S]*<li class="toc__run"><a href="#section-metamagic-options">Metamagic Options<\/a>: <a href="#class-option-sorcerer-careful-spell">Careful Spell<[\s\S]*href="#section-sorcerer-subclasses">/,
    );
    // One line per level, not one per feature.
    expect(toc.match(/<span class="toc__label">Level 1<\/span>/g)).toHaveLength(1);
    expect(toc).not.toContain('Level 1: ');
    expect(html).toContain('<details class="accordion class-section" id="section-core-sorcerer-traits"><summary class="disclosure accordion__summary"><span class="chevron" aria-hidden="true"></span><h3 class="statblock-heading">Core Sorcerer Traits</h3></summary>');
    expect(html).toContain('<details class="accordion class-feature" id="class-feature-sorcerer-spellcasting" data-type="class-feature"><summary class="disclosure accordion__summary"><span class="chevron" aria-hidden="true"></span><h4 class="statblock-heading statblock-heading--nested">Level 1: Spellcasting</h4></summary>');
    // A section holding features keeps its heading and intro open over them.
    expect(html).toContain('<section class="class-section" id="section-sorcerer-class-features"><h3 class="statblock-heading">Sorcerer Class Features</h3>');
    // Every toc link lands on an id on the page.
    for (const [, id] of toc.matchAll(/href="#([^"]+)"/g)) expect(html).toContain(`id="${id}"`);
  });

  it('prints the class page with every section open and no table of contents', async () => {
    const printed = (await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...sorcerer, names, paths, components: sorcerer.components, mode: 'print' } })).replace(/ data-astro-cid-\w+/g, '');
    expect(printed).not.toContain('<details');
    expect(printed).not.toContain('class="toc"');
    expect(printed).toContain('<section class="accordion class-feature" id="class-feature-sorcerer-spellcasting" data-type="class-feature"><h4 class="statblock-heading statblock-heading--nested">Level 1: Spellcasting</h4>');
  });

  it('links a feature in the Features table to its anchor, and the class to its subclasses', () => {
    expect(html).toContain('href="/dnd-5e-2024/class/sorcerer/#class-feature-sorcerer-metamagic"');
    expect(html).toContain('href="/dnd-5e-2024/subclass/draconic-sorcery/">Draconic Sorcery</a>');
  });

  it('prints the subclass page with its heading, tagline, and features, and links it to its class', async () => {
    const { loaded, html: page } = await render('draconic-sorcery');
    expect(page).toContain('Sorcerer Subclass: Draconic Sorcery</h2>');
    expect(page).toContain('Breathe the Magic of Dragons');
    expect(page).toContain('id="class-feature-draconic-sorcery-dragon-wings"');
    expect(page).toContain('<h3 class="statblock-heading">Level 14: Dragon Wings</h3>');
    expect(page).toContain('<caption>Draconic Spells</caption>');
    const { forward } = groupPageRefs(loaded, loaded.components!, refTargets(all, [data]), ruleset.refLabels);
    expect(forward[0]).toEqual({ label: 'Subclass of', targets: [{ type: 'class', name: 'Sorcerer', path: 'dnd-5e-2024/class/sorcerer/', official: true }] });
    const back = groupPageRefs(sorcerer, sorcerer.components!, refTargets(all, [data]), ruleset.refLabels).back;
    expect(back.find((g) => g.label === 'Subclasses')?.targets.map((t) => t.name)).toEqual(['Draconic Sorcery']);
  });

  it('widens the class page on screen to fit its Features table, up to the main column, so its links do not wrap', async () => {
    expect(html).toContain('data-type="class" data-mode="screen"');
    const style = await readFile(join(ROOT, 'site/src/components/templates/ClassPage.astro'), 'utf8');
    const rule = style.match(/:global\(\.statblock\[data-type='class'\]\[data-mode='screen'\]\) \{([\s\S]*?)\n {4}\}/)![1]!;
    expect(rule).toContain('inline-size: max-content;');
    expect(rule).toContain('min-inline-size: 100%;');
    expect(rule).toContain('max-inline-size: 100cqi;');
    // Only the table sizes the page.
    expect(rule).toMatch(/> :global\(:not\(\.class-table\)\) \{\s*contain: inline-size;/);
    expect(await readFile(join(ROOT, 'site/src/styles/layout.css'), 'utf8')).toMatch(/\.site-main__inner \{\s*container-type: inline-size;/);
  });

  it("lists a subclass's features by level in its summary, two at one level on one line", async () => {
    const { html: page } = await render('draconic-sorcery');
    const toc = page.match(/<nav class="toc"[\s\S]*?<\/nav>/)![0];
    expect(toc).toContain('<li class="toc__run"><span class="toc__label">Level 3</span>: <a href="#class-feature-draconic-sorcery-draconic-resilience">Draconic Resilience</a>, <a href="#class-feature-draconic-sorcery-draconic-spells">Draconic Spells</a></li>');
    expect(toc).toContain('<li class="toc__run"><span class="toc__label">Level 14</span>: <a href="#class-feature-draconic-sorcery-dragon-wings">Dragon Wings</a></li>');
    expect(toc.match(/toc__run/g)).toHaveLength(4);
  });

  it('names a feature from the other end as "Class › Feature"', () => {
    expect(refTargets(all, [data]).get('class-feature/sorcerer-metamagic')?.name).toBe('Sorcerer › Metamagic');
  });
});
