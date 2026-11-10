// The wording layer's grammar and phrase book (docs/site.md#wording), with no ruleset knowledge.
import { describe, expect, it } from 'vitest';
import {
  article,
  capitalize,
  concat,
  counted,
  label,
  link,
  list,
  markdown,
  plural,
  sentence,
  text,
  titleCase,
  toMarkdown,
  toPlain,
  withArticle,
  withNote,
  word,
  type PhraseBook,
} from '../../lib/wording/index.ts';
import { phrases } from '../../rulesets/dnd-5e-2024/index.ts';
import { tables } from '../../rulesets/dnd-5e-2024/index.ts';
import registry from '../../config/types.json' with { type: 'json' };

describe('casing', () => {
  it('title-cases with minor words lowercase but first, across hyphens and slashes', () => {
    expect(titleCase('sleight-of-hand')).toBe('Sleight of Hand');
    expect(titleCase('area-of-effect')).toBe('Area of Effect');
    expect(titleCase('of mice')).toBe('Of Mice');
    expect(titleCase('4/day')).toBe('4/Day');
    expect(capitalize('fly')).toBe('Fly');
    expect(label('castingTime')).toBe('Casting time');
  });
});

describe('lists, plurals, and articles', () => {
  it('joins an English list with a conjunction', () => {
    const plain = (items: string[], c: 'and' | 'or') => toPlain(list(items, c));
    expect(plain(['A'], 'and')).toBe('A');
    expect(plain(['A', 'B'], 'or')).toBe('A or B');
    expect(plain(['A', 'B', 'C'], 'and')).toBe('A, B, and C');
  });

  it('pluralizes by rule and by the irregular list, keeping a capital', () => {
    expect(plural('Beast')).toBe('Beasts');
    expect(plural('Monstrosity')).toBe('Monstrosities');
    expect(plural('day')).toBe('days');
    expect(plural('Undead', { undead: 'undead' })).toBe('Undead');
    expect(counted(1, 'hour')).toBe('1 hour');
    expect(counted(10, 'minute')).toBe('10 minutes');
  });

  it('picks "a" or "an" by the first letter, with exceptions', () => {
    expect(article('Dragonborn')).toBe('a');
    expect(article('Elf')).toBe('an');
    expect(article('hour', { hour: 'an' })).toBe('an');
    expect(toPlain(withArticle('Orc'))).toBe('an Orc');
  });
});

describe('phrases', () => {
  it('render to markdown with links as tokens, display text after a space, and text escaped', () => {
    const p = concat(withNote(link('equipment/parchment'), '10 sheets'), ', ', link('equipment/clothes-travelers', "Traveler's Clothes"), ' *', markdown('*x*'));
    expect(toMarkdown(p)).toBe("{ref:equipment/parchment} (10 sheets), {ref:equipment/clothes-travelers Traveler's Clothes} \\**x*");
    expect(toPlain(p, new Map([['equipment/parchment', 'Parchment']]))).toBe("Parchment (10 sheets), Traveler's Clothes **x*");
    expect(text('')).toEqual([]);
  });
});

describe('the phrase book', () => {
  const book: PhraseBook = { sentences: { greet: 'Hello, {who}.' }, vocabulary: { size: { tiny: 'Tiny' } }, plurals: {}, articles: {} };

  it('fills a sentence’s slots, and fails on a missing or extra slot', () => {
    expect(toPlain(sentence(book, 'greet', { who: 'Ash' }))).toBe('Hello, Ash.');
    expect(() => sentence(book, 'greet')).toThrow('sentence "greet" needs slot "who"');
    expect(() => sentence(book, 'greet', { who: 'x', extra: 'y' })).toThrow('sentence "greet" has no slot "extra"');
    expect(() => sentence(book, 'missing')).toThrow('no sentence "missing"');
  });

  it('names enum values from the vocabulary, and fails on a missing one', () => {
    expect(word(book, 'size', 'tiny')).toBe('Tiny');
    expect(() => word(book, 'size', 'huge')).toThrow('no "huge" in the phrase book\'s size vocabulary');
  });

  it('has every vocabulary a registry facet reads', () => {
    const facets = Object.values(registry['dnd-5e-2024']!.types).flatMap((t) => t.facets as { path: string; vocabulary?: string }[]);
    const missing = facets.filter((f) => f.vocabulary !== undefined && phrases.vocabulary[f.vocabulary] === undefined).map((f) => f.path);
    expect(missing).toEqual([]);
    expect(facets.filter((f) => f.vocabulary !== undefined).length).toBeGreaterThan(0);
  });

  it('dnd-5e-2024 names every shared enum value', () => {
    expect(Object.keys(phrases.vocabulary.ability!)).toEqual(tables.abilities);
    expect(Object.keys(phrases.vocabulary.skill!)).toEqual(Object.keys(tables.skills));
    expect(Object.keys(phrases.vocabulary.size!)).toEqual(Object.keys(tables.sizes));
    expect(Object.keys(phrases.vocabulary.creatureType!)).toEqual(tables.creatureTypes);
    expect(Object.keys(phrases.vocabulary.damageType!)).toEqual(tables.damageTypes);
  });
});
