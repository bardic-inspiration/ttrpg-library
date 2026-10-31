import { describe, expect, it } from 'vitest';
import { abilityMod, deriveCreature, diceAverage } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { CreatureStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { cinderHound } from '../../helpers.ts';

const stats = async (patch: Partial<CreatureStats> = {}): Promise<CreatureStats> => ({
  ...((await cinderHound()).stats as CreatureStats),
  ...patch,
});

describe('cinder hound (SPEC.md §6.9)', () => {
  it('derives exactly the values the spec renders', async () => {
    const d = deriveCreature(await stats(), tables);
    expect(d.initiative).toEqual({ bonus: 2, score: 12 });
    expect(d.hp).toEqual({ die: 8, modifier: 10, formula: '5d8 + 10', average: 32 });
    expect(d.skills).toEqual({ perception: 3, stealth: 4 });
    expect(d.passivePerception).toBe(13);
    expect(d.xp).toBe(450);
    expect(d.pb).toBe(2);
    expect(d.actions[0]).toEqual({
      attackBonus: 4,
      damage: [
        { modifier: 2, average: 6, display: '6 (1d8 + 2)' },
        { modifier: 0, average: 3, display: '3 (1d6)' },
      ],
    });
    expect(d.actions[1]).toEqual({ saveDc: 12, damage: [{ modifier: 0, average: 10, display: '10 (3d6)' }] });
    expect(d.traits[0]).toEqual({ damage: [] });
    expect(d.xpInLair).toBeUndefined();
    expect(d.spellcasting).toBeUndefined();
  });
});

describe('deriveCreature', () => {
  it('computes ability modifiers by floor((score - 10) / 2)', () => {
    expect([1, 8, 9, 10, 11, 30].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 10]);
  });

  it('floors dice averages', () => {
    expect(diceAverage('1d8')).toBe(4);
    expect(diceAverage('3d6')).toBe(10);
    expect(diceAverage('2d20')).toBe(21);
  });

  it('reads PB and XP from the CR table, including fractions and the top row', async () => {
    expect(deriveCreature(await stats({ cr: 0.25 }), tables)).toMatchObject({ pb: 2, xp: 50 });
    expect(deriveCreature(await stats({ cr: 5 }), tables)).toMatchObject({ pb: 3, xp: 1800 });
    expect(deriveCreature(await stats({ cr: 17 }), tables)).toMatchObject({ pb: 6, xp: 18000 });
    expect(deriveCreature(await stats({ cr: 30 }), tables)).toMatchObject({ pb: 9, xp: 155000 });
  });

  it('gives a CR 0 creature 10 XP when it deals damage, else 0', async () => {
    expect(deriveCreature(await stats({ cr: 0 }), tables).xp).toBe(10);
    const harmless = await stats({ cr: 0, traits: [], actions: [{ name: 'Wag', kind: 'other', text: 'It wags.' }] });
    expect(deriveCreature(harmless, tables).xp).toBe(0);
  });

  it('adds the next row as in-lair XP, and none past CR 30', async () => {
    expect(deriveCreature(await stats({ lair: true }), tables).xpInLair).toBe(700);
    expect(deriveCreature(await stats({ cr: 30, lair: true }), tables).xpInLair).toBeUndefined();
  });

  it('applies initiative proficiency, expertise, and adjust', async () => {
    expect(deriveCreature(await stats({ initiative: { proficiency: 'proficient' } }), tables).initiative.bonus).toBe(4);
    expect(deriveCreature(await stats({ initiative: { proficiency: 'expertise', adjust: -1 } }), tables).initiative).toEqual({
      bonus: 5,
      score: 15,
    });
  });

  it('takes the hit die from the first size, drops a zero modifier, and keeps HP at least 1', async () => {
    const base = await stats();
    expect(deriveCreature({ ...base, size: ['large', 'medium'] }, tables).hp.formula).toBe('5d10 + 10');
    const average = { ...base, abilities: { ...base.abilities, con: 10 } };
    expect(deriveCreature(average, tables).hp).toMatchObject({ formula: '5d8', average: 22 });
    const frail = { ...base, hitDice: 1, size: ['tiny' as const], abilities: { ...base.abilities, con: 1 } };
    expect(deriveCreature(frail, tables).hp).toMatchObject({ formula: '1d4 - 5', average: 1 });
  });

  it('adds PB to proficient saves and doubles it for skill expertise', async () => {
    const d = deriveCreature(await stats({ saveProficiencies: ['dex'], skills: { stealth: 'expertise' } }), tables);
    expect(d.saves).toMatchObject({ dex: 4, con: 2 });
    expect(d.skills).toEqual({ stealth: 6 });
    expect(d.passivePerception).toBe(11);
  });

  it('applies action adjust and damage bonus, and shows a negative modifier', async () => {
    const d = deriveCreature(
      await stats({
        actions: [
          {
            name: 'Claw',
            kind: 'melee-attack',
            ability: 'int',
            adjust: 1,
            reach: 5,
            damage: [{ dice: '2d6', ability: 'int', bonus: 1, type: 'slashing' }],
          },
        ],
      }),
      tables,
    );
    expect(d.actions[0]).toEqual({ attackBonus: 0, damage: [{ modifier: -2, average: 5, display: '5 (2d6 - 2)' }] });
  });

  it('derives legendary actions and spellcasting', async () => {
    const d = deriveCreature(
      await stats({
        legendaryActions: { uses: 3, items: [{ name: 'Snap', kind: 'melee-attack', ability: 'str', reach: 5 }] },
        spellcasting: { ability: 'wis', adjust: 1, atWill: ['Light'] },
      }),
      tables,
    );
    expect(d.legendaryActions.items[0]).toEqual({ attackBonus: 4, damage: [] });
    expect(d.spellcasting).toEqual({ dc: 12, attackBonus: 4 });
  });
});
