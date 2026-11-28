// Map checks a JSON schema can't express (docs/rulesets.md#maps, docs/rulesets.md#consistency-checks).
// The diagram's checks are ruleset-independent and the validator's (docs/content-model.md#map-diagrams).

import type { Issue, LinkTarget } from '../module.ts';
import type { MapStats } from './types.ts';

/** Zone ids are unique within the map. */
export function checkMap(stats: MapStats): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  stats.zones.forEach((zone, i) => {
    if (seen.has(zone.id)) issues.push({ level: 'error', path: `stats.zones[${i}].id`, message: `zone "${zone.id}" is already a zone of this map; zone ids are unique within a map` });
    seen.add(zone.id);
  });
  return issues;
}

/**
 * No map is within itself, directly or through others. `within` and its zone resolve by the ref
 * check (docs/content-model.md#references), so an unresolved parent adds nothing here.
 */
export function checkMapLinks(key: string, stats: MapStats, target: LinkTarget): Issue[] {
  if (!stats.within) return [];
  const { ref } = stats.within;
  const parent = target(ref);
  if (!parent || parent.type !== 'map') return [];
  const issues: Issue[] = [];
  // Walk up the parents; reaching this map again is a cycle. A map already seen ends the walk,
  // for a cycle above this map that doesn't pass through it is reported by its own maps.
  const chain = [key];
  const seen = new Set([key]);
  for (let at: string | undefined = ref; at !== undefined; ) {
    chain.push(at);
    if (at === key) {
      issues.push({ level: 'error', path: 'stats.within', message: `a map can't be within itself: ${chain.join(' › ')}` });
      break;
    }
    if (seen.has(at)) break;
    seen.add(at);
    const next = target(at);
    at = next?.type === 'map' ? (next.stats as MapStats).within?.ref : undefined;
  }
  return issues;
}
