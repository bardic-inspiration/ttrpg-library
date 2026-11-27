// A map's page (docs/site.md#templates "map-page"): its diagram's source, and its zones in order,
// each with its note and the back-links into it, grouped by label (docs/content-model.md#references).

import type { RefLabels } from '../../../rulesets/module.ts';
import type { Link } from '../../../scripts/validate/refs.ts';
import { diagramPath } from '../../../scripts/validate/diagram.ts';
import { zoneRefs, type RefGroup, type RefTarget } from './refs.ts';

// The library's diagrams, read as text at build time (docs/site.md#library-root). A glob key's form
// depends on where the library sits, so a diagram is matched by the path that ends the key.
const diagrams = import.meta.glob<string>('@library/assets/images/*/map/*.svg', { eager: true, query: '?raw', import: 'default' });

/** A map's diagram source, at the path its id derives (docs/content-model.md#map-diagrams). */
export function diagramSource(entry: { ruleset: string; type: string; id: string }): string {
  const path = diagramPath(entry);
  const found = Object.entries(diagrams).find(([key]) => key.endsWith(`/${path}`));
  if (!found) throw new Error(`${entry.type}/${entry.id} has no diagram at ${path}`);
  return found[1];
}

/** One zone as its map's page lists it. */
export interface MapZoneView {
  id: string;
  name: string;
  note?: string;
  /** What points into the zone, by label: what's set there, and the child maps that detail it. */
  groups: RefGroup[];
}

/**
 * A map's zones in order, each with the back-links into it (`zoneRefs`). A referrer is in the
 * map's ruleset; it reads by its name and links to its page, or to its anchor in `paths`.
 */
export function mapZones(
  entry: { ruleset: string; stats: unknown },
  refBy: Link[],
  names: Map<string, string>,
  paths: Map<string, string> | undefined,
  labelFor: (type: string, path: string) => RefLabels,
): MapZoneView[] {
  const zones = (entry.stats as { zones: { id: string; name: string; note?: string }[] }).zones;
  const targets = new Map<string, RefTarget>(
    refBy.map(({ key }) => [
      key,
      { type: key.slice(0, key.indexOf('/')), name: names.get(key) ?? key, path: paths?.get(key) ?? `${entry.ruleset}/${key}/`, official: false },
    ]),
  );
  const refs = zoneRefs(
    zones.map((zone) => zone.id),
    refBy,
    targets,
    labelFor,
  );
  return zones.map((zone, i) => ({ ...zone, groups: refs[i]!.groups }));
}

/** The back-links into the entry as a whole: those into a map's zones are listed under their zones instead. */
export const outsideZones = (refBy: Link[]): Link[] => refBy.filter((link) => link.zone === undefined);
