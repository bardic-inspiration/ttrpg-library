import { describe, expect, it } from 'vitest';
import { formatRarity, formatSpellLevel, formatValue } from '../../site/src/lib/format.ts';

describe('display formatters (SPEC.md §7 `format`)', () => {
  it('formats spell levels', () => {
    expect([0, 1, 2, 3, 4, 9].map(formatSpellLevel)).toEqual(['Cantrip', '1st level', '2nd level', '3rd level', '4th level', '9th level']);
  });

  it('formats rarities', () => {
    expect(formatRarity('very-rare')).toBe('Very rare');
  });

  it('formats by name, booleans as Yes and No, and anything else as stored', () => {
    expect(formatValue(0.25, 'cr')).toBe('1/4');
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue('Monstrosity')).toBe('Monstrosity');
  });
});
