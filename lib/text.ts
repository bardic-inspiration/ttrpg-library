// Ruleset-independent text helpers shared by the validator, the build, and the
// site (SPEC.md §4). No dependencies.

/** `text` with diacritics removed: "Faerûn" → "Faerun", "Élan" → "Elan". */
export function foldDiacritics(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '');
}

/** Folded text, plus where each folded UTF-16 unit came from in the original. */
function foldWithMap(text: string): { folded: string; start: number[]; end: number[] } {
  let folded = '';
  const start: number[] = [];
  const end: number[] = [];
  let at = 0;
  for (const char of text) {
    const f = foldDiacritics(char);
    for (let k = 0; k < f.length; k++) {
      start.push(at);
      end.push(at + char.length);
    }
    folded += f;
    at += char.length;
  }
  return { folded, start, end };
}

const WORD_CHAR = '[\\p{L}\\p{N}_]';
const APOSTROPHE = "['’]";
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A pattern source for `term` and its cheap English variants, for use on
 * diacritic-folded text with the `iu` flags:
 *
 * - words of a multi-word term joined by whitespace, a hyphen, or nothing
 *   ("mind flayer", "mind-flayer", "mindflayer");
 * - plurals in -s and -es, and -y → -ies ("beholders", "rarys", "raries");
 * - possessives with `'` or `’` ("Tasha's", "beholders'").
 *
 * Irregular plurals aren't derived; list them as their own terms.
 */
export function termPattern(term: string): string {
  const words = foldDiacritics(term).trim().split(/[\s-]+/);
  const parts = words.map((word) => escapeRegExp(word).replace(/['’]/g, APOSTROPHE));
  const last = parts.length - 1;
  parts[last] = (parts[last] ?? '').replace(/y$/i, '(?:y|ie)');
  const plural = '(?:e?s)?';
  const possessive = `(?:${APOSTROPHE}s?)?`;
  return `(?<!${WORD_CHAR})${parts.join('[\\s-]*')}${plural}${possessive}(?!${WORD_CHAR})`;
}

export type TermMatcher = (text: string) => string[];

/**
 * A function that finds `terms` in text, case- and diacritic-insensitively, on
 * word boundaries, with the variants `termPattern` allows. It returns the text
 * each matching term matched, as written, once per term, in `terms` order.
 */
export function termMatcher(terms: string[]): TermMatcher {
  const patterns = terms.map((term) => new RegExp(termPattern(term), 'iu'));
  return (text) => {
    const { folded, start, end } = foldWithMap(text);
    return patterns.flatMap((pattern) => {
      const match = pattern.exec(folded);
      if (!match) return [];
      const from = start[match.index] ?? 0;
      const to = end[match.index + match[0].length - 1] ?? text.length;
      return [text.slice(from, to)];
    });
  };
}
