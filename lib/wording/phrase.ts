// Composed text (docs/site.md#wording): what a template builds from structured fields, as a list of
// parts. A part is plain text, markdown already written (rules text placed inside a composed
// line), or a link to an entry, primitive, group, or component, optionally with display text. One
// form serves every consumer: templates render it as markdown, and search, PR summaries, and
// exports read it as plain text.

/** Plain text, escaped when rendered as markdown. */
export interface TextPart {
  text: string;
}

/** Markdown kept as written: a `Text` field inside a composed line. */
export interface MarkdownPart {
  markdown: string;
}

/** A link by key, `<type>/<id>`. It reads its target's name, or `text` where given. */
export interface LinkPart {
  ref: string;
  text?: string;
}

export type Part = TextPart | MarkdownPart | LinkPart;
export type Phrase = Part[];

/** Anything a phrase can be built from: a string is plain text. */
export type PhraseLike = string | Part | Phrase;

/** Plain text as a phrase. */
export const text = (value: string): Phrase => (value === '' ? [] : [{ text: value }]);

/** Markdown, such as a `Text` field, as a phrase. */
export const markdown = (value: string): Phrase => (value === '' ? [] : [{ markdown: value }]);

/** A link, reading its target's name or `display`. */
export const link = (ref: string, display?: string): Phrase => [display === undefined ? { ref } : { ref, text: display }];

/** Any phrase-like value as a phrase. */
export function phrase(value: PhraseLike): Phrase {
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return value;
  return [value];
}

/** Phrases one after another. */
export const concat = (...parts: PhraseLike[]): Phrase => parts.flatMap(phrase);

/** Phrases with `separator` between them. */
export const joinWith = (items: PhraseLike[], separator: PhraseLike): Phrase =>
  items.flatMap((item, i) => (i === 0 ? phrase(item) : [...phrase(separator), ...phrase(item)]));

/** `name (note)`, or `name` without a note. */
export const withNote = (name: PhraseLike, note: PhraseLike | undefined): Phrase =>
  note === undefined ? phrase(name) : concat(name, ' (', note, ')');

/** The markdown-subset characters that would change how plain text renders. */
export const escapeMarkdown = (value: string): string => value.replace(/[\\`*_[\]<>#~|!&]/g, (c) => `\\${c}`);

/** A link token, `{ref:<key>}` or `{ref:<key> <text>}` (docs/content-model.md#references). */
export const refToken = (ref: string, display?: string): string => (display === undefined ? `{ref:${ref}}` : `{ref:${ref} ${display}}`);

/** The phrase as markdown: text escaped, markdown as written, links as tokens. */
export const toMarkdown = (value: PhraseLike): string =>
  phrase(value)
    .map((part) => ('ref' in part ? refToken(part.ref, part.text) : 'markdown' in part ? part.markdown : escapeMarkdown(part.text)))
    .join('');

/**
 * The phrase as plain words: links as their display text or their target's name from `names`,
 * markdown with its markup and tokens resolved by `plainMarkdown`.
 */
export const toPlain = (value: PhraseLike, names: Map<string, string> = new Map(), plainMarkdown: (md: string) => string = (md) => md): string =>
  phrase(value)
    .map((part) => ('ref' in part ? (part.text ?? names.get(part.ref) ?? part.ref) : 'markdown' in part ? plainMarkdown(part.markdown) : part.text))
    .join('');
