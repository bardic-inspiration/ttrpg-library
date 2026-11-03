// Renders the §5.5 markdown subset to HTML (SPEC.md §5.5, §9.4). The
// validator already rejects everything outside the subset with the same
// `marked` lexer; rendering is sanitized anyway, so a construct that slipped
// through reads as its plain text, never as markup: raw HTML is escaped,
// links and images keep only their text, and headings and tables read as
// paragraphs.

import { Marked, type Tokens } from 'marked';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const marked = new Marked({
  gfm: true,
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
    table({ raw }: Tokens.Table) {
      return `<p>${escapeHtml(raw)}</p>\n`;
    },
  },
});

/**
 * Plain text made safe to splice into markdown, so a name like "Bite *Hot*"
 * reads as written: every character markdown could treat as syntax is
 * backslash-escaped.
 */
export const escapeMarkdown = (text: string): string => text.replace(/[\\`*_[\]<>#~|!&]/g, (c) => `\\${c}`);

/** HTML for a markdown-subset text field that reads inline, inside a line: no paragraph wrapper. */
export const renderInlineMarkdown = (text: string): string => marked.parseInline(text, { async: false });

/** HTML for a markdown-subset text field. */
export const renderMarkdown = (text: string): string => marked.parse(text, { async: false });
