// dnd-5e-2024 characters (docs/rulesets.md#characters): a build as refs and choices, its schema, and
// what it derives from its own stats and from the entries it names, on the shared deriveLinked path.
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import { loadLibrary, type Entry } from '../../../site/src/lib/library.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { DerivedCharacter, LinkedCharacter } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) =>
  Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f)) as Promise<Entry & Record<string, any>>));

/** The fixtures and the whole library, which they name; the library has no characters of its own to stand in for. */
const loadAll = async () => [
  ...(await dir(join(FIXTURES, 'character'))),
  ...(await Promise.all((await readdir(CONTENT)).filter((type) => type !== 'character').map((type) => dir(join(CONTENT, type))))).flat(),
];
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
    expect(d.proficiencies.saves).toEqual({ source: 'class/fighter', abilities: ['str', 'con'] });
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

  it('derives fixed Hit Points: the d10 maximum, then 6 per Fighter level and 4 per Wizard level, plus Constitution per level', () => {
    expect(d.hp).toBe(10 + 6 + 6 + 4 + 4 + 2 * 5);
  });

  it('derives Initiative, Speed, and Armor Class from the equipped item’s base armor', () => {
    expect(d.initiative).toBe(0);
    expect(d.speed).toBe(30);
    // Chain Mail: 16, with no Dexterity.
    expect(d.ac).toEqual({ value: 16, armor: 'item/armor-1-2-or-3' });
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
