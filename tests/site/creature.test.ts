import { describe, expect, it } from 'vitest';
import { deriveCreature } from '../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../rulesets/dnd-5e-2024/index.ts';
import type { CreatureStats } from '../../rulesets/dnd-5e-2024/types.ts';
import {
  abilityRows,
  actionBlock,
  crLine,
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

describe('creature stat block text (SPEC.md §6.5, §6.9)', () => {
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
    expect(plain(actionBlock(s.actions[0]!, d.actions[0], d))).toBe(
      'Bite. *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage.',
    );
    expect(plain(actionBlock(s.actions[1]!, d.actions[1], d))).toBe(
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
    expect(plain(actionBlock(s.actions[0]!, d.actions[0], d))).toBe(
      'Spit. *Ranged Attack Roll:* +4, range 30/120 ft. *Hit:* 5 (1d6 + 2) Acid damage.',
    );
    const names = new Map([['spell/frost-lance', 'Frost Lance']]);
    expect(plain(spellcastingBlock(s, d, names)!)).toBe(
      'Spellcasting. The creature casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 11, +3 to hit with spell attacks): *At Will:* Light, Frost Lance *1/Day Each:* Fog Cloud',
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
    expect(sensesLine({ ...s, senses: { darkvision: 60, blindsight: 10 } }, d)).toBe('Darkvision 60 ft., Blindsight 10 ft.; Passive Perception 11');
    expect(initiativeLine(d)).toBe('\u22121 (9)');
    expect(hpLine(d)).toBe('17 (5d8 \u2212 5)');
    expect(abilityRows(s, d).find((row) => row.ability === 'INT')).toEqual({ ability: 'INT', score: 5, mod: '\u22123', save: '\u22123' });
    expect(plain(actionBlock(s.actions[0]!, d.actions[0], d))).toBe(
      'Slam. *Melee Attack Roll:* \u22121, reach 5 ft. *Hit:* 6 (2d8 \u2212 3) Bludgeoning damage.',
    );
    // Display only: the derived values keep ASCII hyphens (SPEC.md §6.5).
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
      "Understands Abyssal, Infernal but can't speak; telepathy 60 ft.",
    );
    expect(line({ spoken: ['Common'], understood: ['Giant'] })).toBe("Common; understands Giant but can't speak it");
    expect(line({ spoken: ['Common'], understood: ['Giant', 'Orc'] })).toBe(
      "Common; understands Giant, Orc but can't speak them",
    );
    expect(line({ spoken: [], note: 'see below' })).toBe('None (see below)');
  });
});
