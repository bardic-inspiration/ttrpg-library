// A ruleset's phrase book (docs/site.md#wording): its fixed sentences, with named slots, and its
// vocabulary, the display name of each enum value. Templates fill sentences; they hold none.

import type { Articles, Plurals } from './grammar.ts';
import { concat, phrase, type Phrase, type PhraseLike } from './phrase.ts';

export interface PhraseBook {
  /** Sentences by key, such as `condition.intro`, with `{slot}` holes. */
  sentences: Record<string, string>;
  /** Display names by enum, then stored value: `vocabulary.ability.int` is "Intelligence". */
  vocabulary: Record<string, Record<string, string>>;
  plurals: Plurals;
  articles: Articles;
}

/**
 * The sentence `key` with its slots filled. Every slot in the sentence must be given, and every
 * value must have a slot, so a sentence and its caller can't drift apart.
 */
export function sentence(book: PhraseBook, key: string, slots: Record<string, PhraseLike> = {}): Phrase {
  const template = book.sentences[key];
  if (template === undefined) throw new Error(`no sentence "${key}" in the phrase book`);
  const used = new Set<string>();
  const parts = template.split(/(\{[a-zA-Z]+\})/).map((piece) => {
    const slot = /^\{([a-zA-Z]+)\}$/.exec(piece)?.[1];
    if (slot === undefined) return phrase(piece);
    const value = slots[slot];
    if (value === undefined) throw new Error(`sentence "${key}" needs slot "${slot}"`);
    used.add(slot);
    return phrase(value);
  });
  const unused = Object.keys(slots).filter((slot) => !used.has(slot));
  if (unused.length > 0) throw new Error(`sentence "${key}" has no slot ${unused.map((s) => `"${s}"`).join(', ')}`);
  return concat(...parts);
}

/** The display name of an enum value, or `undefined` when the vocabulary has none. */
export const vocabularyName = (book: PhraseBook, vocabulary: string, value: string): string | undefined => book.vocabulary[vocabulary]?.[value];

/** The display name of an enum value; a missing one is a build error, so every value has a name. */
export function word(book: PhraseBook, vocabulary: string, value: string): string {
  const name = vocabularyName(book, vocabulary, value);
  if (name === undefined) throw new Error(`no "${value}" in the phrase book's ${vocabulary} vocabulary`);
  return name;
}
