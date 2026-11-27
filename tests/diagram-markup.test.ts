// A map's diagram as the site shows it (lib/diagram.ts, docs/site.md#templates "map-page",
// docs/site.md#gallery "Cards"): checked first, then each zone linked to its entry on the page, or
// every id, title, and link left out of a card's thumbnail.
import { describe, expect, it } from 'vitest';
import { pageDiagram, thumbnailDiagram } from '../lib/diagram.ts';

const svg = (body: string, root = '') => `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${root}><title>Weir</title><!-- a note -->${body}</svg>`;
const zones = [
  { id: 'a', name: 'Spill & "Gate"' },
  { id: 'b', name: 'Pool' },
];
const body = '<g id="zone-a" class="zone"><rect x="0" y="0" width="5" height="5"/><g><text class="label" x="2" y="2">A</text></g></g><rect id="zone-b" class="zone" x="5" y="5" width="5" height="5"/><circle id="mark" class="feature" cx="1" cy="1" r="1"/>';

describe('the page diagram', () => {
  it("wraps each zone's element in a link to its entry, closing it after the element's own close", () => {
    expect(pageDiagram(svg(body), zones, 'Weir & Pool')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" class="diagram map-diagram__svg" role="group" aria-label="Weir &amp; Pool"><title>Weir</title>' +
        '<a class="map-diagram__zone" href="#zone-a" aria-label="Spill &amp; &quot;Gate&quot;"><g data-zone="a" class="zone"><rect x="0" y="0" width="5" height="5" /><g><text class="label" x="2" y="2">A</text></g></g></a>' +
        '<a class="map-diagram__zone" href="#zone-b" aria-label="Pool"><rect data-zone="b" class="zone" x="5" y="5" width="5" height="5" /></a>' +
        '<circle id="mark" class="feature" cx="1" cy="1" r="1" /></svg>',
    );
  });

  it("replaces the root's own classes with the site's", () => {
    expect(pageDiagram(svg(body, ' class="zone"'), zones, 'Weir')).toMatch(/^<svg [^>]*viewBox="0 0 10 10" class="diagram map-diagram__svg" role/);
  });

  it('refuses a diagram that fails its checks', () => {
    expect(() => pageDiagram(svg(`${body}<script>alert(1)</script>`), zones, 'map/weir')).toThrow("map/weir's diagram fails its checks: <script> isn't allowed in a diagram");
  });
});

describe('the thumbnail', () => {
  it('keeps the shapes and their classes, hidden, with no ids, title, or links', () => {
    expect(thumbnailDiagram(svg(body), ['a', 'b'], 'map/weir')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" class="diagram card__diagram" aria-hidden="true" focusable="false">' +
        '<g class="zone"><rect x="0" y="0" width="5" height="5" /><g><text class="label" x="2" y="2">A</text></g></g>' +
        '<rect class="zone" x="5" y="5" width="5" height="5" /><circle class="feature" cx="1" cy="1" r="1" /></svg>',
    );
  });

  it('refuses a diagram that fails its checks', () => {
    expect(() => thumbnailDiagram(svg(body), ['a'], 'map/weir')).toThrow('id="zone-b" names no zone in stats.zones');
  });
});
