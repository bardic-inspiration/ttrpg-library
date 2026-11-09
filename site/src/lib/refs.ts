// Groups an entry's forward refs and back-refs under the labels its ruleset
// gives them, for the detail page (docs/content-model.md#references, docs/site.md#detail-page).

import type { Link } from '../../../scripts/validate/refs.ts';
import type { RefLabels } from '../../../rulesets/module.ts';

/**
 * How a stored `RefOrText` value reads (docs/content-model.md#references): a plain string as
 * written, a ref as its target's name, with its `note` in parentheses after.
 */
export function refOrTextName(value: string | { ref: string; note?: string }, names: Map<string, string>): string {
  if (typeof value === 'string') return value;
  const name = names.get(value.ref) ?? value.ref;
  return value.note === undefined ? name : `${name} (${value.note})`;
}

export interface RefTarget {
  type: string;
  name: string;
  /** Path under the site base, such as `dnd-5e-2024/spell/frost-lance/`. */
  path: string;
}

export interface RefGroup {
  label: string;
  targets: RefTarget[];
}

type LabelFor = (type: string, path: string) => RefLabels;

/**
 * Groups links by label, in first-seen order, listing each target once per
 * label. `self` is the entry's type; a back-link is labeled from the referring
 * entry's side, since the ref's path is in that entry.
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
  const group = <L extends Link>(links: L[], label: (link: L) => string): RefGroup[] => {
    const groups = new Map<string, RefGroup>();
    for (const link of links) {
      const target = targets.get(link.key);
      if (!target) continue;
      const name = label(link);
      let found = groups.get(name);
      if (!found) groups.set(name, (found = { label: name, targets: [] }));
      if (!found.targets.includes(target)) found.targets.push(target);
    }
    return [...groups.values()];
  };
  return {
    forward: group(refs, (link) => labelFor(link.from, link.path).forward),
    back: group(refBy, (link) => labelFor(link.key.slice(0, link.key.indexOf('/')), link.path).back),
  };
}
