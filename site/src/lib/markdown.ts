// Renders the §5.5 markdown subset to HTML (SPEC.md §5.5, §9.4). The
// validator already rejects everything outside the subset with the same
// `marked` lexer; rendering is sanitized anyway, so a construct that slipped
// through reads as its plain text, never as markup: raw HTML is escaped,
// links and images keep only their text, and headings read as paragraphs.
// Pipe tables render as one site-wide table (SPEC.md §9.5), inside a box that
// scrolls on its own when the table is wider than the text column.

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
    table({ header, rows }: Tokens.Table) {
      const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => {
        // A one-word cell, such as a die range "9–10", never breaks at its dash.
        const classes = [c.align && `md-table__cell--${c.align}`, !/\s/.test(c.text.trim()) && 'md-table__cell--nowrap'].filter(Boolean);
        const attrs = (tag === 'th' ? ' scope="col"' : '') + (classes.length ? ` class="${classes.join(' ')}"` : '');
        return `<${tag}${attrs}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      };
      const label = header.map((c) => this.parser.parseInline(c.tokens, this.parser.textRenderer)).join(', ');
      const head = `<thead><tr>${header.map((c) => cell(c, 'th')).join('')}</tr></thead>`;
      const body = `<tbody>${rows.map((row) => `<tr>${row.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>`;
      // Focusable and labeled, so a keyboard can scroll it when it overflows.
      return `<div class="md-table" role="region" tabindex="0" aria-label="Table: ${escapeHtml(label)}"><table>${head}${body}</table></div>\n`;
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
