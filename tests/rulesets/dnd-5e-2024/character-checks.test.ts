// dnd-5e-2024 character consistency checks (docs/rulesets.md#consistency-checks): only legal builds
// validate. Each check fails a changed fixture and passes the fixtures as they are.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { Issue } from '../../../rulesets/module.ts';
import { FIXTURES, withGrants } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) => Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f))));

/** Every entry, component, and primitive a character can name, by key. */
const stats = new Map<string, { type: string; stats: unknown }>();
for (const type of await readdir(CONTENT)) for (const e of await withGrants(await dir(join(CONTENT, type)))) stats.set(`${e.type}/${e.id}`, { type: e.type, stats: e.stats });
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json') && f.includes('/'))) {
  const p = await readJson(join(rulesDir, file));
  if (p.type && p.id) stats.set(`${p.type}/${p.id}`, { type: p.type, stats: p.stats });
}
const fixtures = Object.fromEntries((await dir(join(FIXTURES, 'character'))).map((e) => [e.id, e.stats]));

/** The errors and warnings a fixture gets after a change, own-stats checks and linked ones. */
function issuesOf(id: 'brannoc-ashguard' | 'sister-maelis', change: (s: Record<string, any>) => void = () => {}): Issue[] {
  const s = structuredClone(fixtures[id]);
  change(s);
  return [...ruleset.check('character', s), ...ruleset.checkLinks!('character', s, (key) => stats.get(key), () => undefined)];
}
const messages = (issues: Issue[]) => issues.map((i) => `${i.path}: ${i.message}`);

describe('character consistency checks', () => {
  it('pass the multiclass and single-class cases', () => {
    expect(messages(issuesOf('brannoc-ashguard'))).toEqual([]);
    expect(messages(issuesOf('sister-maelis'))).toEqual([]);
  });

  it('take point buy: 8 to 15 each, 27 points or less', () => {
    // 28 points: Charisma 9 costs 1 more.
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.base.cha = 9)))).toEqual([expect.stringMatching(/^stats\.abilities\.base: .*28 points/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.base.cha = 7)))).toContainEqual(expect.stringMatching(/^stats\.abilities\.base\.cha: /));
  });

  it("take the background's increases: +2/+1 or +1/+1/+1, among its abilities", () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.background = { str: 2, con: 1 })))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.background = { str: 1, dex: 1, con: 1 })))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.background = { str: 2, con: 2 })))).toContainEqual(expect.stringMatching(/^stats\.abilities\.background: /));
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.background = { str: 2, int: 1 })))).toContainEqual(expect.stringMatching(/^stats\.abilities\.background\.int: .*str, dex, con/));
  });

  it("allow no placed increase above 20, and a feat's increases its total, among its abilities", () => {
    const asi = (abilities: Record<string, number>) => (s: Record<string, any>) => {
      s.classes[0].level = 4;
      s.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/fighter', level: 4 }, abilities });
    };
    expect(messages(issuesOf('brannoc-ashguard', asi({ str: 2 })))).toEqual([]);
    // Strength 15 + 2 + 2 + 2 is 21.
    const twice = (s: Record<string, any>) => {
      asi({ str: 2 })(s);
      s.classes[0].level = 6;
      s.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/fighter', level: 6 }, abilities: { str: 2 } });
    };
    expect(messages(issuesOf('brannoc-ashguard', twice))).toEqual([expect.stringMatching(/^stats\.feats\[3\]\.abilities\.str: .*21.*20/)]);
    expect(messages(issuesOf('brannoc-ashguard', asi({ str: 1 })))).toEqual([expect.stringMatching(/^stats\.feats\[2\]\.abilities: .*2 points.*total 1/)]);
  });

  it('take class levels 1 to 20, with no class repeated', () => {
    expect(messages(issuesOf('sister-maelis', (s) => (s.classes[0].level = 20)))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.classes[0].level = 19)))).toContainEqual(expect.stringMatching(/^stats\.classes: .*21/));
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.classes.push({ class: { ref: 'class/wizard' }, level: 1 })))).toContainEqual(
      expect.stringMatching(/^stats\.classes\[2\]\.class: class\/wizard is taken twice/),
    );
  });

  it("need each class's multiclass prerequisite from the final scores, the starting class's included", () => {
    // The spec's case: Intelligence 12 fails the Wizard's.
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.abilities.base.int = 12)))).toEqual([expect.stringMatching(/^stats\.classes\[1\]\.class: .*class\/wizard needs int 13.*int 12/)]);
    // The Fighter's is Strength or Dexterity; the starting class needs it too.
    const weak = (s: Record<string, any>) => {
      s.abilities.base = { str: 11, dex: 11, con: 14, int: 15, wis: 10, cha: 8 };
      s.abilities.background = { str: 1, con: 2 };
    };
    expect(messages(issuesOf('brannoc-ashguard', weak))).toEqual([expect.stringMatching(/^stats\.classes\[0\]\.class: .*class\/fighter needs str or dex 13/)]);
    // A single class has no prerequisite.
    expect(messages(issuesOf('sister-maelis', (s) => (s.abilities.base.wis = 10)))).toEqual([]);
  });

  it('need a subclass of the class, present exactly from its subclass level', () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => delete s.classes[0].subclass))).toEqual([expect.stringMatching(/^stats\.classes\[0\]: .*level 3; name it/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.classes[1].subclass = { ref: 'subclass/champion' })))).toEqual([
      expect.stringMatching(/^stats\.classes\[1\]\.subclass: .*of class\/fighter, not class\/wizard/),
      expect.stringMatching(/^stats\.classes\[1\]\.subclass: .*level 2/),
    ]);
  });

  it("take the background's origin feat once, a species' origin feat, and a class's feat at a level it has", () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.feats[0].ref = 'feat/alert')))).toContainEqual(expect.stringMatching(/^stats\.feats: .*feat\/savage-attacker/));
    expect(messages(issuesOf('sister-maelis', (s) => (s.feats[1].ref = 'feat/ability-score-improvement')))).toContainEqual(
      expect.stringMatching(/^stats\.feats\[1\]: no feature of species\/human's traits grants a general feat/),
    );
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.feats[1].source = { ref: 'class/fighter', level: 4 })))).toEqual([
      expect.stringMatching(/^stats\.feats\[1\]\.source\.level: .*level 3/),
      expect.stringMatching(/^stats\.feats: class-feature\/fighter-fighting-style grants a feat at class\/fighter level 1 .*take one/),
    ]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.feats[1].source = { ref: 'class/cleric', level: 1 })))).toContainEqual(expect.stringMatching(/^stats\.feats\[1\]\.source: class\/cleric isn't/));
    // A general feat at level 4 or more, which this level-5 character meets; an epic boon it doesn't.
    const atAsi = (ref: string) => (s: Record<string, any>) => {
      s.classes[0].level = 4;
      s.classes[1].level = 1;
      s.choices.pop();
      s.feats.push({ ref, source: { ref: 'class/fighter', level: 4 } });
    };
    expect(messages(issuesOf('brannoc-ashguard', atAsi('feat/grappler')))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', atAsi('feat/boon-of-fate')))).toContainEqual(expect.stringMatching(/^stats\.feats\[2\]: .*level 19/));
  });

  it('take only a repeatable feat twice', () => {
    const again = (ref: string) => (s: Record<string, any>) => s.feats.push({ ...s.feats[1], ref, ...(ref === 'feat/ability-score-improvement' && { abilities: { con: 2 } }) });
    expect(messages(issuesOf('brannoc-ashguard', again('feat/defense')))).toContainEqual(expect.stringMatching(/^stats\.feats\[2\]: feat\/defense isn't repeatable/));
    const asiTwice = (s: Record<string, any>) => {
      s.classes = [{ ...s.classes[0], level: 6 }];
      s.choices.pop();
      s.spells = [];
      s.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/fighter', level: 4 }, abilities: { con: 2 } });
      s.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/fighter', level: 6 }, abilities: { con: 2 } });
    };
    expect(messages(issuesOf('brannoc-ashguard', asiTwice))).toEqual([]);
  });

  it("fill the starting class's skills and the background's tool exactly, from what the character has", () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.choices[0].skills = ['history'])))).toContainEqual(expect.stringMatching(/^stats\.choices: class\/fighter gives 2 skills; 1/));
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.choices[0].skills = ['history', 'arcana'])))).toContainEqual(expect.stringMatching(/arcana isn't one of the skills class\/fighter offers/));
    expect(messages(issuesOf('brannoc-ashguard', (s) => delete s.choices[1].tools))).toEqual([expect.stringMatching(/^stats\.choices: background\/soldier gives 1 tool; 0 are picked/)]);
    expect(messages(issuesOf('sister-maelis', (s) => s.choices.push({ source: { ref: 'background/acolyte' }, tools: [{ ref: 'equipment/gaming-set' }] })))).toContainEqual(
      expect.stringMatching(/background\/acolyte gives 0 tools; 1 is picked/),
    );
    expect(messages(issuesOf('sister-maelis', (s) => (s.choices[0].source = { ref: 'background/acolyte' })))).toContainEqual(expect.stringMatching(/background\/acolyte gives 0 skills; 2 are picked/));
    expect(messages(issuesOf('sister-maelis', (s) => (s.choices[1].source = { ref: 'species-trait/elf-keen-senses' })))).toContainEqual(
      expect.stringMatching(/^stats\.choices\[1\]\.source: .*isn't something the character has/),
    );
    // Wizard 3's feature is past this Wizard 2.
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.choices.push({ source: { ref: 'class-feature/wizard-memorize-spell' }, skills: ['arcana'] })))).toContainEqual(
      expect.stringMatching(/class-feature\/wizard-memorize-spell isn't something the character has/),
    );
  });

  it('take no skill twice, and Expertise only in a proficient skill', () => {
    // Soldier gives Athletics.
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.choices[0].skills = ['athletics', 'history'])))).toEqual([expect.stringMatching(/athletics is proficient twice/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.choices[2].expertise = ['arcana'])))).toEqual([expect.stringMatching(/Expertise in arcana needs proficiency/)]);
  });

  it("take options from an option list of the character's classes", () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.options = [{ ref: 'class-option/warlock-agonizing-blast' }])))).toEqual([expect.stringMatching(/^stats\.options\[0\]: .*isn't on an option list/)]);
  });

  it("take spells from a class's list at a level its slots cast, within its counts", () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.spells = [{ ref: 'spell/cure-wounds' }])))).toEqual([expect.stringMatching(/^stats\.spells\[0\]: spell\/cure-wounds .*isn't on the spell list/)]);
    // Wizard 2 casts level 1 spells only.
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.spells.push({ ref: 'spell/fireball' })))).toEqual([expect.stringMatching(/^stats\.spells\[2\]: spell\/fireball \(level 3\)/)]);
    // Wizard 2: 3 cantrips and 5 prepared spells.
    const prepared = ['shield', 'magic-missile', 'burning-hands', 'charm-person', 'color-spray', 'chromatic-orb'];
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.spells = prepared.slice(0, 5).map((id) => ({ ref: `spell/${id}` })))))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.spells = prepared.map((id) => ({ ref: `spell/${id}` })))))).toEqual([expect.stringMatching(/^stats\.spells\[5\]: .*past the prepared spells/)]);
    const cantrips = ['fire-bolt', 'acid-splash', 'chill-touch', 'light'];
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.spells = cantrips.map((id) => ({ ref: `spell/${id}` })))))).toEqual([expect.stringMatching(/^stats\.spells\[3\]: .*past the cantrips/)]);
  });

  it('attune to three items at most, and only to one that requires it', () => {
    const rings = (n: number) => (s: Record<string, any>) => s.equipped.push(...Array.from({ length: n }, () => ({ ref: 'item/ring-of-protection', attuned: true })));
    expect(messages(issuesOf('brannoc-ashguard', rings(3)))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', rings(4)))).toEqual([expect.stringMatching(/^stats\.equipped: 4 items are attuned/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.equipped[0].attuned = true)))).toEqual([expect.stringMatching(/^stats\.equipped\[0\]\.attuned: item\/armor-1-2-or-3 doesn't require/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.equipped[1].attuned = true)))).toEqual([expect.stringMatching(/^stats\.equipped\[1\]\.attuned: equipment\/longsword doesn't require/)]);
  });
});

/** Sister Maelis with a later class that needs Charisma 13: Strength 10, Charisma 13 still cost 25 points. */
const withLater = (ref: string, level: number) => (s: Record<string, any>) => {
  s.abilities.base.str = 10;
  s.abilities.base.cha = 13;
  s.classes.push({ class: { ref }, level });
};
const refs = (type: string, ids: string[]) => ids.map((id) => ({ ref: `${type}/${id}` }));

describe('grants (docs/rulesets.md#grants)', () => {
  it('take a class feat only where a feature grants one, of a category it allows, and fill each feat grant', () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.feats.splice(1, 1)))).toEqual([expect.stringMatching(/^stats\.feats: class-feature\/fighter-fighting-style grants a feat at class\/fighter level 1 \(fighting-style\); take one/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.feats[1].ref = 'feat/alert')))).toContainEqual(
      expect.stringMatching(/^stats\.feats\[1\]: no feature of class\/fighter level 1 grants an origin feat/),
    );
    // Fighter 2 has no feature that grants a feat.
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.feats.push({ ref: 'feat/archery', source: { ref: 'class/fighter', level: 2 } })))).toEqual([
      expect.stringMatching(/^stats\.feats\[2\]: no feature of class\/fighter level 2 grants a fighting-style feat/),
    ]);
  });

  it("take a species feat only from a trait that grants one, and fill it", () => {
    expect(messages(issuesOf('sister-maelis', (s) => s.feats.splice(1, 1)))).toEqual([expect.stringMatching(/^stats\.feats: species-trait\/human-versatile grants a feat \(origin\); take one/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.feats.push({ ref: 'feat/alert', source: { ref: 'species/dwarf' } })))).toEqual([
      expect.stringMatching(/^stats\.feats\[2\]: no feature of species\/dwarf's traits grants an origin feat/),
    ]);
  });

  it("need a feat's ability prerequisite in the final scores", () => {
    const fighter4 = (str: number) => (s: Record<string, any>) => {
      s.classes = [{ ...s.classes[0], level: 4 }];
      s.abilities.base.str = str;
      s.choices.pop();
      s.spells = [];
      s.feats.push({ ref: 'feat/grappler', source: { ref: 'class/fighter', level: 4 } });
    };
    // Strength 11 + 2 is 13.
    expect(messages(issuesOf('brannoc-ashguard', fighter4(11)))).toEqual([]);
    expect(messages(issuesOf('brannoc-ashguard', fighter4(10)))).toEqual([expect.stringMatching(/^stats\.feats\[2\]: feat\/grappler needs str or dex 13 or more; the final scores are str 12, dex 10/)]);
  });

  it("fill a trait's or feature's picks exactly, from its list", () => {
    expect(messages(issuesOf('sister-maelis', (s) => s.choices.splice(1, 1)))).toEqual([expect.stringMatching(/^stats\.choices: species-trait\/human-skillful gives 1 skill; 0 are picked/)]);
    expect(messages(issuesOf('sister-maelis', (s) => s.choices[1].skills.push('arcana')))).toEqual([expect.stringMatching(/human-skillful gives 1 skill; 2 are picked/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => (s.choices[2].expertise = ['perception'])))).toEqual([expect.stringMatching(/perception isn't one of the Expertise picks class-feature\/wizard-scholar offers/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.choices[2].expertise.push('athletics')))).toContainEqual(expect.stringMatching(/wizard-scholar gives 1 Expertise pick; 2 are picked/));
  });

  it('pick the two origin languages under the background', () => {
    expect(messages(issuesOf('brannoc-ashguard', (s) => delete s.choices[1].languages))).toEqual([expect.stringMatching(/^stats\.choices: background\/soldier gives 2 languages; 0 are picked/)]);
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.choices[1].languages.push('Orc')))).toEqual([expect.stringMatching(/background\/soldier gives 2 languages; 3 are picked/)]);
  });

  it("fill a later class's multiclass picks exactly", () => {
    const bard = (picks: Record<string, unknown>) => (s: Record<string, any>) => {
      withLater('class/bard', 1)(s);
      if (Object.keys(picks).length > 0) s.choices.push({ source: { ref: 'class/bard' }, ...picks });
    };
    expect(messages(issuesOf('sister-maelis', bard({ skills: ['performance'], tools: [{ ref: 'equipment/musical-instrument', note: 'lute' }] })))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', bard({})))).toEqual([
      expect.stringMatching(/^stats\.choices: class\/bard gives 1 skill; 0 are picked/),
      expect.stringMatching(/^stats\.choices: class\/bard gives 1 tool; 0 are picked/),
    ]);
    expect(messages(issuesOf('sister-maelis', bard({ skills: ['performance'], tools: [{ ref: 'equipment/gaming-set' }] })))).toEqual([expect.stringMatching(/equipment\/gaming-set isn't one of the tools class\/bard offers/)]);
    // The Wizard gives a later class no picks.
    expect(messages(issuesOf('brannoc-ashguard', (s) => s.choices.push({ source: { ref: 'class/wizard' }, skills: ['arcana'] })))).toEqual([expect.stringMatching(/class\/wizard gives 0 skills; 1 is picked/)]);
  });

  it('count skills and tools together for a grant that pools them', () => {
    const skilled = (picks: Record<string, unknown>) => (s: Record<string, any>) => {
      s.feats[1].ref = 'feat/skilled';
      s.choices.push({ source: { ref: 'feat/skilled' }, ...picks });
    };
    expect(messages(issuesOf('sister-maelis', skilled({ skills: ['history', 'arcana'], tools: [{ ref: 'equipment/gaming-set' }] })))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', skilled({ skills: ['history', 'arcana'] })))).toEqual([expect.stringMatching(/feat\/skilled gives 3 skills or tools; 2 are picked/)]);
  });

  it("fill each option list to its features' count at the class's level", () => {
    // Warlock 1: Eldritch Invocations, from its column.
    const warlock = (options: string[]) => (s: Record<string, any>) => {
      withLater('class/warlock', 1)(s);
      s.options = refs('class-option', options);
    };
    expect(messages(issuesOf('sister-maelis', warlock(['warlock-armor-of-shadows'])))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', warlock([])))).toEqual([expect.stringMatching(/^stats\.options: class\/warlock 1 gives 1 of its Eldritch Invocation Options; 0 are taken/)]);
    // Sorcerer 2: Metamagic, by level.
    const sorcerer = (options: string[]) => (s: Record<string, any>) => {
      withLater('class/sorcerer', 2)(s);
      s.options = refs('class-option', options);
    };
    expect(messages(issuesOf('sister-maelis', sorcerer(['sorcerer-careful-spell', 'sorcerer-distant-spell'])))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', sorcerer(['sorcerer-careful-spell'])))).toEqual([expect.stringMatching(/class\/sorcerer 2 gives 2 of its Metamagic Options; 1 is taken/)]);
  });

  it("give a feat's spell picks and an always-prepared list outside the classes' counts", () => {
    // Cleric 3: 3 cantrips, and Magic Initiate (Cleric) 2 more.
    const cantrips = ['guidance', 'light', 'resistance', 'sacred-flame', 'thaumaturgy', 'spare-the-dying'];
    expect(messages(issuesOf('sister-maelis', (s) => s.spells.push(...refs('spell', cantrips.slice(0, 5)))))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', (s) => s.spells.push(...refs('spell', cantrips))))).toEqual([expect.stringMatching(/^stats\.spells\[6\]: .*past the cantrips/)]);
    // Cleric 3 prepares 6, Magic Initiate 1 more at level 1, and the Life Domain's level 3 spells are always prepared.
    const prepared = ['bane', 'command', 'guiding-bolt', 'healing-word', 'sanctuary', 'shield-of-faith', 'detect-magic', 'hold-person'];
    const domain = ['aid', 'bless', 'lesser-restoration'];
    expect(messages(issuesOf('sister-maelis', (s) => s.spells.push(...refs('spell', [...domain, ...prepared.slice(0, 6)]))))).toEqual([]);
    expect(messages(issuesOf('sister-maelis', (s) => s.spells.push(...refs('spell', [...domain, ...prepared]))))).toEqual([expect.stringMatching(/^stats\.spells\[11\]: .*past the prepared spells/)]);
    // The level 5 list isn't the character's yet.
    expect(messages(issuesOf('sister-maelis', (s) => s.spells.push({ ref: 'spell/revivify' })))).toEqual([expect.stringMatching(/^stats\.spells\[1\]: spell\/revivify \(level 3\) isn't on the spell list/)]);
  });

  it("take a feat's spells from the class list its note names", () => {
    expect(messages(issuesOf('sister-maelis', (s) => (s.feats[0].note = 'Bard')))).toEqual([expect.stringMatching(/^stats\.feats\[0\]\.note: feat\/magic-initiate gives spells from the class\/cleric, class\/druid, class\/wizard list; the note names class\/bard/)]);
    expect(messages(issuesOf('sister-maelis', (s) => delete s.feats[0].note))).toEqual([expect.stringMatching(/^stats\.feats\[0\]\.note: .*it has no note/)]);
  });

  it('warn of equipped armor and weapons without training or proficiency', () => {
    expect(messages(issuesOf('sister-maelis', (s) => (s.equipped = refs('equipment', ['plate-armor', 'longsword']))))).toEqual([
      expect.stringMatching(/^stats\.equipped\[0\]: the character has no training with equipment\/plate-armor \(heavy-armor\)/),
      expect.stringMatching(/^stats\.equipped\[1\]: the character has no proficiency with equipment\/longsword \(martial-melee-weapons\)/),
    ]);
    expect(issuesOf('sister-maelis', (s) => (s.equipped = refs('equipment', ['plate-armor']))).map((i) => i.level)).toEqual(['warning']);
    // A later class's training: the Fighter's as a multiclass gives Martial weapons but not Heavy armor.
    const fighter = (s: Record<string, any>) => {
      s.classes.push({ class: { ref: 'class/fighter' }, level: 1 });
      s.feats.push({ ref: 'feat/defense', source: { ref: 'class/fighter', level: 1 } });
      s.equipped = refs('equipment', ['plate-armor', 'longsword']);
    };
    expect(messages(issuesOf('sister-maelis', fighter))).toEqual([expect.stringMatching(/no training with equipment\/plate-armor/)]);
    // The Monk's Martial weapons only with Light.
    const monk = (weapon: string) => (s: Record<string, any>) => {
      s.classes = [{ class: { ref: 'class/monk' }, level: 1 }];
      s.equipped = refs('equipment', [weapon]);
    };
    const proficiency = (issues: Issue[]) => messages(issues).filter((m) => m.includes('proficiency with'));
    expect(proficiency(issuesOf('sister-maelis', monk('shortsword')))).toEqual([]);
    expect(proficiency(issuesOf('sister-maelis', monk('longsword')))).toEqual([expect.stringMatching(/no proficiency with equipment\/longsword/)]);
    // Without every class's training, the character's is unknown.
    expect(messages(issuesOf('sister-maelis', (s) => {
      withLater('class/warlock', 1)(s);
      s.options = refs('class-option', ['warlock-armor-of-shadows']);
      s.equipped = refs('equipment', ['plate-armor']);
    }))).toEqual([]);
  });
});
