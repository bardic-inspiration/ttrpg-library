// Text-field checks for every type (SPEC.md §5.5, §11, §6.8 "All types"):
// the markdown subset and the blocklist.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Lexer, type Token } from 'marked';

/**
 * Constructs outside the §5.5 subset, by `marked` token type. The site renders
 * text with `marked` too, so the check sees the same structure as the reader.
 * `def` is a reference-link definition (`[x]: https://...`).
 */
const DISALLOWED: Record<string, string> = {
  heading: 'a heading',
  link: 'a link',
  def: 'a link',
  image: 'an image',
  html: 'HTML',
  table: 'a table',
};

/** Child tokens of a block or inline token, whatever key `marked` keeps them under. */
function children(token: Token): Token[] {
  const t = token as Token & { tokens?: Token[]; items?: Token[] };
  return [...(t.tokens ?? []), ...(t.items ?? [])];
}

/** The disallowed constructs in `text`, each once, in order of first appearance. */
export function markdownViolations(text: string): string[] {
  const found = new Set<string>();
  const visit = (tokens: Token[]) => {
    for (const token of tokens) {
      const name = DISALLOWED[token.type];
      if (name) found.add(name);
      else visit(children(token));
    }
  };
  visit(new Lexer().lex(text));
  return [...found];
}

/** One message per disallowed construct in the text at `path`. */
export function checkMarkdown(path: string, text: string): string[] {
  return markdownViolations(text).map(
    (name) => `${path}: ${name} is not allowed; text fields use only paragraphs, **bold**, *italic*, lists, and line breaks`,
  );
}

export const BLOCKLIST_FILE = 'config/blocklist.json';

/** Reads the blocklist: a JSON array of non-empty strings. */
export async function loadBlocklist(root: string): Promise<string[]> {
  const terms: unknown = JSON.parse(await readFile(join(root, BLOCKLIST_FILE), 'utf8'));
  if (!Array.isArray(terms) || !terms.every((t) => typeof t === 'string' && t.trim() !== '')) {
    throw new Error(`${BLOCKLIST_FILE} must be a JSON array of non-empty strings`);
  }
  return terms as string[];
}

/** A term matched case-insensitively on word boundaries; spaces in the term match any run of whitespace. */
function termPattern(term: string): RegExp {
  const body = term
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  // `\b` is ASCII-only, so "Faerûn" needs Unicode-aware boundaries.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'iu');
}

export type BlocklistMatcher = (text: string) => string[];

/** A function that returns the text each blocklisted term matched, in blocklist order. */
export function blocklistMatcher(terms: string[]): BlocklistMatcher {
  const patterns = terms.map(termPattern);
  return (text) => patterns.flatMap((pattern) => pattern.exec(text)?.[0] ?? []);
}

/** Every string under `value` with its path, such as `stats.actions[0].text`. */
export function stringsIn(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, i) => stringsIn(item, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => stringsIn(item, path ? `${path}.${key}` : key));
  }
  return [];
}

/**
 * The §11 blocklist over `name`, `summary`, `description`, and every string in
 * `stats` (which holds `descriptors`). One message per match.
 */
export function checkBlocklist(
  entry: { name: string; summary: string; description?: string; stats: unknown },
  matches: BlocklistMatcher,
): string[] {
  const fields = [
    { path: 'name', text: entry.name },
    { path: 'summary', text: entry.summary },
    ...(entry.description === undefined ? [] : [{ path: 'description', text: entry.description }]),
    ...stringsIn(entry.stats, 'stats'),
  ];
  return fields.flatMap(({ path, text }) =>
    matches(text).map((match) => `${path}: "${match}" is on the blocklist (${BLOCKLIST_FILE}); use an SRD or original name`),
  );
}
