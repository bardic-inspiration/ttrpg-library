// Text-field checks for every type (SPEC.md §5.5, §11, §6.8 "All types"):
// the markdown subset, its pipe tables, and the blocklist.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Lexer, type Token, type Tokens } from 'marked';
import { tableTitleAt } from '../../lib/table-title.ts';
import type { TermMatcher } from '../../lib/text.ts';

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
};

/**
 * Child tokens of a block or inline token, whatever key `marked` keeps them
 * under. A table's cells come back as `table_cell` blocks, so each cell's
 * words stay separate and its inline tokens are checked like any other.
 */
function children(token: Token): Token[] {
  if (token.type === 'table') {
    const table = token as Tokens.Table;
    return [table.header, ...table.rows].flat().map((cell) => ({ type: 'table_cell', raw: cell.text, tokens: cell.tokens }) as Token);
  }
  const t = token as Token & { tokens?: Token[]; items?: Token[] };
  return [...(t.tokens ?? []), ...(t.items ?? [])];
}

/**
 * The cells of one table line: the leading and trailing pipe trimmed, then
 * split on every pipe that isn't escaped (`\|` stays inside a cell).
 */
function cellCount(line: string): number {
  const trimmed = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return trimmed.split(/(?<!\\)\|/).length;
}

/**
 * Shape problems in one pipe table (SPEC.md §5.5). `marked` pads a short row
 * and drops a long row's extra cells, so the row lengths are counted from the
 * raw lines rather than from the parsed rows.
 */
function tableProblems(table: Tokens.Table): string[] {
  const problems: string[] = [];
  const columns = table.header.length;
  const lines = table.raw.replace(/\n+$/, '').split('\n');
  const rows = lines.slice(2);
  if (table.header.some((cell) => cell.text.trim() === '')) problems.push('a table header cell is empty');
  if (rows.length === 0) problems.push('a table has no rows under its header');
  rows.forEach((line, i) => {
    const count = cellCount(line);
    if (count !== columns) problems.push(`table row ${i + 1} has ${count} ${count === 1 ? 'cell' : 'cells'}; its header has ${columns}`);
  });
  return problems;
}

/**
 * A paragraph line that starts with a pipe: a table `marked` couldn't parse,
 * usually because the delimiter row (`|---|---|`) is missing or has a
 * different number of columns than the header.
 */
const BROKEN_TABLE_LINE = /^\s*\|/m;

/**
 * `text` with its markdown removed: the words a reader sees, separated by
 * single spaces. Used for the index's `search` text (SPEC.md §9.1).
 */
export function plainText(text: string): string {
  const flatten = (tokens: Token[]): string =>
    tokens
      .map((token) => {
        const kids = children(token);
        const inner = kids.length > 0 ? flatten(kids) : 'text' in token && typeof token.text === 'string' ? token.text : '';
        // Block tokens and line breaks separate words; inline tokens abut.
        return INLINE.has(token.type) ? inner : ` ${inner} `;
      })
      .join('');
  return flatten(new Lexer().lex(text)).replace(/\s+/g, ' ').trim();
}

const INLINE = new Set(['text', 'strong', 'em', 'codespan', 'escape', 'del']);

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

/** A table title holds only plain words: no markup, links, or tokens, since it's also the table's label. */
const plainTitle = (title: Tokens.Strong): boolean =>
  title.tokens.every((t) => t.type === 'text' && !/[{}]/.test(t.raw));

/** Malformed pipe tables and table titles in `text`, one message per problem, in order. */
export function tableViolations(text: string): string[] {
  const found: string[] = [];
  const visit = (tokens: Token[]) => {
    for (const [i, token] of tokens.entries()) {
      const title = tableTitleAt(tokens, i);
      if (title) {
        if (!plainTitle(title)) found.push('a table title (a **bold** line directly above a table) holds only plain text');
      } else if (token.type === 'table') found.push(...tableProblems(token as Tokens.Table));
      else if (token.type === 'paragraph' && BROKEN_TABLE_LINE.test(token.raw)) {
        found.push('a line starts with "|" but isn\'t part of a table; a table needs a header row, then a delimiter row such as |---|---| with one cell per column');
      } else visit(children(token));
    }
  };
  visit(new Lexer().lex(text));
  return found;
}

/** One message per disallowed construct or malformed table in the text at `path`. */
export function checkMarkdown(path: string, text: string): string[] {
  return [
    ...markdownViolations(text).map(
      (name) =>
        `${path}: ${name} is not allowed; text fields use only paragraphs, **bold**, *italic*, lists, line breaks, and pipe tables`,
    ),
    ...tableViolations(text).map((problem) => `${path}: ${problem}`),
  ];
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
 * `stats` (which holds `descriptors`). `matches` is a `termMatcher` over the
 * blocklist. One message per match.
 */
export function checkBlocklist(
  entry: { name: string; summary: string; description?: string; stats: unknown },
  matches: TermMatcher,
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
