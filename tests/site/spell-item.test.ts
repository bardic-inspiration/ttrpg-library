import { describe, expect, it } from 'vitest';
import type { ItemStats, SpellStats } from '../../rulesets/dnd-5e-2024/types.ts';
import { chargesLine, spellLine, subtitleLine } from '../../site/src/lib/item.ts';
import { castingTimeLine, componentsLine, durationLine, levelLine, rangeLine } from '../../site/src/lib/spell.ts';
import { frostLance, wandOfFrostLances } from '../helpers.ts';

describe('spell card lines (docs/rulesets.md#spells)', async () => {
  const base = (await frostLance()).stats as SpellStats;

  it('reads a cantrip as "<School> Cantrip"', () => {
    expect(levelLine({ ...base, level: 0 })).toBe('Evocation Cantrip (Sorcerer, Wizard)');
    expect(levelLine(base)).toBe('Level 1 Evocation (Sorcerer, Wizard)');
    expect(levelLine({ ...base, level: 3, school: 'conjuration' })).toBe('Level 3 Conjuration (Sorcerer, Wizard)');
  });

  it('formats casting time, with a reaction trigger and ritual', () => {
    expect(castingTimeLine(base)).toBe('Action');
    expect(castingTimeLine({ ...base, castingTime: { amount: 1, unit: 'bonus-action' } })).toBe('Bonus Action');
    expect(castingTimeLine({ ...base, castingTime: { amount: 1, unit: 'reaction', trigger: 'when you take damage' } })).toBe(
      'Reaction, which you take when you take damage',
    );
    expect(castingTimeLine({ ...base, castingTime: { amount: 10, unit: 'minute' }, ritual: true })).toBe('10 minutes or Ritual');
    expect(castingTimeLine({ ...base, castingTime: { amount: 1, unit: 'hour' } })).toBe('1 hour');
    expect(castingTimeLine({ ...base, castingTime: { amount: 1, unit: 'action', note: '(Overgrowth) or 8 hours (Enrichment)' } })).toBe(
      'Action (Overgrowth) or 8 hours (Enrichment)',
    );
  });

  it('formats range with an area', () => {
    expect(rangeLine(base)).toBe('60 feet');
    expect(rangeLine({ ...base, range: { kind: 'self', area: { shape: 'cone', size: 15 } } })).toBe('Self (15-foot Cone)');
    expect(rangeLine({ ...base, range: { kind: 'touch' } })).toBe('Touch');
    expect(rangeLine({ ...base, range: { kind: 'distance', miles: 1 } })).toBe('1 mile');
    expect(rangeLine({ ...base, range: { kind: 'distance', miles: 500 } })).toBe('500 miles');
  });

  it('formats components, with the material as printed', () => {
    expect(componentsLine(base)).toBe('V, S, M (a sliver of ice)');
    expect(componentsLine({ ...base, components: { v: true, s: false } })).toBe('V');
    expect(componentsLine({ ...base, components: { v: false, s: true, m: { text: 'a diamond worth 300+ GP, which the spell consumes', costGp: 300, consumed: true } } })).toBe(
      'S, M (a diamond worth 300+ GP, which the spell consumes)',
    );
  });

  it('formats duration, with concentration', () => {
    expect(durationLine(base)).toBe('Instantaneous');
    expect(durationLine({ ...base, duration: { kind: 'timed', amount: 1, unit: 'minute', concentration: true } })).toBe('Concentration, up to 1 minute');
    expect(durationLine({ ...base, duration: { kind: 'timed', amount: 8, unit: 'hour', concentration: false } })).toBe('8 hours');
    expect(durationLine({ ...base, duration: { kind: 'until-dispelled', concentration: false } })).toBe('Until dispelled');
    expect(durationLine({ ...base, duration: { kind: 'until-dispelled-or-triggered', concentration: false } })).toBe('Until dispelled or triggered');
    expect(durationLine({ ...base, duration: { kind: 'timed', amount: 8, unit: 'hour', upTo: true, concentration: false } })).toBe('Up to 8 hours');
  });
});

describe('magic item card lines (docs/rulesets.md#items)', async () => {
  const wand = (await wandOfFrostLances()).stats as ItemStats;
  const names = new Map([['spell/frost-lance', 'Frost Lance']]);

  it('formats category, base item, rarity, and attunement', () => {
    expect(subtitleLine(wand)).toBe('Wand, Uncommon (Requires Attunement by a spellcaster)');
    expect(subtitleLine({ ...wand, category: 'weapon', baseItem: 'Longsword', rarity: 'very-rare', attunement: { required: false } })).toBe(
      'Weapon (Longsword), Very Rare',
    );
    expect(subtitleLine({ ...wand, category: 'wondrous-item', rarity: 'varies', attunement: { required: true } })).toBe(
      'Wondrous Item, Rarity Varies (Requires Attunement)',
    );
  });

  it('prints the rarity of each variant in place of "Rarity Varies" (docs/rulesets.md#items)', () => {
    const variants = (rarities: [string, string][]) => rarities.map(([rarity, variant]) => ({ rarity, variant }));
    expect(
      subtitleLine({ ...wand, category: 'weapon', baseItem: 'Any Ammunition', rarity: 'varies', attunement: { required: false }, rarityVariants: variants([['uncommon', '+1'], ['rare', '+2'], ['very-rare', '+3']]) }),
    ).toBe('Weapon (Any Ammunition), Uncommon (+1), Rare (+2), or Very Rare (+3)');
    expect(
      subtitleLine({ ...wand, category: 'wondrous-item', rarity: 'varies', attunement: { required: false }, rarityVariants: variants([['rare', 'Silver or Brass'], ['legendary', 'Iron']]) }),
    ).toBe('Wondrous Item, Rare (Silver or Brass) or Legendary (Iron)');
  });

  it('shows charges only when present', () => {
    expect(chargesLine(wand)).toBe('7; regains 1d6 + 1 daily at dawn');
    const { charges, ...noCharges } = wand;
    expect(chargesLine(noCharges)).toBeUndefined();
    expect(chargesLine({ ...wand, charges: { max: 12 } })).toBe('12');
    expect(chargesLine({ ...wand, charges: { max: '1d8 + 1' } })).toBe('1d8 + 1');
  });

  it('lists a spell by name with the authored numbers present, including a +0 attack bonus', () => {
    expect(spellLine(wand.spells![0]!, names)).toEqual({ name: 'Frost Lance', notes: '1 charge; +5 to hit' });
    expect(spellLine({ spell: 'Fireball', chargeCost: 3, saveDc: 15 }, names)).toEqual({ name: 'Fireball', notes: '3 charges; save DC 15' });
    expect(spellLine({ spell: 'Magic Missile', chargeCost: 1, maxChargeCost: 3 }, names)).toEqual({ name: 'Magic Missile', notes: '1–3 charges' });
    expect(spellLine({ spell: 'Light', attackBonus: 0 }, names)).toEqual({ name: 'Light', notes: '+0 to hit' });
    expect(spellLine({ spell: 'Light' }, names)).toEqual({ name: 'Light' });
  });
});
