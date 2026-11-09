// Renders the docs/content-model.md#text-fields markdown subset to HTML (docs/content-model.md#text-fields, docs/site.md#detail-page). The
// validator already rejects everything outside the subset with the same
// `marked` lexer; rendering is sanitized anyway, so a construct that slipped
// through reads as its plain text, never as markup: raw HTML is escaped,
// links and images keep only their text, and headings read as paragraphs.
// Pipe tables render as one site-wide table (docs/site.md#templates), inside a box that
// scrolls on its own when the table is wider than the text column; a bold
// line directly above a table is its title, rendered as the caption. A
// `{ref:<type>/<id>}` token renders as the target's current name, linked to
// its detail page, or a primitive's or group's anchor on its rules page
// (docs/content-model.md#references): the only link text can carry.

import { Marked, type Token, type TokenizerAndRendererExtension, type Tokens } from 'marked';
import { tableTitleAt } from '../../../lib/table-title.ts';
import { url } from './url.ts';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** What `{ref:…}` links resolve against: names by `<type>/<id>`, and the entry's ruleset (refs never cross one). */
export interface TextRefs {
  names: Map<string, string>;
  ruleset: string;
  /** Paths under the site base for targets that aren't entries: a primitive's or group's anchor on its rules page, a component's on its parent's page. */
  paths?: Map<string, string>;
}

/** The links for the text being rendered now; parsing is synchronous, so one at a time. */
let current: TextRefs | undefined;

interface RefToken {
  type: 'ref';
  raw: string;
  key: string;
  id: string;
}

/** A ref's name, or its id when the name isn't known (validation makes that rare). */
const refName = (token: RefToken): string => current?.names.get(token.key) ?? token.id;

const refExtension: TokenizerAndRendererExtension = {
  name: 'ref',
  level: 'inline',
  start: (src: string) => {
    const i = src.indexOf('{ref:');
    return i === -1 ? undefined : i;
  },
  tokenizer(src: string) {
    const match = /^\{ref:([a-z][a-z0-9-]*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\}/.exec(src);
    if (!match) return undefined;
    return { type: 'ref', raw: match[0], key: `${match[1]}/${match[2]}`, id: match[2] ?? '' } satisfies RefToken;
  },
  renderer(token) {
    const ref = token as unknown as RefToken;
    const name = escapeHtml(refName(ref));
    if (!current?.names.has(ref.key)) return name;
    const path = current.paths?.get(ref.key) ?? `${current.ruleset}/${ref.key}/`;
    return `<a class="ref-link" href="${escapeHtml(url(path))}">${name}</a>`;
  },
};

/** The words a reader sees in inline tokens, with each ref as its target's name. */
const plain = (tokens: Token[]): string =>
  tokens
    .map((t) => {
      if (t.type === 'ref') return refName(t as unknown as RefToken);
      const kids = (t as { tokens?: Token[] }).tokens;
      if (kids) return plain(kids);
      return 'text' in t && typeof t.text === 'string' ? t.text : '';
    })
    .join('');

const marked = new Marked({
  gfm: true,
  extensions: [refExtension],
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ tokens }: Tokens.Link) {
      return this.parser.parseInline(tokens);
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text);
    },
    heading({ tokens }: Tokens.Heading) {
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
    table({ header, rows, title }: Tokens.Table & { title?: Tokens.Strong }) {
      const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => {
        // A one-word cell, such as a die range "9–10", never breaks at its dash.
        const classes = [c.align && `md-table__cell--${c.align}`, !/\s/.test(c.text.trim()) && 'md-table__cell--nowrap'].filter(Boolean);
        const attrs = (tag === 'th' ? ' scope="col"' : '') + (classes.length ? ` class="${classes.join(' ')}"` : '');
        return `<${tag}${attrs}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      };
      // A titled table is labeled by its title; an untitled one by its column headers.
      const label = title ? plain(title.tokens) : header.map((c) => plain(c.tokens)).join(', ');
      const caption = title ? `<caption>${this.parser.parseInline(title.tokens)}</caption>` : '';
      const head = `<thead><tr>${header.map((c) => cell(c, 'th')).join('')}</tr></thead>`;
      const body = `<tbody>${rows.map((row) => `<tr>${row.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>`;
      // Focusable and labeled, so a keyboard can scroll it when it overflows.
      return `<div class="md-table" role="region" tabindex="0" aria-label="Table: ${escapeHtml(label)}"><table>${caption}${head}${body}</table></div>\n`;
    },
  },
});

/**
 * Plain text made safe to splice into markdown, so a name like "Bite *Hot*"
 * reads as written: every character markdown could treat as syntax is
 * backslash-escaped.
 */
export const escapeMarkdown = (text: string): string => text.replace(/[\\`*_[\]<>#~|!&]/g, (c) => `\\${c}`);

/** Renders with `refs` as the current link context, restoring the previous one after. */
function withRefs(refs: TextRefs | undefined, render: () => string): string {
  const previous = current;
  current = refs;
  try {
    return render();
  } finally {
    current = previous;
  }
}

/** HTML for a markdown-subset text field that reads inline, inside a line: no paragraph wrapper. */
export const renderInlineMarkdown = (text: string, refs?: TextRefs): string =>
  withRefs(refs, () => marked.parseInline(text, { async: false }));

/** Moves each table title (docs/content-model.md#tables-in-text) from its paragraph onto the table it titles. */
function attachTableTitles(tokens: Token[]): Token[] {
  return tokens.flatMap((token, i) => {
    const title = tableTitleAt(tokens, i);
    if (title) {
      const table = tokens.slice(i + 1).find((t) => t.type === 'table') as Tokens.Table & { title?: Tokens.Strong };
      table.title = title;
      return [];
    }
    return [token];
  });
}

/** HTML for a markdown-subset text field. `refs` turns `{ref:…}` tokens into links. */
export const renderMarkdown = (text: string, refs?: TextRefs): string =>
  withRefs(refs, () => marked.parser(attachTableTitles(marked.lexer(text))));
