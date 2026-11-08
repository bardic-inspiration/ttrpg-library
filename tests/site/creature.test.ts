import { describe, expect, it } from 'vitest';
import { deriveCreature } from '../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../rulesets/dnd-5e-2024/index.ts';
import type { CreatureStats } from '../../rulesets/dnd-5e-2024/types.ts';
import {
  abilityRows,
  actionBlock,
  crLine,
  defenseLines,
  formatCr,
  hpLine,
  initiativeLine,
  languagesLine,
  sensesLine,
  sizeTypeLine,
  skillsLine,
  speedLine,
  spellcastingBlock,
  type ActionBlock,
} from '../../site/src/lib/creature.ts';
import { cinderHound } from '../helpers.ts';

const plain = (block: ActionBlock) => `${block.name}. ${block.body}`;

describe('creature stat block text (docs/rulesets.md#creatures)', () => {
  it('renders the cinder hound as the spec shows it', async () => {
    const s = (await cinderHound()).stats as CreatureStats;
    const d = deriveCreature(s, tables);
    expect(sizeTypeLine(s)).toBe('Medium Monstrosity, Unaligned');
    expect(initiativeLine(d)).toBe('+2 (12)');
    expect(hpLine(d)).toBe('32 (5d8 + 10)');
    expect(speedLine(s)).toBe('40 ft.');
    expect(skillsLine(s, d)).toBe('Perception +3, Stealth +4');
    expect(sensesLine(s, d)).toBe('Darkvision 60 ft.; Passive Perception 13');
    expect(languagesLine(s)).toBe('None');
    expect(crLine(s, d)).toBe('2 (XP 450; PB +2)');
    expect(plain(actionBlock(s.traits![0]!, d.traits[0], d))).toBe(
      'Smoldering Hide. A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes 2 (1d4) Fire damage.',
    );
    expect(plain(actionBlock(s.actions![0]!, d.actions[0], d))).toBe(
      'Bite. *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage.',
    );
    expect(plain(actionBlock(s.actions![1]!, d.actions[1], d))).toBe(
      'Ember Breath (Recharge 5–6). *Dexterity Saving Throw:* DC 12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage. *Success:* Half damage.',
    );
  });

  it('formats fractional CRs, ranged attacks, lair XP, and spellcasting', async () => {
    const base = (await cinderHound()).stats as CreatureStats;
    expect([0.125, 0.25, 0.5, 3].map(formatCr)).toEqual(['1/8', '1/4', '1/2', '3']);
    const s: CreatureStats = {
      ...base,
      lair: true,
      speed: { walk: 30, fly: 60, hover: true },
      actions: [{ name: 'Spit', kind: 'ranged-attack', ability: 'dex', range: { normal: 30, long: 120 }, damage: [{ dice: '1d6', ability: 'dex', type: 'acid' }] }],
      spellcasting: { ability: 'wis', includeAttack: true, atWill: ['Light', { ref: 'spell/frost-lance' }], perDay: { '1': ['Fog Cloud'] } },
    };
    const d = deriveCreature(s, tables);
    expect(speedLine(s)).toBe('30 ft., Fly 60 ft. (hover)');
    expect(crLine(s, d)).toBe('2 (XP 450, or 700 in lair; PB +2)');
    expect(plain(actionBlock(s.actions![0]!, d.actions[0], d))).toBe(
      'Spit. *Ranged Attack Roll:* +4, range 30/120 ft. *Hit:* 5 (1d6 + 2) Acid damage.',
    );
    const names = new Map([['spell/frost-lance', 'Frost Lance']]);
    expect(plain(spellcastingBlock(s, d, names, 'Cinder Hound')!)).toBe(
      'Spellcasting. The hound casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 11, +3 to hit with spell attacks):\\\n*At Will:* Light, Frost Lance\\\n*1/Day:* Fog Cloud',
    );
  });

  it('renders conditional riders, attack notes, and authored DCs as SRD 5.2 prints them (#88)', async () => {
    const base = (await cinderHound()).stats as CreatureStats;
    const s: CreatureStats = {
      ...base,
      traits: [
        {
          name: 'Undead Fortitude',
          kind: 'other',
          text: 'If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw ({dc=5} plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.',
        },
      ],
      actions: [
        {
          name: 'Scimitar',
          kind: 'melee-attack',
          ability: 'dex',
          reach: 5,
          damage: [
            { dice: '1d6', ability: 'dex', type: 'slashing' },
            { dice: '1d4', type: 'slashing', condition: 'if the attack roll had Advantage' },
          ],
        },
        {
          name: 'Light Hammer',
          kind: 'melee-or-ranged-attack',
          ability: 'str',
          attackNote: 'with Advantage if the target is Grappled by the bugbear',
          reach: 10,
          range: { normal: 20, long: 60 },
          damage: [{ dice: '3d4', ability: 'str', type: 'bludgeoning' }],
        },
        {
          name: 'Gore',
          kind: 'melee-attack',
          ability: 'str',
          reach: 5,
          damage: [
            { dice: '1d8', ability: 'str', type: 'piercing' },
            { dice: '1d6', type: 'fire' },
            { dice: '2d6', type: 'fire', condition: 'if the target is Prone' },
          ],
        },
      ],
    };
    const d = deriveCreature(s, tables);
    expect(plain(actionBlock(s.traits![0]!, d.traits[0], d))).toBe(
      'Undead Fortitude. If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.',
    );
    expect(plain(actionBlock(s.actions![0]!, d.actions[0], d))).toBe(
      'Scimitar. *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.',
    );
    expect(plain(actionBlock(s.actions![1]!, d.actions[1], d))).toBe(
      'Light Hammer. *Melee or Ranged Attack Roll:* +4 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. or range 20/60 ft. *Hit:* 9 (3d4 + 2) Bludgeoning damage.',
    );
    expect(plain(actionBlock(s.actions![2]!, d.actions[2], d))).toBe(
      'Gore. *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage, plus 7 (2d6) Fire damage if the target is Prone.',
    );
  });

  it('prints SRD 5.2 forms: uses casing, the senses semicolon, and minus signs (#87)', async () => {
    const { senses: _senses, skills: _skills, ...base } = (await cinderHound()).stats as CreatureStats;
    const s: CreatureStats = {
      ...base,
      abilities: { ...base.abilities, dex: 8, con: 9, int: 5 },
      traits: [{ name: 'Loathsome Limbs', kind: 'other', uses: '4/day', text: 'The creature regrows a limb.' }],
      actions: [{ name: 'Slam', kind: 'melee-attack', ability: 'int', reach: 5, damage: [{ dice: '2d8', ability: 'int', type: 'bludgeoning' }] }],
    };
    const d = deriveCreature(s, tables);
    expect(plain(actionBlock(s.traits![0]!, d.traits[0], d))).toBe('Loathsome Limbs (4/Day). The creature regrows a limb.');
    expect(sensesLine(s, d)).toBe('Passive Perception 11');
    expect(sensesLine({ ...s, senses: { darkvision: 60, blindsight: 10 } }, d)).toBe('Blindsight 10 ft., Darkvision 60 ft.; Passive Perception 11');
    expect(initiativeLine(d)).toBe('\u22121 (9)');
    expect(hpLine(d)).toBe('17 (5d8 \u2212 5)');
    expect(abilityRows(s, d).find((row) => row.ability === 'INT')).toEqual({ ability: 'INT', score: 5, mod: '\u22123', save: '\u22123' });
    expect(plain(actionBlock(s.actions![0]!, d.actions[0], d))).toBe(
      'Slam. *Melee Attack Roll:* \u22121, reach 5 ft. *Hit:* 6 (2d8 \u2212 3) Bludgeoning damage.',
    );
    // Display only: the derived values keep ASCII hyphens (docs/rulesets.md#creatures).
    expect(d.hp.formula).toBe('5d8 - 5');
    expect(d.actions[0]!.damage[0]!.display).toBe('6 (2d8 - 3)');
  });
  it('renders spoken and understood languages in SRD 5.2 form (#83)', async () => {
    const base = (await cinderHound()).stats as CreatureStats;
    const line = (languages: CreatureStats['languages']) => languagesLine({ ...base, languages });
    expect(line({ spoken: ['Common', 'Giant'] })).toBe('Common, Giant');
    // Skeleton and Zombie: one understood phrase, nothing spoken.
    expect(line({ spoken: [], understood: ['Common plus one other language'] })).toBe(
      "Understands Common plus one other language but can't speak",
    );
    // Hell Hound: a single understood language.
    expect(line({ spoken: [], understood: ['Infernal'] })).toBe("Understands Infernal but can't speak");
    expect(line({ spoken: [], understood: ['Abyssal', 'Infernal'], telepathy: 60 })).toBe(
      "Understands Abyssal and Infernal but can't speak; telepathy 60 ft.",
    );
    expect(line({ spoken: ['Common'], understood: ['Giant'] })).toBe("Common; understands Giant but can't speak it");
    expect(line({ spoken: ['Common'], understood: ['Giant', 'Orc'] })).toBe(
      "Common; understands Giant and Orc but can't speak them",
    );
    expect(line({ spoken: [], note: 'see below' })).toBe('None (see below)');
  });
});

describe('SRD 5.2 forms found by the import pilot (#142)', () => {
  const build = async (patch: Partial<CreatureStats>) => {
    const s = { ...((await cinderHound()).stats as CreatureStats), ...patch };
    return { s, d: deriveCreature(s, tables) };
  };

  it('title-cases a uses note but leaves minor words lowercase', async () => {
    const { s, d } = await build({
      traits: [{ name: 'Legendary Resistance', kind: 'other', uses: '4/day, or 5/day in lair', text: 'It succeeds instead.' }],
      skills: { 'sleight-of-hand': 'proficient' },
    });
    expect(actionBlock(s.traits![0]!, d.traits[0], d).name).toBe('Legendary Resistance (4/Day, or 5/Day in Lair)');
    expect(skillsLine(s, d)).toBe('Sleight of Hand +4');
  });
  it('continues the damage sentence when the prose after it starts lowercase', async () => {
    const { s, d } = await build({
      actions: [
        { name: 'Touch', kind: 'melee-attack', ability: 'str', reach: 5, damage: [{ dice: '3d6', ability: 'str', type: 'cold' }], onHit: 'and the target has the Paralyzed condition.' },
        { name: 'Bite', kind: 'melee-attack', ability: 'str', reach: 5, damage: [{ dice: '1d6', type: 'piercing' }], onHit: 'If the target is a creature, it is cursed.' },
        { name: 'Wail', kind: 'save', ability: 'con', save: { ability: 'wis', targets: 'one creature' }, damage: [{ dice: '8d6', type: 'psychic' }], onFailure: 'and the target has the Frightened condition.' },
      ],
    });
    const body = (i: number) => actionBlock(s.actions![i]!, d.actions[i], d).body;
    expect(body(0)).toContain('*Hit:* 12 (3d6 + 2) Cold damage, and the target has the Paralyzed condition.');
    expect(body(1)).toContain('*Hit:* 3 (1d6) Piercing damage. If the target is a creature, it is cursed.');
    expect(body(2)).toContain('*Failure:* 28 (8d6) Psychic damage, and the target has the Frightened condition.');
  });
  it('names the caster and the components its spells skip in the Spellcasting intro', async () => {
    const spellcasting = { ability: 'cha' as const, noComponents: 'Material', atWill: ['Light'] };
    const { s, d } = await build({ spellcasting });
    const intro = (stats: CreatureStats, name: string) => spellcastingBlock(stats, d, new Map(), name)!.body.split(':')[0];
    expect(intro(s, 'Adult Red Dragon')).toBe(
      'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 8)',
    );
    expect(intro({ ...s, shortName: 'bandit' }, 'Bandit Captain')).toMatch(/^The bandit casts/);
  });
  it('leaves the save DC out of the Spellcasting intro when noSaveDc is set (docs/content-model.md#situational-fields)', async () => {
    const intro = async (spellcasting: CreatureStats['spellcasting']) => {
      const { s, d } = await build({ spellcasting });
      return spellcastingBlock(s, d, new Map(), 'Priest Acolyte')!.body.split('\\\n')[0];
    };
    expect(await intro({ ability: 'wis', noSaveDc: true, atWill: ['Light'] })).toBe(
      'The acolyte casts one of the following spells, using Wisdom as the spellcasting ability:',
    );
    expect(await intro({ ability: 'wis', noSaveDc: true, includeAttack: true, atWill: ['Light'] })).toBe(
      'The acolyte casts one of the following spells, using Wisdom as the spellcasting ability (+3 to hit with spell attacks):',
    );
  });
  it('joins prose that starts with a dash straight onto the damage (docs/rulesets.md#creatures)', async () => {
    const { s, d } = await build({
      actions: [{ name: 'Bite', kind: 'melee-attack', ability: 'str', reach: 5, damage: [{ dice: '1d8', ability: 'str', type: 'piercing' }], onHit: '—or {dmg:2d8+str:piercing} if the target is Grappled—plus {dmg:1d8:acid}.' }],
    });
    expect(actionBlock(s.actions![0]!, d.actions[0], d).body).toContain(
      '*Hit:* 6 (1d8 + 2) Piercing damage—or 11 (2d8 + 2) Piercing damage if the target is Grappled—plus 4 (1d8) Acid damage.',
    );
  });
  it('derives a creature with no actions, such as one with only a Reaction', async () => {
    const { d } = await build({ actions: undefined, reactions: [{ name: 'Shriek', kind: 'other', text: 'The hound shrieks.' }] });
    expect(d.actions).toEqual([]);
    expect(d.reactions).toHaveLength(1);
  });
  it('puts each spell list on its own line, with "Each" only for more than one spell', async () => {
    const { s, d } = await build({ spellcasting: { ability: 'int', atWill: ['Light'], perDay: { '2': ['Fly', 'Invisibility'], '1': ['Fireball'] } } });
    expect(spellcastingBlock(s, d, new Map(), 'Mage')!.body.split('\\\n').slice(1)).toEqual([
      '*At Will:* Light',
      '*2/Day Each:* Fly, Invisibility',
      '*1/Day:* Fireball',
    ]);
  });
  it('renders a save action\'s "Failure or Success:" line after Success', async () => {
    const { s, d } = await build({
      actions: [{ name: 'Disrupt Life', kind: 'save', ability: 'con', save: { ability: 'con', targets: 'each creature in a 20-foot Emanation' }, damage: [{ dice: '9d6', type: 'necrotic' }], onSuccess: 'Half damage.', onFailureOrSuccess: 'The hound can\'t take this action again until the start of its next turn.' }],
    });
    expect(actionBlock(s.actions![0]!, d.actions[0], d).body).toMatch(
      /\*Failure:\* 31 \(9d6\) Necrotic damage\. \*Success:\* Half damage\. \*Failure or Success:\* The hound can't take this action again until the start of its next turn\.$/,
    );
  });
  it('prints a speed note after the structured speeds', async () => {
    const { s } = await build({ speed: { walk: 30, note: '40 ft. (wolf form only)' } });
    expect(speedLine(s)).toBe('30 ft., 40 ft. (wolf form only)');
  });
  it('prints speeds and senses in a fixed order, whatever the key order', async () => {
    const { s, d } = await build({ speed: { walk: 40, swim: 30, fly: 80, climb: 40, burrow: 20 }, senses: { truesight: 30, darkvision: 120, tremorsense: 10, blindsight: 60 } });
    expect(speedLine(s)).toBe('40 ft., Burrow 20 ft., Climb 40 ft., Fly 80 ft., Swim 30 ft.');
    expect(sensesLine(s, d)).toBe('Blindsight 60 ft., Darkvision 120 ft., Tremorsense 10 ft., Truesight 30 ft.; Passive Perception 13');
  });
  it('prints every recharge value in the action name', async () => {
    const values = ['4-6', '5-6', '6', 'short-or-long-rest', 'long-rest'];
    const { s, d } = await build({ traits: values.map((recharge) => ({ name: 'Gust', kind: 'other' as const, recharge, text: 'Wind.' })) });
    expect(s.traits!.map((t, i) => actionBlock(t, d.traits[i], d).name)).toEqual([
      'Gust (Recharge 4–6)',
      'Gust (Recharge 5–6)',
      'Gust (Recharge 6)',
      'Gust (Recharge after a Short or Long Rest)',
      'Gust (Recharge after a Long Rest)',
    ]);
  });
  it('prints flat damage without dice (#166)', async () => {
    const { s, d } = await build({
      actions: [{ name: 'Bite', kind: 'melee-attack', ability: 'dex', reach: 5, damage: [{ amount: 1, type: 'piercing' }] }],
    });
    expect(actionBlock(s.actions![0]!, d.actions[0], d).body).toBe('*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 1 Piercing damage.');
  });
  it('prints a rider whose type is a note (#166)', async () => {
    const { s, d } = await build({
      actions: [{ name: 'Claw', kind: 'melee-attack', ability: 'str', reach: 10, damage: [{ dice: '1d4', ability: 'str', type: 'slashing' }, { dice: '2d6', note: 'of the type chosen for the Draconic Origin trait' }] }],
    });
    expect(actionBlock(s.actions![0]!, d.actions[0], d).body).toBe(
      '*Melee Attack Roll:* +4, reach 10 ft. *Hit:* 4 (1d4 + 2) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait.',
    );
  });
  it('prints a senses note before Passive Perception (#166)', async () => {
    const { s, d } = await build({ senses: { darkvision: 120, note: 'unimpeded by magical Darkness' } });
    expect(sensesLine(s, d)).toBe('Darkvision 120 ft. (unimpeded by magical Darkness); Passive Perception 13');
  });
  it('prints a swarm type line (#166)', async () => {
    const { s } = await build({ swarm: 'tiny', creatureType: 'beast', alignment: 'unaligned' });
    expect(sizeTypeLine(s)).toBe('Medium Swarm of Tiny Beasts, Unaligned');
    expect(sizeTypeLine({ ...s, creatureType: 'undead', alignment: 'neutral evil' })).toBe('Medium Swarm of Tiny Undead, Neutral Evil');
  });
  it('prints condition immunities as links, a qualifier as the ref’s note (#166, docs/rulesets.md#creatures)', async () => {
    const { s } = await build({
      immunities: { damage: ['poison'], conditions: [{ ref: 'condition/charmed', note: 'except from its vampire master' }, { ref: 'condition/poisoned' }] },
    });
    expect(defenseLines(s)).toEqual([
      { label: 'Immunities', value: 'Poison; {ref:condition/charmed} (except from its vampire master), {ref:condition/poisoned}', markdown: true },
    ]);
  });
  it('adds a skill adjust to the derived bonus (#166)', async () => {
    const { s, d } = await build({ skills: { stealth: { proficiency: 'proficient', adjust: 1 } } });
    expect(skillsLine(s, d)).toBe('Stealth +5');
  });
  it('joins three or more understood languages as an English list (#166)', async () => {
    const { s } = await build({ languages: { spoken: [], understood: ['Abyssal', 'Common', 'Infernal'] } });
    expect(languagesLine(s)).toBe("Understands Abyssal, Common, and Infernal but can't speak");
  });
});
