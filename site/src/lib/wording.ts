// The site's access to the wording layer (docs/site.md#wording) for the dnd-5e-2024 composers: the
// ruleset's phrase book, bound to the shared grammar. Composers build text only through these.

import { phrases } from '../../../rulesets/dnd-5e-2024/index.ts';
import {
  article as articleFor,
  concat,
  link,
  counted as countedWith,
  plural as pluralWith,
  sentence,
  toMarkdown,
  toPlain,
  withArticle as withArticleFor,
  word,
  type Phrase,
  type PhraseLike,
} from '../../../lib/wording/index.ts';

export * from '../../../lib/wording/grammar.ts';
export * from '../../../lib/wording/phrase.ts';
export { phrases };

/** The phrase book's sentence `key`, slots filled, as a phrase. */
export const say = (key: string, slots?: Record<string, PhraseLike>): Phrase => sentence(phrases, key, slots);

/** The sentence as markdown, for a line that carries links or rules text. */
export const sayMarkdown = (key: string, slots?: Record<string, PhraseLike>): string => toMarkdown(say(key, slots));

/** The sentence as plain text, for a line with no links. */
export const sayText = (key: string, slots?: Record<string, PhraseLike>): string => toPlain(say(key, slots));

/** The display name of an enum value from the vocabulary: `name('ability', 'int')` is "Intelligence". */
export const name = (vocabulary: string, value: string): string => word(phrases, vocabulary, value);

/** A noun's plural, with the phrase book's irregular ones. */
export const pluralOf = (noun: string): string => pluralWith(noun, phrases.plurals);

/** "1 hour", "10 minutes". */
export const countOf = (n: number, noun: string): string => countedWith(n, noun, phrases.plurals);

/** The noun for a count: "effect" for 1, "effects" otherwise. */
export const nounFor = (n: number, noun: string): string => (n === 1 ? noun : pluralOf(noun));

/**
 * A counted link's words: the target's name in the plural as display text, "Javelins", or the
 * link with an "s" after it when the name isn't known.
 */
export const pluralLink = (ref: string, names: Map<string, string>): Phrase => {
  const target = names.get(ref);
  return target === undefined ? concat(link(ref), 's') : link(ref, pluralOf(target));
};

/** "a" or "an", with the phrase book's exceptions. */
export const articleOf = (word: string): 'a' | 'an' => articleFor(word, phrases.articles);

/** "a Dragonborn", "an Elf". */
export const withArticle = (word: string): Phrase => withArticleFor(word, phrases.articles);
