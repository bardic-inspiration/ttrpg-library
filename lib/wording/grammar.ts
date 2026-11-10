// English grammar for composed text (docs/site.md#wording), with no ruleset knowledge. A ruleset's
// irregular plurals and article exceptions come from its phrase book. Every type composes with
// these; no type module defines its own.

import { concat, joinWith, phrase, type Phrase, type PhraseLike } from './phrase.ts';

/** Words title case leaves lowercase unless they come first. */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'per', 'the', 'to', 'with']);

/** The first letter in capitals: `fly` → "Fly". */
export const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Each word capitalized but a minor one after the first, splitting on spaces, hyphens, and
 * slashes: `sleight-of-hand` → "Sleight of Hand", `4/day` → "4/Day".
 */
export const titleCase = (value: string): string =>
  value
    .split(/[\s-]+/)
    .map((word, i) => (i > 0 && MINOR_WORDS.has(word) ? word : word.split('/').map(capitalize).join('/')))
    .join(' ');

/** A slug or camelCase key as a sentence-case label: `castingTime` → "Casting time". */
export const label = (key: string): string => capitalize(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase());

export type Conjunction = 'and' | 'or';

/** "A", "A and B", "A, B, and C", with "or" for a choice. */
export function list(items: PhraseLike[], conjunction: Conjunction): Phrase {
  if (items.length <= 2) return joinWith(items, ` ${conjunction} `);
  return concat(joinWith(items.slice(0, -1), ', '), `, ${conjunction} `, items.at(-1)!);
}

/** Irregular and unchanging plurals, lowercase singular → plural (a phrase book's `plurals`). */
export type Plurals = Record<string, string>;

/**
 * A noun's plural: an irregular or unchanging one from `irregular`, matched ignoring case and
 * keeping the noun's capital, else "y" after a consonant → "ies", else an added "s".
 */
export function plural(noun: string, irregular: Plurals = {}): string {
  const known = irregular[noun.toLowerCase()];
  if (known !== undefined) return noun.charAt(0) === noun.charAt(0).toUpperCase() ? capitalize(known) : known;
  return /[^aeiou]y$/i.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`;
}

/** "1 hour", "10 minutes": a count and its noun, plural unless it's 1. */
export const counted = (n: number, noun: string, irregular: Plurals = {}): string => `${n} ${n === 1 ? noun : plural(noun, irregular)}`;

/** Words whose article isn't their first letter's: lowercase word → "a" or "an" (a phrase book's `articles`). */
export type Articles = Record<string, 'a' | 'an'>;

/** "a" or "an" for a word: by its first letter, unless `exceptions` names it ("an hour", "a unicorn"). */
export function article(word: string, exceptions: Articles = {}): 'a' | 'an' {
  const first = word.split(/\s+/)[0]?.toLowerCase() ?? '';
  return exceptions[first] ?? (/^[aeiou]/.test(first) ? 'an' : 'a');
}

/** The word with its article: "a Dragonborn", "an Elf". */
export const withArticle = (word: string, exceptions: Articles = {}): Phrase => phrase(`${article(word, exceptions)} ${word}`);
