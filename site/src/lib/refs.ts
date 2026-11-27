// Groups an entry's forward refs and back-refs under the labels its ruleset
// gives them, for the detail page (docs/content-model.md#references, docs/site.md#detail-page).

import { refObjectKey, zoneKey, type Link } from '../../../scripts/validate/refs.ts';
import type { RefLabels } from '../../../rulesets/module.ts';

/**
 * How a stored `RefOrText` value reads (docs/content-model.md#references): a plain string as
 * written, a ref as its target's name, or "Map › Zone" for a map zone ref, with its `note` in
 * parentheses after.
 */
export function refOrTextName(value: string | { ref: string; note?: string; zone?: string }, names: Map<string, string>): string {
  if (typeof value === 'string') return value;
  const name = names.get(refObjectKey(value)) ?? refObjectKey(value);
  return value.note === undefined ? name : `${name} (${value.note})`;
}

export interface RefTarget {
  type: string;
  name: string;
  /** Path under the site base, such as `dnd-5e-2024/spell/frost-lance/`. */
  path: string;
  /** Whether it's official: official content (docs/content-model.md#source-and-author), or a primitive or group of the rules. */
  official: boolean;
}

export interface RefGroup {
  label: string;
  targets: RefTarget[];
}

type LabelFor = (type: string, path: string) => RefLabels;

/**
 * Groups links by label, in first-seen order, listing each target once per
 * label, and a target under a specific label not again under the generic one
 * ("Referenced by"). `self` is the entry's type; a back-link is labeled from the
 * referring entry's side, since the ref's path is in that entry.
 */
export function groupRefs(
  self: string,
  refs: Link[],
  refBy: Link[],
  targets: Map<string, RefTarget>,
  labelFor: LabelFor,
): { forward: RefGroup[]; back: RefGroup[] } {
  return groupLinks(
    refs.map((link) => ({ ...link, from: self })),
    refBy,
    targets,
    labelFor,
  );
}

/** One linked part of a page: its type and its links. */
interface PagePart {
  entry: { type: string; id: string };
  refs: Link[];
  refBy: Link[];
}

/**
 * A page type's links (docs/content-model.md#components): its own and its components', labeled from
 * the field each sits in. The links among the page's own parts (the parent's list of its
 * components, a component naming its parent or a sibling) aren't shown, since the page
 * shows those parts itself.
 */
export function groupPageRefs(
  page: PagePart,
  components: PagePart[],
  targets: Map<string, RefTarget>,
  labelFor: LabelFor,
): { forward: RefGroup[]; back: RefGroup[] } {
  const parts = [page, ...components];
  const own = new Set(parts.map(({ entry }) => `${entry.type}/${entry.id}`));
  const forward = parts.flatMap(({ entry, refs }) => refs.filter((l) => !own.has(l.key)).map((link) => ({ ...link, from: entry.type })));
  const back = parts.flatMap(({ refBy }) => refBy.filter((l) => !own.has(l.key)));
  return groupLinks(forward, back, targets, labelFor);
}

/** Groups forward links (each labeled from the type it sits in) and back-links (labeled from the referrer). */
function groupLinks(
  refs: (Link & { from: string })[],
  refBy: Link[],
  targets: Map<string, RefTarget>,
  labelFor: LabelFor,
): { forward: RefGroup[]; back: RefGroup[] } {
  const group = <L extends Link>(links: L[], labels: (link: L) => RefLabels, side: 'forward' | 'back'): RefGroup[] => {
    const groups = new Map<string, RefGroup & { generic: boolean }>();
    for (const link of links) {
      // A forward link to a map's zone reads "Map › Zone"; a back-link names its referrer.
      const target = (side === 'forward' && link.zone !== undefined && targets.get(zoneKey(link.key, link.zone))) || targets.get(link.key);
      if (!target) continue;
      const of = labels(link);
      const name = of[side];
      let found = groups.get(name);
      if (!found) groups.set(name, (found = { label: name, targets: [], generic: of.generic === true }));
      if (!found.targets.includes(target)) found.targets.push(target);
    }
    const specific = new Set([...groups.values()].filter((g) => !g.generic).flatMap((g) => g.targets));
    return [...groups.values()]
      .map(({ label, targets: listed, generic }) => ({ label, targets: generic ? listed.filter((t) => !specific.has(t)) : listed }))
      .filter((g) => g.targets.length > 0);
  };
  return {
    forward: group(refs, (link) => labelFor(link.from, link.path), 'forward'),
    back: group(refBy, (link) => labelFor(link.key.slice(0, link.key.indexOf('/')), link.path), 'back'),
  };
}

/** One zone of a map and the back-links into it, grouped by label. */
export interface ZoneRefs {
  zone: string;
  groups: RefGroup[];
}

/**
 * A map's back-links grouped by zone (docs/content-model.md#references), in the map's zone order:
 * what each zone holds, under the labels its ruleset gives them. A zone nothing points into has no
 * groups. Back-links to the map as a whole aren't any zone's.
 */
export function zoneRefs(zones: readonly string[], refBy: Link[], targets: Map<string, RefTarget>, labelFor: LabelFor): ZoneRefs[] {
  return zones.map((zone) => ({ zone, groups: groupLinks([], refBy.filter((link) => link.zone === zone), targets, labelFor).back }));
}

/**
 * An official page's link groups split at the official line (docs/site.md#detail-page): each group's
 * official targets stay, and its homebrew targets move to a group of the same label for the page's Homebrew
 * section. A group left empty is dropped. A homebrew page's links aren't split.
 */
export function splitHomebrew(groups: RefGroup[]): { official: RefGroup[]; homebrew: RefGroup[] } {
  const part = (official: boolean) =>
    groups.map((g) => ({ label: g.label, targets: g.targets.filter((t) => t.official === official) })).filter((g) => g.targets.length > 0);
  return { official: part(true), homebrew: part(false) };
}
