// A map's diagram (docs/content-model.md#map-diagrams): an SVG at a path derived from the map's id,
// read as data and checked, never trusted. The site styles it, so it carries classes and no colors.
// A small reader of the XML subset a diagram may use: anything it can't read is an error, so
// nothing it skips can reach the page.

/** The diagram's path from the repo root: `assets/images/<ruleset>/map/<id>.svg`, never stored. */
export const diagramPath = (entry: { ruleset: string; type: string; id: string }): string =>
  `assets/images/${entry.ruleset}/${entry.type}/${entry.id}.svg`;

/** The elements a diagram may hold: shapes, paths, text, groups, and `<title>`. */
export const DIAGRAM_ELEMENTS = new Set(['svg', 'g', 'title', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan']);

/** The classes the site's CSS colors from the palette (docs/styling.md#palette). */
export const DIAGRAM_CLASSES = new Set(['zone', 'wall', 'door', 'feature', 'label']);

/** Elements that are named in errors as rejected, rather than only as outside the allowed set. */
const REJECTED_ELEMENTS = new Set(['script', 'foreignObject', 'image']);

/** Attributes that set a color or a style inline; the site's CSS sets both. */
const COLOR_ATTRIBUTES = new Set(['style', 'fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color']);

/** An XML name, as an element or attribute is named; the site's rewriter reads tags by it too. */
export const XML_NAME = '[A-Za-z_][\\w.:-]*';
const ATTRIBUTE = new RegExp(`\\s+(${XML_NAME})\\s*=\\s*(?:"([^"<]*)"|'([^'<]*)')`, 'y');
const ENTITY = /&(?:#\d+|#x[0-9a-fA-F]+|lt|gt|amp|quot|apos);/g;

interface Element {
  name: string;
  attributes: Map<string, string>;
}

/** The elements of an SVG in document order, or the reason it can't be read. */
export function readSvg(source: string): { elements: Element[] } | { error: string } {
  const elements: Element[] = [];
  const open: string[] = [];
  let at = 0;
  let rootSeen = false;
  const fail = (what: string) => ({ error: `${what} (at character ${at})` });
  const text = source.replace(/^﻿/, '');
  const decl = /^<\?xml\s[^?]*\?>/.exec(text);
  if (decl) at = decl[0].length;
  while (at < text.length) {
    const next = text.indexOf('<', at);
    const between = text.slice(at, next === -1 ? text.length : next);
    if (between.replace(ENTITY, '').includes('&')) return fail('an unknown entity in text');
    if (open.length === 0 && between.trim() !== '') return fail('text outside the <svg> element');
    if (next === -1) break;
    at = next;
    if (text.startsWith('<!--', at)) {
      const end = text.indexOf('-->', at + 4);
      if (end === -1) return fail('an unclosed comment');
      at = end + 3;
      continue;
    }
    if (text.startsWith('<!', at) || text.startsWith('<?', at)) return fail('a doctype, CDATA section, or processing instruction, which a diagram never needs');
    if (text.startsWith('</', at)) {
      const close = new RegExp(`</(${XML_NAME})\\s*>`, 'y');
      close.lastIndex = at;
      const m = close.exec(text);
      if (!m) return fail('a malformed closing tag');
      if (open.pop() !== m[1]) return fail(`</${m[1]}> closes nothing open`);
      at = close.lastIndex;
      continue;
    }
    const tag = new RegExp(`<(${XML_NAME})`, 'y');
    tag.lastIndex = at;
    const m = tag.exec(text);
    if (!m) return fail('a malformed tag');
    if (open.length === 0 && rootSeen) return fail('a second root element');
    at = tag.lastIndex;
    const attributes = new Map<string, string>();
    for (;;) {
      ATTRIBUTE.lastIndex = at;
      const a = ATTRIBUTE.exec(text);
      if (!a) break;
      const value = a[2] ?? a[3] ?? '';
      if (attributes.has(a[1]!)) return fail(`attribute ${a[1]} twice on <${m[1]}>`);
      if (value.replace(ENTITY, '').includes('&')) return fail(`an unknown entity in ${a[1]}`);
      attributes.set(a[1]!, value);
      at = ATTRIBUTE.lastIndex;
    }
    const end = /\s*(\/?)>/y;
    end.lastIndex = at;
    const e = end.exec(text);
    if (!e) return fail(`a malformed <${m[1]}> tag`);
    at = end.lastIndex;
    elements.push({ name: m[1]!, attributes });
    rootSeen = true;
    if (e[1] !== '/') open.push(m[1]!);
  }
  if (open.length > 0) return { error: `<${open.at(-1)}> is never closed` };
  if (elements.length === 0) return { error: 'no <svg> element' };
  return { elements };
}

/** Whether an `href` or `url(…)` target stays inside the file: a fragment, `#id`. */
const local = (target: string) => target.trim().replace(/^['"]|['"]$/g, '').startsWith('#');

/**
 * The diagram's problems, each an error (docs/content-model.md#map-diagrams): an `<svg>` root with a
 * `viewBox`; only the allowed elements and classes; no script, event handler, external `href` or
 * `url(…)`, or inline style or color; and one `zone-<id>` element per zone, with no other.
 */
export function checkDiagram(source: string, zones: readonly string[]): string[] {
  const read = readSvg(source);
  if ('error' in read) return [`isn't an SVG the validator can read: ${read.error}`];
  const problems: string[] = [];
  const [root] = read.elements;
  if (root!.name !== 'svg') problems.push(`the root element is <${root!.name}>, not <svg>`);
  else if (!root!.attributes.get('viewBox')?.trim()) problems.push('the <svg> element has no viewBox, which lets the diagram scale to any width');
  const zoneElements = new Map<string, number>();
  const ids = new Set<string>();
  for (const { name, attributes } of read.elements) {
    if (REJECTED_ELEMENTS.has(name)) problems.push(`<${name}> isn't allowed in a diagram`);
    else if (!DIAGRAM_ELEMENTS.has(name)) problems.push(`<${name}> isn't allowed; a diagram holds only ${[...DIAGRAM_ELEMENTS].map((n) => `<${n}>`).join(', ')}`);
    for (const [attribute, value] of attributes) {
      const bare = attribute.replace(/^xlink:/, '');
      if (/^on/i.test(attribute)) problems.push(`<${name}> has an event handler, ${attribute}`);
      else if (COLOR_ATTRIBUTES.has(attribute)) problems.push(`<${name}> sets ${attribute} inline; the site colors a diagram by its classes`);
      else if (bare === 'href' && !local(value)) problems.push(`<${name}> ${attribute} links outside the file: "${value}"`);
      for (const [, target] of value.matchAll(/url\(([^)]*)\)/gi)) {
        if (!local(target!)) problems.push(`<${name}> ${attribute} uses url(${target}), outside the file`);
      }
    }
    for (const cls of (attributes.get('class') ?? '').split(/\s+/).filter(Boolean)) {
      if (!DIAGRAM_CLASSES.has(cls)) problems.push(`<${name}> has class "${cls}"; a diagram's classes are ${[...DIAGRAM_CLASSES].join(', ')}`);
    }
    const id = attributes.get('id');
    if (id === undefined) continue;
    if (ids.has(id)) problems.push(`id "${id}" is on more than one element`);
    ids.add(id);
    if (id.startsWith('zone-')) zoneElements.set(id.slice('zone-'.length), (zoneElements.get(id.slice('zone-'.length)) ?? 0) + 1);
  }
  for (const zone of zones) if (!zoneElements.has(zone)) problems.push(`zone "${zone}" has no element with id="zone-${zone}"`);
  for (const id of zoneElements.keys()) if (!zones.includes(id)) problems.push(`id="zone-${id}" names no zone in stats.zones`);
  return problems;
}
