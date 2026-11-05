import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../site/src/lib/markdown.ts';

describe('renderMarkdown (docs/content-model.md#text-fields)', () => {
  it('renders the subset: paragraphs, bold, italic, and lists', () => {
    const html = renderMarkdown('One **two** *three*.\n\n- a\n- b\n\n1. c');
    expect(html).toContain('<p>One <strong>two</strong> <em>three</em>.</p>');
    expect(html).toContain('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    expect(html).toContain('<ol>');
  });

  it('sanitizes anything outside the subset to plain text', () => {
    const html = renderMarkdown('# Title\n\n<script>alert(1)</script> [link](https://x.test) https://y.test ![art](a.png)');
    expect(html).not.toMatch(/<(h1|script|a|img)\b/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('link');
    expect(html).toContain('Title');
  });
});
