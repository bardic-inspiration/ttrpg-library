// A module's page (docs/site.md#kit-parts, docs/rulesets.md#modules): its lines (length, levels, and
// the counts it derives), each part's label and anchor, and the structured summary that opens it.
// Composed text goes through the wording layer (docs/site.md#wording).

import type { DerivedModule, ModuleContent, ModuleStats, Part } from '../../../rulesets/dnd-5e-2024/types.ts';
import { sectionId, type TocItem } from './accordion.ts';
import { partHeading } from './kit.ts';
import type { PropertyLine } from './template.ts';
import { url } from './url.ts';
import { name, sayText } from './wording.ts';

/** The party levels a module is written for: "2–4", or "3" for one level. */
export const levelsText = ({ min, max }: ModuleStats['levels']): string =>
  min === max ? String(min) : sayText('kit.range', { min: String(min), max: String(max) });

/** A module's lines: its length and levels, then the encounters and maps it contains, through its contained arrangements. */
export function moduleLines(stats: ModuleStats, derived: Partial<DerivedModule>): PropertyLine[] {
  return [
    { label: 'Length', value: name('moduleLength', stats.length) },
    { label: 'Levels', value: levelsText(stats.levels) },
    ...(derived.encounters === undefined ? [] : [{ label: 'Encounters', value: String(derived.encounters) }]),
    ...(derived.maps === undefined ? [] : [{ label: 'Maps', value: String(derived.maps) }]),
  ];
}

/**
 * Each part's label in the summary: its heading, a table's title, or a contained arrangement's name.
 * A prose part without a title has none, and isn't listed.
 */
export const partLabel = (part: Part, names: Map<string, string>): string | undefined =>
  part.part === 'table' ? part.title : part.part === 'arrangement' ? (names.get(part.arrangement.ref) ?? part.arrangement.ref) : partHeading(part, 'module');

/** Each labeled part's anchor, `section-<slug>` of its label, with `-2`, `-3`… after a label used before. */
export function partIds(labels: (string | undefined)[]): (string | undefined)[] {
  const used = new Map<string, number>();
  return labels.map((label) => {
    if (label === undefined) return undefined;
    const id = sectionId(label);
    const n = (used.get(id) ?? 0) + 1;
    used.set(id, n);
    return n === 1 ? id : `${id}-${n}`;
  });
}

/** A contained arrangement in the summary: its name linked to its page, with a contained module's own listed under it. */
function contentItem(content: ModuleContent, ruleset: string, names: Map<string, string>): TocItem {
  const children = (content.contains ?? []).map((inner) => contentItem(inner, ruleset, names));
  return { label: names.get(content.ref) ?? content.ref, href: url(`${ruleset}/${content.ref}/`), ...(children.length > 0 && { children }) };
}

/**
 * The structured summary (docs/site.md#accordion-pages): the module's labeled parts in order, each
 * linked to its section, and under a contained module the arrangements it contains, through its
 * own, each linked to its page.
 */
export function moduleSummary(
  parts: Part[],
  contents: ModuleContent[],
  ids: (string | undefined)[],
  labels: (string | undefined)[],
  ruleset: string,
  names: Map<string, string>,
): TocItem[] {
  let arrangement = 0;
  return parts.flatMap((part, index) => {
    const content = part.part === 'arrangement' ? contents[arrangement++] : undefined;
    const id = ids[index];
    const label = labels[index];
    if (id === undefined || label === undefined) return [];
    const children = (content?.contains ?? []).map((inner) => contentItem(inner, ruleset, names));
    return [{ id, label, ...(children.length > 0 && { children }) }];
  });
}
