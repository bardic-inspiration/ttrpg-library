// Every ruleset's phrase book (docs/site.md#wording), for code that serves more than one ruleset,
// such as the gallery's filter labels.

import type { PhraseBook } from '../../../lib/wording/book.ts';

const books = import.meta.glob<PhraseBook>('../../../rulesets/*/phrases.json', { eager: true, import: 'default' });

/** A ruleset's phrase book, or undefined for a ruleset with none. */
export const phraseBook = (ruleset: string): PhraseBook | undefined => books[`../../../rulesets/${ruleset}/phrases.json`];
