// Groups an entry's forward refs and back-refs under the labels its ruleset
// gives them, for the detail page (SPEC.md §5.7, §9.4).

import type { Link } from '../../../scripts/validate/refs.ts';
import type { RefLabels } from '../../../rulesets/module.ts';

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
  const group = (links: Link[], label: (link: Link) => string): RefGroup[] => {
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
    forward: group(refs, (link) => labelFor(self, link.path).forward),
    back: group(refBy, (link) => labelFor(link.key.slice(0, link.key.indexOf('/')), link.path).back),
  };
}
