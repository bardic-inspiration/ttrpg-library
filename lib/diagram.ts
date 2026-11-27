// A map's diagram as the site shows it (docs/site.md#templates "map-page", docs/site.md#gallery
// "Cards"): the checked SVG (docs/content-model.md#map-diagrams) rewritten for the page, each zone a
// link to its entry in the zone list, or for a card's thumbnail, with no ids or links. A diagram
// that fails its checks is never rewritten, so nothing unchecked reaches a page.

import { checkDiagram, XML_NAME as NAME } from '../scripts/validate/diagram.ts';
const ATTRIBUTES = `(?:\\s+${NAME}\\s*=\\s*(?:"[^"]*"|'[^']*'))*`;
/** One tag of a checked diagram: a closing tag, or an opening one with its attributes and its `/`. */
const TAG = new RegExp(`<(/?)(${NAME})(${ATTRIBUTES})\\s*(/?)>`, 'g');
const ZONE_ID = /\s+id\s*=\s*(?:"zone-([^"]*)"|'zone-([^']*)')/;
const ID = new RegExp(`\\s+id\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'g');
/** The root's own classes, replaced by the site's. */
const CLASS = /\s+class\s*=\s*(?:"[^"]*"|'[^']*')/;

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The source with its comments and XML declaration removed, after it passes its checks. */
function checked(source: string, zones: readonly string[], what: string): string {
  const problems = checkDiagram(source, zones);
  if (problems.length > 0) throw new Error(`${what}'s diagram fails its checks: ${problems.join('; ')}`);
  return source.replace(/^﻿/, '').replace(/^<\?xml\s[^?]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

/** A zone as the diagram links it: its id and the name its link reads. */
export interface DiagramZone {
  id: string;
  name: string;
}

/**
 * The diagram for its map's page: the `<svg>` named by `label`, and each zone's element marked
 * `data-zone="<id>"` in place of its id and wrapped in a link to `#zone-<id>`, named by the zone's
 * name. The zone list's entries take the ids, so a link to a zone lands on what it holds.
 */
export function pageDiagram(source: string, zones: readonly DiagramZone[], label: string): string {
  const names = new Map(zones.map((zone) => [zone.id, zone.name]));
  const svg = checked(source, [...names.keys()], label);
  // Which open elements are a zone's, so its closing tag closes its link too.
  const open: boolean[] = [];
  let root = true;
  return svg.replace(TAG, (tag, closing: string, name: string, attributes: string, selfClosing: string) => {
    if (closing) return open.pop() ? `${tag}</a>` : tag;
    let rewritten = attributes;
    if (root) {
      root = false;
      rewritten = rewritten.replace(CLASS, '') + ` class="diagram map-diagram__svg" role="group" aria-label="${escapeAttribute(label)}"`;
    }
    const zone = ZONE_ID.exec(attributes);
    const id = zone ? (zone[1] ?? zone[2])! : undefined;
    if (id !== undefined) rewritten = rewritten.replace(ZONE_ID, ` data-zone="${escapeAttribute(id)}"`);
    const element = `<${name}${rewritten}${selfClosing ? ' /' : ''}>`;
    if (!selfClosing) open.push(id !== undefined);
    if (id === undefined) return element;
    const link = `<a class="map-diagram__zone" href="#zone-${escapeAttribute(id)}" aria-label="${escapeAttribute(names.get(id)!)}">`;
    return selfClosing ? `${link}${element}</a>` : `${link}${element}`;
  });
}

/** The diagram as a card's thumbnail: hidden from assistive technology, with no `<title>`, ids, or links. */
export function thumbnailDiagram(source: string, zones: readonly string[], label: string): string {
  const svg = checked(source, zones, label).replace(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/g, '');
  let root = true;
  return svg.replace(TAG, (tag, closing: string, name: string, attributes: string, selfClosing: string) => {
    if (closing) return tag;
    let rewritten = attributes.replace(ID, '');
    if (root) {
      root = false;
      rewritten = rewritten.replace(CLASS, '') + ' class="diagram card__diagram" aria-hidden="true" focusable="false"';
    }
    return `<${name}${rewritten}${selfClosing ? ' /' : ''}>`;
  });
}
