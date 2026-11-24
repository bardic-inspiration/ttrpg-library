// Every ruleset's phrase book (docs/site.md#wording), for code that serves more than one ruleset,
// such as the gallery's filter labels.

import type { PhraseBook } from '../../../lib/wording/book.ts';

// The library's phrase books (docs/site.md#library-root), matched by the ruleset folder ending the key.
const books = import.meta.glob<PhraseBook>('@library/rulesets/*/phrases.json', { eager: true, import: 'default' });

/** A ruleset's phrase book, or undefined for a ruleset with none. */
export const phraseBook = (ruleset: string): PhraseBook | undefined =>
  Object.entries(books).find(([key]) => key.endsWith(`/rulesets/${ruleset}/phrases.json`))?.[1];
