import { describe, expect, it } from 'vitest';
import { deriveCreature } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { findTokens, renderTokens } from '../../../rulesets/dnd-5e-2024/tokens.ts';
import type { CreatureStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { cinderHound } from '../../helpers.ts';

const derived = async () => deriveCreature((await cinderHound()).stats as CreatureStats, tables);

describe('renderTokens (SPEC.md §6.4)', () => {
  it('renders the cinder hound trait as the spec shows it', async () => {
    const text = 'A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes {dmg:1d4:fire}.';
    expect(renderTokens(text, await derived(), tables)).toBe(
      'A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes 2 (1d4) Fire damage.',
    );
  });

  it.each([
    ['{mod:dex}', '+2'],
    ['{mod:int}', '-3'],
    ['{pb}', '+2'],
    ['{atk:str}', '+4'],
    ['{atk:str:1}', '+5'],
    ['{atk:str:-1}', '+3'],
    ['{dc:con}', 'DC 12'],
    ['{dc:con:+2}', 'DC 14'],
    ['{dmg:2d6}', '7 (2d6)'],
    ['{dmg:2d6+str:fire}', '9 (2d6 + 2) Fire damage'],
    ['{dmg:1d4+int}', '-1 (1d4 - 3)'],
  ])('renders %s as %s', async (token, expected) => {
    expect(renderTokens(token, await derived(), tables)).toBe(expected);
  });

  it('throws on a bad token instead of rendering it', async () => {
    const d = await derived();
    expect(() => renderTokens('{nope}', d, tables)).toThrow(/unknown token/);
    expect(() => renderTokens('{mod:luck}', d, tables)).toThrow(/unknown ability/);
  });
});

describe('findTokens', () => {
  it.each([
    ['{fire}', /unknown token "\{fire\}"/],
    ['{pb:1}', /takes no arguments/],
    ['{mod}', /wrong number of arguments/],
    ['{mod:luck}', /unknown ability "luck"/],
    ['{atk:str:0}', /not a non-zero integer/],
    ['{dc:con:x}', /not a non-zero integer/],
    ['{dmg:1d7}', /dice "1d7"/],
    ['{dmg:1d6+str+dex}', /more than one ability/],
    ['{dmg:1d6:ice}', /unknown damage type "ice"/],
    ['{dmg:1d6+luck:fire}', /unknown ability "luck"/],
    ['takes {dmg:1d4 damage', /unmatched brace/],
    ['stray } brace', /unmatched brace/],
  ])('reports %s', (text, message) => {
    const errors = findTokens(text, tables).filter((m) => m.error);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toMatch(message);
  });

  it('finds no errors in well-formed text', () => {
    expect(findTokens('Hits {atk:str} for {dmg:1d6+str:fire}; {dc:wis:-1}, {pb}, {mod:cha}.', tables).every((m) => m.token)).toBe(true);
  });
});
