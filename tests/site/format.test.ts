import { describe, expect, it } from 'vitest';
import { formatRarity, formatSpellLevel, formatTitle, formatValue } from '../../site/src/lib/format.ts';

describe('display formatters (docs/site.md#type-registry `format`)', () => {
  it('formats spell levels', () => {
    expect([0, 1, 2, 3, 4, 9].map(formatSpellLevel)).toEqual(['Cantrip', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 9']);
  });

  it('formats rarities', () => {
    expect(formatRarity('very-rare')).toBe('Very Rare');
  });

  it('formats enum slugs as title case', () => {
    expect(formatTitle('wondrous-item')).toBe('Wondrous Item');
    expect(formatTitle('bonus-action')).toBe('Bonus Action');
    expect(formatValue('evocation', 'title')).toBe('Evocation');
  });

  it('formats by name, booleans as Yes and No, and anything else as stored', () => {
    expect(formatValue(0.25, 'cr')).toBe('1/4');
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue('Monstrosity')).toBe('Monstrosity');
  });
});
