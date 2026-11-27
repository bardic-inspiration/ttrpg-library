// dnd-5e-2024 characters (docs/rulesets.md#characters): a build as refs and choices, its schema, and
// what it derives from its own stats and from the entries it names, on the shared deriveLinked path.
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { loadRegistry } from '../../../scripts/validate/schema.ts';
import { galleryConfig, type Registry } from '../../../site/src/lib/gallery/config.ts';
import { parseQuery } from '../../../site/src/lib/gallery/state.ts';
import { computeView } from '../../../site/src/lib/gallery/view.ts';
import { loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { DerivedCharacter, LinkedCharacter } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, libraryWithout, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) =>
  Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f)) as Promise<Entry & Record<string, any>>));

/** The fixtures and the library minus its characters, and the entries that link to them. */
const loadAll = async () => {
  const fixtures = await dir(join(FIXTURES, 'character'));
  return [...fixtures, ...(await libraryWithout<Entry & Record<string, any>>(['character'], fixtures))];
};
let library: ReturnType<typeof loadAll> | undefined;
const all = async () => structuredClone(await (library ??= loadAll()));

const files: Record<string, unknown> = {};
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
const rules = rulesData(definition, files);

/** A character's derived values as the site loads them: its own, then those from the entries it names. */
const derivedOf = async (id: string, change: (stats: Record<string, any>) => void = () => {}) => {
  const entries = await all();
  change(entries.find((e) => e.type === 'character' && e.id === id)!.stats as Record<string, any>);
  const loaded = loadLibrary(entries, [rules]).find(({ entry }) => entry.type === 'character' && entry.id === id)!;
  return loaded.derived as unknown as DerivedCharacter & LinkedCharacter;
};

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Validating the whole library takes a few seconds; Vitest's 5 s default is too tight. */
const VALIDATION_TIMEOUT = 30_000;

async function validate(change: (entries: Record<string, any>[]) => void = () => {}) {
  const entries: Record<string, any>[] = await all();
  change(entries);
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  const ofCharacters = (issues: { file: string; message: string }[]) => issues.filter((i) => i.file.includes('/character/')).map((i) => `${i.file}: ${i.message}`);
  return { errors: result.errors.map((e) => `${e.file}: ${e.message}`), characterWarnings: ofCharacters(result.warnings), components: result.components };
}

describe('validation', { timeout: VALIDATION_TIMEOUT }, () => {
  it('passes the fixtures, a multiclass build and a single-class one', async () => {
    const result = await validate();
    expect(result.errors).toEqual([]);
    expect(result.characterWarnings).toEqual([]);
    // A character's ref to a component is a link: the component stays on the one parent that lists it.
    const parentOf = (key: string) => result.components.find((c) => `${c.entry.type}/${c.entry.id}` === key)?.parent;
    expect(parentOf('class-feature/wizard-scholar')).toBe('class/wizard');
    expect(parentOf('species-trait/human-skillful')).toBe('species/human');
  });

  it('loads no component onto a character, which only links to them', async () => {
    const loaded = loadLibrary(await all(), [rules]).find(({ entry }) => entry.id === 'brannoc-ashguard')!;
    expect(loaded.components).toBeUndefined();
    expect(loaded.refs.map((r) => r.key)).toContain('class-feature/wizard-scholar');
  });

  it('rejects a feat from a class without the class level that grants it, and a derived value written as an input', async () => {
    const result = await validate((entries) => {
      const brannoc = entries.find((e) => e.id === 'brannoc-ashguard')!;
      brannoc.stats.feats[1].source = { ref: 'class/fighter' };
      brannoc.stats.hp = 40;
    });
    const mine = result.errors.filter((m) => m.includes('brannoc-ashguard'));
    expect(mine.some((m) => m.includes('stats.feats[1].source') && m.includes('level'))).toBe(true);
    expect(mine.some((m) => m.includes('hp'))).toBe(true);
  });

  it('rejects a ref of the wrong type', async () => {
    const result = await validate((entries) => {
      entries.find((e) => e.id === 'sister-maelis')!.stats.species = { ref: 'background/acolyte' };
    });
    expect(result.errors.some((m) => m.includes('sister-maelis') && m.includes('stats.species'))).toBe(true);
  });
});

describe('derived from its own stats', () => {
  it('derives the total level, its proficiency bonus, and the point-buy cost', async () => {
    const [brannoc] = (await dir(join(FIXTURES, 'character'))) as Record<string, any>[];
    expect(ruleset.derive('character', brannoc!.stats)).toEqual({ level: 5, proficiencyBonus: 3, pointCost: 27 });
    const pricier = structuredClone(brannoc!.stats);
    pricier.abilities.base.cha = 9;
    expect(ruleset.derive('character', pricier)).toMatchObject({ pointCost: 28 });
    pricier.abilities.base.cha = 7;
    expect(ruleset.derive('character', pricier)).not.toHaveProperty('pointCost');
  });
});

describe('the multiclass case: Fighter 3 (Champion) / Wizard 2, a dwarf soldier', async () => {
  const d = await derivedOf('brannoc-ashguard');

  it('derives the level, proficiency bonus, final scores, and modifiers', () => {
    expect([d.level, d.proficiencyBonus]).toEqual([5, 3]);
    expect(d.scores).toEqual({ str: 17, dex: 10, con: 15, int: 13, wis: 12, cha: 8 });
    expect(d.abilityMods).toEqual({ str: 3, dex: 0, con: 2, int: 1, wis: 1, cha: -1 });
  });

  it("takes the starting class's saving throws only", () => {
    expect(d.saves).toEqual({ str: 6, dex: 0, con: 5, int: 1, wis: 1, cha: -1 });
    expect(d.proficiencies.saves).toEqual([{ source: 'class/fighter', abilities: ['str', 'con'] }]);
  });

  it('derives skills from the background and the picks, Expertise doubling, and Passive Perception', () => {
    expect(d.skills.athletics).toEqual({ bonus: 6, proficiency: 'proficient' });
    expect(d.skills.intimidation).toEqual({ bonus: 2, proficiency: 'proficient' });
    expect(d.skills.perception).toEqual({ bonus: 4, proficiency: 'proficient' });
    expect(d.skills.history).toEqual({ bonus: 7, proficiency: 'expertise' });
    expect(d.skills.arcana).toEqual({ bonus: 1 });
    expect(Object.keys(d.skills)).toHaveLength(18);
    expect(d.passivePerception).toBe(14);
    expect(d.proficiencies.skills).toEqual([
      { skill: 'athletics', source: 'background/soldier' },
      { skill: 'intimidation', source: 'background/soldier' },
      { skill: 'history', source: 'class/fighter' },
      { skill: 'perception', source: 'class/fighter' },
    ]);
    expect(d.proficiencies.expertise).toEqual([{ skill: 'history', source: 'class-feature/wizard-scholar' }]);
  });

  it('derives fixed Hit Points: the d10 maximum, then 6 per Fighter level and 4 per Wizard level, plus Constitution and Dwarven Toughness per level', () => {
    expect(d.hp).toBe(10 + 6 + 6 + 4 + 4 + 2 * 5 + 5);
  });

  it('derives Initiative, Speed, and Armor Class from the equipped item’s base armor, its variant, and Defense', () => {
    expect(d.initiative).toBe(0);
    expect(d.speed).toBe(30);
    // Chain Mail: 16, with no Dexterity; +1 Armor; Defense +1.
    expect(d.ac).toEqual({ value: 16 + 1 + 1, armor: 'item/armor-1-2-or-3' });
  });

  it('derives an attack per equipped weapon', () => {
    expect(d.attacks).toEqual([
      {
        ref: 'equipment/longsword',
        weapon: 'equipment/longsword',
        ability: 'str',
        attackBonus: 6,
        damage: { dice: '1d8', modifier: 3, type: 'slashing', display: '1d8 + 3' },
        versatile: { dice: '1d10', display: '1d10 + 3' },
        properties: [{ ref: 'weapon-property/versatile' }],
        mastery: { ref: 'mastery-property/sap' },
      },
    ]);
  });

  it("derives the Wizard's spellcasting, and slots at caster level 2", () => {
    expect(d.spellcasting).toEqual([{ class: 'class/wizard', ability: 'int', saveDc: 12, attackBonus: 4, cantrips: 3, prepared: 5 }]);
    expect(d.spellSlots).toEqual([3]);
    expect(d).not.toHaveProperty('pactSlots');
  });

  it('lists its spells by spell level, in the order the build lists them', () => {
    expect(d.spells).toEqual([{ level: 1, spells: ['spell/shield', 'spell/magic-missile'] }]);
  });

  it('puts cantrips first, and leaves out a level with no spells', async () => {
    const more = await derivedOf('brannoc-ashguard', (stats) => {
      stats.spells = [{ ref: 'spell/misty-step' }, { ref: 'spell/shield' }, { ref: 'spell/fire-bolt' }];
    });
    expect(more.spells).toEqual([
      { level: 0, spells: ['spell/fire-bolt'] },
      { level: 1, spells: ['spell/shield'] },
      { level: 2, spells: ['spell/misty-step'] },
    ]);
    const none = await derivedOf('brannoc-ashguard', (stats) => {
      delete stats.spells;
    });
    expect(none.spells).toEqual([]);
  });

  it("lists each class's and subclass's features up to its level, and the species' traits", () => {
    const by = Object.fromEntries(d.features.map((f) => [f.source, f.features.map((x) => `${x.ref.slice('class-feature/'.length)}${x.level ? `@${x.level}` : ''}`)]));
    expect(by['class/fighter']).toEqual([
      'fighter-fighting-style@1',
      'fighter-second-wind@1',
      'fighter-weapon-mastery@1',
      'fighter-action-surge@2',
      'fighter-tactical-mind@2',
      'fighter-fighter-subclass@3',
    ]);
    expect(by['subclass/champion']).toEqual(['champion-improved-critical@3', 'champion-remarkable-athlete@3']);
    expect(by['class/wizard']).toEqual(['wizard-spellcasting@1', 'wizard-ritual-adept@1', 'wizard-arcane-recovery@1', 'wizard-scholar@2']);
    expect(d.features.find((f) => f.source === 'species/dwarf')!.features).toHaveLength(4);
  });

  it("gives the starting class's training, a later class's multiclass text, and the picked tool", () => {
    expect(d.proficiencies.training[0]).toEqual({ source: 'class/fighter', weapons: 'Simple and Martial weapons', armor: 'Light, Medium, and Heavy armor and Shields' });
    expect(d.proficiencies.training[1]).toMatchObject({ source: 'class/wizard' });
    expect(d.proficiencies.training[1]!.multiclass).toContain('Hit Point Die');
    expect(d.proficiencies.tools).toEqual([{ source: 'background/soldier', ref: 'equipment/gaming-set', note: 'dice' }]);
  });

  it('reads the Wizard’s multiclass prerequisite score from the final scores', async () => {
    const lower = await derivedOf('brannoc-ashguard', (stats) => {
      stats.abilities.base.int = 12;
    });
    expect(lower.scores.int).toBe(12);
  });
});

describe('the single-class case: Cleric 3 (Life Domain), a human acolyte', async () => {
  const d = await derivedOf('sister-maelis');

  it('derives its scores, saves, and skills', () => {
    expect([d.level, d.proficiencyBonus, d.pointCost]).toEqual([3, 2, 25]);
    expect(d.scores).toEqual({ str: 13, dex: 10, con: 14, int: 8, wis: 17, cha: 11 });
    expect(d.saves).toMatchObject({ wis: 5, cha: 2, str: 1 });
    expect([d.skills.insight!.bonus, d.skills.religion!.bonus, d.skills.medicine!.bonus, d.skills.perception!.bonus]).toEqual([5, 1, 5, 5]);
    expect(d.passivePerception).toBe(15);
  });

  it('derives Hit Points, Armor Class with medium armor and a shield, and a mace attack', () => {
    expect(d.hp).toBe(8 + 5 + 5 + 2 * 3);
    expect(d.ac).toEqual({ value: 16, armor: 'equipment/scale-mail', shield: 'equipment/shield' });
    expect(d.attacks.map((a) => [a.ref, a.attackBonus, a.damage.display])).toEqual([['equipment/mace', 3, '1d6 + 1']]);
  });

  it('derives its spellcasting and slots, and the Life Domain feature at level 3', () => {
    expect(d.spellcasting).toEqual([{ class: 'class/cleric', ability: 'wis', saveDc: 13, attackBonus: 5, cantrips: 3, prepared: 6 }]);
    expect(d.spellSlots).toEqual([4, 2]);
    expect(d.spells).toEqual([{ level: 1, spells: ['spell/cure-wounds'] }]);
    expect(d.features.find((f) => f.source === 'subclass/life-domain')!.features.map((f) => f.ref)).toContain('class-feature/life-domain-disciple-of-life');
  });

  it('caps Dexterity to medium armor at 2', async () => {
    const nimble = await derivedOf('sister-maelis', (stats) => {
      stats.abilities.base = { str: 8, dex: 15, con: 14, int: 8, wis: 15, cha: 10 };
      stats.abilities.background = { wis: 2, cha: 1 };
    });
    expect(nimble.ac.value).toBe(14 + 2 + 2);
  });
});

/**
 * A character's derived values with `modifiers` given to library entries by key, as fixtures, in
 * place of any the entry carries. `character` is a fixture's id, or a character's stats, added as
 * `character/probe`.
 */
const withModifiers = async (character: string | Record<string, any>, modifiers: Record<string, unknown[]>, change: (stats: Record<string, any>) => void = () => {}) => {
  const entries = await all();
  for (const [key, list] of Object.entries(modifiers)) {
    const entry = entries.find((e) => `${e.type}/${e.id}` === key);
    if (!entry) throw new Error(`no ${key}`);
    (entry.stats as Record<string, any>).modifiers = list;
  }
  const id = typeof character === 'string' ? character : 'probe';
  if (typeof character !== 'string') {
    const [template] = (await dir(join(FIXTURES, 'character'))) as Record<string, any>[];
    entries.push({ ...template!, id, name: 'Probe', stats: structuredClone(character) } as Entry & Record<string, any>);
  }
  change(entries.find((e) => e.type === 'character' && e.id === id)!.stats as Record<string, any>);
  const loaded = loadLibrary(entries, [rules]).find(({ entry }) => entry.type === 'character' && entry.id === id)!;
  return loaded.derived as unknown as DerivedCharacter & LinkedCharacter;
};

const monk = (level: number, equipped: { ref: string }[] = []) => ({
  species: { ref: 'species/human' },
  background: { ref: 'background/acolyte' },
  classes: [{ class: { ref: 'class/monk' }, level, ...(level >= 3 && { subclass: { ref: 'subclass/warrior-of-the-open-hand' } }) }],
  abilities: { base: { str: 10, dex: 15, con: 13, int: 8, wis: 15, cha: 8 }, background: { wis: 2, int: 1 } },
  ...(equipped.length > 0 && { equipped }),
});
const MONK = {
  'class-feature/monk-unarmored-defense': [{ kind: 'ac-formula', base: 10, abilities: ['dex', 'wis'], while: ['unarmored', 'no-shield'] }],
  'class-feature/monk-unarmored-movement': [{ kind: 'speed-bonus', byLevel: { '2': 10, '6': 15 }, while: ['unarmored', 'no-shield'] }],
  'class-feature/monk-martial-arts': [
    { kind: 'attack-ability', abilities: ['dex'], weapon: 'monk', while: ['unarmored', 'no-shield'] },
    { kind: 'damage-die', byLevel: { '1': '1d6', '5': '1d8' }, weapon: 'monk', while: ['unarmored', 'no-shield'] },
  ],
};

describe('modifiers (docs/rulesets.md#modifiers)', () => {
  it("give the multiclass case its Defense, Dwarven Toughness, and +1 Armor from the library's entries, with no adjust", async () => {
    const d = await derivedOf('brannoc-ashguard');
    expect(d.ac.value).toBe(18);
    expect(d.hp).toBe(45);
    // Defense applies only in armor.
    const bare = await derivedOf('brannoc-ashguard', (stats) => {
      stats.equipped = [{ ref: 'equipment/longsword' }];
    });
    expect(bare.ac.value).toBe(10);
  });

  it('take a feature only from the class levels that have it, and a per-class bonus by its class level', async () => {
    // Fighter 3 has Second Wind (level 1) but not Extra Attack (level 5).
    const d = await withModifiers('brannoc-ashguard', {
      'class-feature/fighter-second-wind': [{ kind: 'hp-per-level', value: 1, per: 'class' }],
      'class-feature/fighter-extra-attack': [{ kind: 'ac-bonus', value: 5 }],
    });
    expect(d.hp).toBe(45 + 3);
    expect(d.ac.value).toBe(18);
  });

  it('pick the highest Armor Class formula, and a speed and die by the class level, while unarmored', async () => {
    const d = await withModifiers(monk(5, [{ ref: 'equipment/quarterstaff' }]), MONK);
    // Dex 15 (+2) and Wis 17 (+3).
    expect(d.ac.value).toBe(10 + 2 + 3);
    expect(d.speed).toBe(30 + 10);
    const [staff] = d.attacks;
    expect(staff).toMatchObject({ ability: 'dex', attackBonus: 2 + 3, damage: { dice: '1d8', display: '1d8 + 2' }, versatile: { dice: '1d8' } });
    const armored = await withModifiers(monk(5, [{ ref: 'equipment/leather-armor' }, { ref: 'equipment/quarterstaff' }]), MONK);
    expect(armored.ac.value).toBe(11 + 2);
    expect(armored.speed).toBe(30);
    expect(armored.attacks[0]).toMatchObject({ ability: 'str', damage: { dice: '1d6' } });
    const low = await withModifiers(monk(1), MONK);
    expect(low.speed).toBe(30);
  });

  it('add half the proficiency bonus to skills without proficiency, but not to Initiative', async () => {
    const d = await withModifiers('brannoc-ashguard', { 'species-trait/dwarf-stonecunning': [{ kind: 'skill-floor', proficiency: 'half' }] });
    expect(d.skills.arcana).toEqual({ bonus: 1 + 1 });
    expect(d.skills.athletics).toEqual({ bonus: 6, proficiency: 'proficient' });
    expect(d.passivePerception).toBe(14);
    expect(d.initiative).toBe(0);
  });

  it('add the proficiency bonus to Initiative, and an ability modifier with a minimum to saves', async () => {
    const d = await withModifiers('sister-maelis', {
      'feat/alert': [{ kind: 'initiative-bonus', value: 'proficiency' }],
      'class-feature/cleric-spellcasting': [{ kind: 'save-bonus', value: 'cha', min: 1 }],
    });
    expect(d.initiative).toBe(2);
    // Cha 11 (+0), at least 1.
    expect(d.saves).toMatchObject({ wis: 5 + 1, str: 1 + 1 });
  });

  it('give saving throw and skill proficiencies, with their sources', async () => {
    const d = await withModifiers('sister-maelis', {
      'class-feature/cleric-divine-order': [{ kind: 'save-proficiency', abilities: 'all' }],
      'species-trait/human-resourceful': [{ kind: 'skill-proficiency', skills: ['arcana'] }, { kind: 'skill-proficiency', skills: ['medicine'], expertise: true }],
    });
    expect(d.saves.int).toBe(-1 + 2);
    expect(d.proficiencies.saves).toEqual([
      { source: 'class/cleric', abilities: ['wis', 'cha'] },
      { source: 'class-feature/cleric-divine-order', abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
    ]);
    expect(d.skills.arcana).toEqual({ bonus: -1 + 2, proficiency: 'proficient' });
    expect(d.skills.medicine).toEqual({ bonus: 3 + 4, proficiency: 'expertise' });
    expect(d.proficiencies.skills).toContainEqual({ skill: 'arcana', source: 'species-trait/human-resourceful' });
  });

  it('raise scores up to their maximum: a placed increase, and a fixed one', async () => {
    const d = await withModifiers(
      'sister-maelis',
      { 'feat/ability-score-improvement': [{ kind: 'ability-bonus', total: 2, max: 20 }], 'species-trait/human-versatile': [{ kind: 'ability-bonus', abilities: ['str', 'con'], value: 4, max: 15 }] },
      (stats) => {
        stats.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/cleric', level: 4 }, abilities: { wis: 2 } });
      },
    );
    // Wis 17 + 2 = 19; Str 13 + 4 capped at 15, Con 14 + 4 capped at 15.
    expect(d.scores).toMatchObject({ wis: 19, str: 15, con: 15 });
    const capped = await withModifiers('sister-maelis', { 'feat/ability-score-improvement': [{ kind: 'ability-bonus', total: 2, max: 18 }] }, (stats) => {
      stats.feats.push({ ref: 'feat/ability-score-improvement', source: { ref: 'class/cleric', level: 4 }, abilities: { wis: 2 } });
    });
    expect(capped.scores.wis).toBe(18);
  });

  it('give other speeds, and a speed bonus only without heavy armor', async () => {
    const mods = { 'species-trait/dwarf-stonecunning': [{ kind: 'speed-mode', modes: ['climb', 'swim'] }, { kind: 'speed-bonus', value: 10, while: ['no-heavy-armor'] }] };
    const heavy = await withModifiers('brannoc-ashguard', mods);
    expect([heavy.speed, heavy.speeds]).toEqual([30, { climb: 30, swim: 30 }]);
    const light = await withModifiers('brannoc-ashguard', mods, (stats) => {
      stats.equipped[0] = { ref: 'equipment/leather-armor' };
    });
    expect([light.speed, light.speeds]).toEqual([40, { climb: 40, swim: 40 }]);
  });

  it('add attack and damage bonuses to the weapons they name, one-handed only while it is the one weapon', async () => {
    const mods = {
      'feat/defense': [
        { kind: 'attack-bonus', value: 2, weapon: 'ranged' },
        { kind: 'damage-bonus', value: 2, weapon: 'one-handed-melee' },
      ],
    };
    const one = await withModifiers('brannoc-ashguard', mods);
    expect(one.attacks[0]).toMatchObject({ attackBonus: 6, damage: { modifier: 5, display: '1d8 + 5' }, versatile: { display: '1d10 + 3' } });
    const two = await withModifiers('brannoc-ashguard', mods, (stats) => {
      stats.equipped.push({ ref: 'equipment/longbow' });
    });
    expect(two.attacks.map((a) => [a.ref, a.attackBonus, a.damage.display])).toEqual([
      ['equipment/longsword', 6, '1d8 + 3'],
      ['equipment/longbow', 3 + 0 + 2, '1d8'],
    ]);
  });
});

describe('modifier schema', { timeout: VALIDATION_TIMEOUT }, () => {
  it('validates modifiers on a feature, a feat, and a trait, and rejects an unknown kind or a missing field', async () => {
    const set = (entries: Record<string, any>[], key: string, modifiers: unknown[]) => {
      entries.find((e) => `${e.type}/${e.id}` === key)!.stats.modifiers = modifiers;
    };
    const ok = await validate((entries) => {
      set(entries, 'class-feature/monk-unarmored-defense', MONK['class-feature/monk-unarmored-defense']);
      set(entries, 'class-feature/monk-martial-arts', MONK['class-feature/monk-martial-arts']);
      set(entries, 'feat/defense', [{ kind: 'ac-bonus', value: 1, while: ['armored'] }]);
      set(entries, 'species-trait/dwarf-dwarven-toughness', [{ kind: 'hp-per-level', value: 1 }]);
    });
    expect(ok.errors).toEqual([]);
    const bad = await validate((entries) => {
      set(entries, 'feat/defense', [{ kind: 'ac-magic', value: 1 }]);
      set(entries, 'species-trait/dwarf-dwarven-toughness', [{ kind: 'speed-bonus', while: ['no-heavy-armor'] }]);
    });
    expect(bad.errors.some((m) => m.includes('feat/defense.json') && m.includes('modifiers'))).toBe(true);
    expect(bad.errors.some((m) => m.includes('dwarf-dwarven-toughness.json') && m.includes('modifiers'))).toBe(true);
  });
});

describe('grant schema', { timeout: VALIDATION_TIMEOUT }, () => {
  it('validates grants on a feature, a trait, and a feat, a class\'s grants and training, and a feat\'s requires; rejects an unknown kind, a missing field, or a class without training', async () => {
    // The library's entries carry their grants, so the passing validation reads them on every entry.
    const set = (entries: Record<string, any>[], key: string, fields: Record<string, unknown>) => Object.assign(entries.find((e) => `${e.type}/${e.id}` === key)!.stats, fields);
    const bad = await validate((entries) => {
      set(entries, 'class-feature/fighter-fighting-style', { grants: [{ kind: 'feat-choice', categories: ['fighting-style'] }] });
      set(entries, 'species-trait/human-skillful', { grants: [{ kind: 'skills' }] });
      set(entries, 'class-feature/sorcerer-metamagic', { grants: [{ kind: 'options', list: 'Metamagic Options' }] });
      set(entries, 'feat/magic-initiate', { grants: [{ kind: 'spells', cantrips: 2, byLevel: { '1': [{ ref: 'spell/bless' }] } }] });
      set(entries, 'feat/grappler', { requires: { abilities: ['str'] } });
      set(entries, 'class/monk', { training: { start: { weapons: [{ group: 'exotic-weapons' }] } } });
      set(entries, 'class/bard', { grants: { later: [] } });
      delete entries.find((e) => `${e.type}/${e.id}` === 'class/cleric')!.stats.training;
    });
    for (const file of ['fighter-fighting-style.json', 'human-skillful.json', 'sorcerer-metamagic.json', 'magic-initiate.json']) {
      expect(bad.errors.some((m) => m.includes(file) && m.includes('grants'))).toBe(true);
    }
    expect(bad.errors.some((m) => m.includes('grappler.json') && m.includes('requires'))).toBe(true);
    expect(bad.errors.some((m) => m.includes('monk.json') && m.includes('training'))).toBe(true);
    expect(bad.errors.some((m) => m.includes('bard.json') && m.includes('grants'))).toBe(true);
    expect(bad.errors.some((m) => m.includes('cleric.json') && m.includes('training'))).toBe(true);
  });

  it("rejects a choice of one option, an option that gives nothing, a spell pick above level 9, and a modifier's missing proficiency", async () => {
    const set = (entries: Record<string, any>[], key: string, fields: Record<string, unknown>) => Object.assign(entries.find((e) => `${e.type}/${e.id}` === key)!.stats, fields);
    const bad = await validate((entries) => {
      set(entries, 'species-trait/elf-elven-lineage', { grants: [{ kind: 'choice', options: [{ name: 'Drow', grants: [{ kind: 'languages', count: 1 }] }] }] });
      set(entries, 'species-trait/gnome-gnomish-lineage', { grants: [{ kind: 'choice', options: [{ name: 'Forest Gnome' }, { name: 'Rock Gnome' }] }] });
      set(entries, 'class-feature/warlock-mystic-arcanum', { grants: [{ kind: 'spells', pickByLevel: { '11': 10 } }] });
      set(entries, 'class-feature/druid-druidic', { modifiers: [{ kind: 'language' }] });
    });
    for (const file of ['elf-elven-lineage.json', 'gnome-gnomish-lineage.json', 'warlock-mystic-arcanum.json']) {
      expect(bad.errors.some((m) => m.includes(file) && m.includes('grants'))).toBe(true);
    }
    expect(bad.errors.some((m) => m.includes('druid-druidic.json') && m.includes('modifiers'))).toBe(true);
  });
});

describe('grant forms in derivations (docs/rulesets.md#grants)', () => {
  it("apply a chosen option's modifiers: a Wood Elf's Speed is 35", async () => {
    const elf = (option: string) => (s: Record<string, any>) => {
      s.species = { ref: 'species/elf' };
      s.choices.push({ source: { ref: 'species-trait/elf-elven-lineage' }, option });
    };
    expect((await derivedOf('sister-maelis', elf('Wood Elf'))).speed).toBe(35);
    expect((await derivedOf('sister-maelis', elf('Drow'))).speed).toBe(30);
  });

  it('give the skills, tools, and languages an entry gives outright', async () => {
    const hearth = await derivedOf('sister-maelis', (s) => (s.classes[0].subclass = { ref: 'subclass/hearth-domain' }));
    expect(hearth.proficiencies.tools).toContainEqual({ source: 'class-feature/hearth-domain-hearth-blessing', ref: 'equipment/cooks-utensils' });
    const rogue = await derivedOf('sister-maelis', (s) => (s.classes = [{ class: { ref: 'class/rogue' }, level: 1 }]));
    expect(rogue.proficiencies.languages).toContainEqual({ source: 'class-feature/rogue-thieves-cant', language: "Thieves' Cant" });
    const druid = await derivedOf('sister-maelis', (s) => (s.classes = [{ class: { ref: 'class/druid' }, level: 1 }]));
    expect(druid.proficiencies.languages).toContainEqual({ source: 'class-feature/druid-druidic', language: 'Druidic' });
    // Pathfinder's Eye: proficiency in Survival, with Expertise.
    const ranger = await derivedOf('sister-maelis', (s) => (s.classes = [{ class: { ref: 'class/ranger' }, level: 3, subclass: { ref: 'subclass/trailblazer' } }]));
    expect(ranger.skills.survival!.proficiency).toBe('expertise');
    expect(ranger.proficiencies.skills).toContainEqual({ skill: 'survival', source: 'class-feature/trailblazer-pathfinders-eye' });
  });
});

describe('item modifiers (docs/rulesets.md#item-modifiers)', () => {
  it("give a weapon's variant bonus to its own attack and damage only", async () => {
    const d = await derivedOf('brannoc-ashguard', (stats) => {
      stats.equipped = [{ ref: 'item/weapon-1-2-or-3', base: { ref: 'equipment/longsword' }, variant: '+2' }, { ref: 'equipment/longbow' }];
    });
    expect(d.attacks.map((a) => [a.ref, a.attackBonus, a.damage.display, a.versatile?.display])).toEqual([
      ['item/weapon-1-2-or-3', 6 + 2, '1d8 + 5', '1d10 + 5'],
      // Archery isn't Brannoc's, so the longbow takes only Dexterity and the proficiency bonus.
      ['equipment/longbow', 3, '1d8', undefined],
    ]);
    const unnamed = await derivedOf('brannoc-ashguard', (stats) => {
      stats.equipped[0].variant = undefined;
    });
    expect(unnamed.ac.value).toBe(16 + 1);
  });

  it('apply a worn item only while attuned, when it requires attunement', async () => {
    const cloak = (attuned: boolean) =>
      derivedOf('sister-maelis', (stats) => {
        stats.equipped.push({ ref: 'item/cloak-of-protection', ...(attuned && { attuned: true }) });
      });
    const base = await derivedOf('sister-maelis');
    const off = await cloak(false);
    expect([off.ac.value, off.saves]).toEqual([base.ac.value, base.saves]);
    const on = await cloak(true);
    expect(on.ac.value).toBe(base.ac.value + 1);
    expect(on.saves.wis).toBe(base.saves.wis + 1);
    // Armor equipped with a worn item stays the armor.
    expect(on.ac.armor).toBe('equipment/scale-mail');
  });

  it('add a check bonus to every skill, Passive Perception, and Initiative', async () => {
    const base = await derivedOf('sister-maelis');
    const d = await derivedOf('sister-maelis', (stats) => {
      stats.equipped.push({ ref: 'item/stone-of-good-luck-luckstone', attuned: true });
    });
    expect(d.skills.insight!.bonus).toBe(base.skills.insight!.bonus + 1);
    expect(d.skills.arcana!.bonus).toBe(base.skills.arcana!.bonus + 1);
    expect(d.passivePerception).toBe(base.passivePerception + 1);
    expect(d.initiative).toBe(base.initiative + 1);
    expect(d.saves.str).toBe(base.saves.str + 1);
  });

  it('set a score unless it is already higher, by variant for a belt', async () => {
    const worn = (equipped: Record<string, unknown>[], change: (stats: Record<string, any>) => void = () => {}) =>
      derivedOf('brannoc-ashguard', (stats) => {
        stats.equipped.push(...equipped);
        change(stats);
      });
    const d = await worn([{ ref: 'item/gauntlets-of-ogre-power', attuned: true }, { ref: 'item/headband-of-intellect', attuned: true }]);
    expect(d.scores).toMatchObject({ str: 19, int: 19 });
    expect(d.attacks[0]!.attackBonus).toBe(3 + 4);
    const strong = await worn([{ ref: 'item/gauntlets-of-ogre-power', attuned: true }], (stats) => {
      stats.abilities.base.str = 18;
    });
    expect(strong.scores.str).toBe(20);
    const belt = await worn([{ ref: 'item/belt-of-giant-strength', variant: 'storm', attuned: true }]);
    expect(belt.scores.str).toBe(29);
  });

  it('give bracers their bonus only with no armor and no shield', async () => {
    const bare = await derivedOf('brannoc-ashguard', (stats) => {
      stats.equipped = [{ ref: 'equipment/longsword' }, { ref: 'item/bracers-of-defense', attuned: true }];
    });
    expect(bare.ac.value).toBe(10 + 2);
    const armored = await derivedOf('brannoc-ashguard', (stats) => {
      stats.equipped.push({ ref: 'item/bracers-of-defense', attuned: true });
    });
    expect(armored.ac.value).toBe(18);
  });
});

describe('item modifier schema', { timeout: VALIDATION_TIMEOUT }, () => {
  it("rejects a feature's kind on an item, and passes a worn item with a variant and attunement", async () => {
    const result = await validate((entries) => {
      entries.find((e) => e.id === 'cloak-of-protection')!.stats.modifiers = [{ kind: 'skill-floor', proficiency: 'half' }];
      entries.find((e) => e.id === 'sister-maelis')!.stats.equipped.push({ ref: 'item/belt-of-giant-strength', variant: 'hill', attuned: true });
    });
    expect(result.errors.some((m) => m.includes('cloak-of-protection.json') && m.includes('modifiers'))).toBe(true);
    expect(result.errors.some((m) => m.includes('sister-maelis'))).toBe(false);
  });
});

describe('in the Library (docs/rulesets.md#characters)', { timeout: VALIDATION_TIMEOUT }, async () => {
  const lib = await tempLibrary(await all());
  temps.push(lib.repo);
  const { errors, records } = await buildIndex(lib.content, { assetsRoot: lib.repo });
  const characters = records.filter((r) => r.type === 'character');
  const config = galleryConfig((await loadRegistry()) as unknown as Registry);
  const found = (query: string) =>
    computeView(characters, config, parseQuery(`?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/character&${query}`, config)).results.map((r) => r.id);

  it('lifts its classes, total level, species, and background as facets', () => {
    expect(errors).toEqual([]);
    expect(characters.find((r) => r.id === 'brannoc-ashguard')?.facets).toEqual({
      'stats.classes.class': ['class/fighter', 'class/wizard'],
      'derived.level': 5,
      'stats.species': 'species/dwarf',
      'stats.background': 'background/soldier',
    });
  });

  it('filters by each of them', () => {
    expect(found('f.stats.classes.class=class/wizard')).toEqual(['brannoc-ashguard']);
    expect(found('f.derived.level=1..3')).toEqual(['sister-maelis']);
    expect(found('f.stats.species=species/human')).toEqual(['sister-maelis']);
    expect(found('f.stats.background=background/soldier')).toEqual(['brannoc-ashguard']);
  });
});
