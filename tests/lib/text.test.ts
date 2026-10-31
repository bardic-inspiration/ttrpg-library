import { describe, expect, it } from 'vitest';
import { foldDiacritics, termMatcher } from '../../lib/text.ts';

describe('foldDiacritics', () => {
  it('strips combining marks', () => {
    expect(foldDiacritics('Faerûn, Élan, naïve')).toBe('Faerun, Elan, naive');
  });
});

describe('termMatcher', () => {
  const matches = termMatcher(['Beholder', 'Mind Flayer', 'Faerûn', 'Tasha', 'Rary', 'Baldur’s Gate']);

  it('matches case-insensitively on word boundaries', () => {
    expect(matches('A BEHOLDER floats here.')).toEqual(['BEHOLDER']);
    expect(matches('the beholder-kin')).toEqual(['beholder']);
    expect(matches('Tashan rugs, a beholderling, and Rarytan wine')).toEqual([]);
  });

  it.each([
    ['a plural in -s', 'a nest of beholders', 'beholders'],
    ['a plural in -es', 'two Tashaes', 'Tashaes'],
    ['a plural in -y → -ies', 'the Raries of old', 'Raries'],
    ['a possessive', "Tasha's spell", "Tasha's"],
    ['a curly possessive', 'Tasha’s spell', 'Tasha’s'],
    ['a plural possessive', "the beholders' lair", "beholders'"],
  ])('matches %s', (_label, text, found) => {
    expect(matches(text)).toEqual([found]);
  });

  it('joins multi-word terms with whitespace, a hyphen, or nothing', () => {
    expect(matches('a mind\nflayer')).toEqual(['mind\nflayer']);
    expect(matches('a Mind-Flayer')).toEqual(['Mind-Flayer']);
    expect(matches('two mindflayers')).toEqual(['mindflayers']);
  });

  it('ignores diacritics on either side, and returns the text as written', () => {
    expect(matches('the roads of faerûn')).toEqual(['faerûn']);
    expect(matches('the roads of Faerun')).toEqual(['Faerun']);
    expect(termMatcher(['Faerun'])('Faerûn’s roads')).toEqual(['Faerûn’s']);
    expect(matches('Faerûnian roads')).toEqual([]);
  });

  it('accepts either apostrophe inside a term', () => {
    expect(matches("Baldur's Gate")).toEqual(["Baldur's Gate"]);
  });

  it('returns one match per term, in term order', () => {
    expect(matches('Tasha met a beholder and another beholder.')).toEqual(['beholder', 'Tasha']);
  });
});
