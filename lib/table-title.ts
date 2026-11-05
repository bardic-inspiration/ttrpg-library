// Table titles in markdown text (docs/content-model.md#tables-in-text): a paragraph that is only one
// **bold** run, directly above a pipe table, is that table's title. The site
// renders it as the table's caption; the validator checks it's plain text.
// One definition, so the reader and the validator see the same titles.

import type { Token, Tokens } from 'marked';

/** The bold run that titles the table after `tokens[i]`, if `tokens[i]` is a table title. */
export function tableTitleAt(tokens: Token[], i: number): Tokens.Strong | undefined {
  const token = tokens[i];
  if (token?.type !== 'paragraph') return undefined;
  const inline = (token as Tokens.Paragraph).tokens;
  if (inline.length !== 1 || inline[0]?.type !== 'strong') return undefined;
  let next = i + 1;
  while (tokens[next]?.type === 'space') next++;
  return tokens[next]?.type === 'table' ? (inline[0] as Tokens.Strong) : undefined;
}
