// Starships & Galaxies, an original fixture ruleset (docs/rulesets.md#fixture-rulesets): a crew of
// creatures runs a ship's stations, and travel is a run of d100 checks, the crew member's skill plus the
// ship system's rating, times 5, against each hazard's difficulty.

import type { Issue, LinkTarget, RulesetModule } from '../../../../../rulesets/module.ts';
import type { PhraseBook } from '../../../../../lib/wording/book.ts';
import definition from './ruleset.json' with { type: 'json' };
import phrasesJson from './phrases.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { CelestialBodyStats, CreatureStats, ItemStats, ShipStats, Station, Tables } from './types.ts';

export const tables = tablesJson as Tables;

/** The stations a creature is best at: every one at its highest skill. */
export const bestStations = (stats: CreatureStats): Station[] => {
  const top = Math.max(...Object.values(stats.skills));
  return (Object.keys(stats.skills) as Station[]).filter((station) => stats.skills[station] === top);
};

/** A ship's crew and hull from its size, and the system points its ratings use. */
export const deriveShip = (stats: ShipStats) => ({
  crew: tables.shipSize[stats.size].crew,
  hull: tables.shipSize[stats.size].hull,
  systemPoints: Object.values(stats.systems).reduce((sum, rating) => sum + rating, 0),
});

/** What a trade good or upgrade sells back for: half its value, rounded down to the credit step. */
export const resale = (stats: ItemStats): number => Math.floor((stats.value * tables.resaleRate) / tables.creditStep) * tables.creditStep;

/** Whether a ship can dock, and the worst hazard on the way in. */
export function deriveBody(stats: CelestialBodyStats): { dockable: boolean; danger?: string } {
  const order = tables.difficultyOrder;
  const worst = (stats.hazards ?? []).map((h) => order.indexOf(h.difficulty)).reduce((a, b) => Math.max(a, b), -1);
  return { dockable: (stats.services ?? []).length > 0, ...(worst >= 0 ? { danger: order[worst] } : {}) };
}

function checkShip(stats: ShipStats): Issue[] {
  const { systemPoints } = deriveShip(stats);
  const cap = tables.shipSize[stats.size].systemPoints;
  return systemPoints > cap
    ? [{ level: 'error', path: 'stats.systems', message: `the system ratings add up to ${systemPoints}, over a ${stats.size}'s ${cap}` }]
    : [];
}

function checkBody(stats: CelestialBodyStats): Issue[] {
  const issues: Issue[] = [];
  if (stats.kind === 'star' && stats.services) issues.push({ level: 'error', path: 'stats.services', message: 'a star has no port; a ship can’t dock at one' });
  if (stats.kind === 'star' && stats.orbits) issues.push({ level: 'error', path: 'stats.orbits', message: 'a star orbits nothing' });
  if (stats.kind !== 'star' && !stats.orbits) issues.push({ level: 'error', path: 'stats.orbits', message: `a ${stats.kind} must name what it orbits` });
  return issues;
}

/** What each kind of body orbits: a moon a planet, anything else but a star a star. A star's orbit fails `checkBody`. */
function checkOrbit(stats: CelestialBodyStats, target: LinkTarget): Issue[] {
  if (!stats.orbits || stats.kind === 'star') return [];
  const orbited = target(stats.orbits.ref);
  if (!orbited) return [];
  const wanted = stats.kind === 'moon' ? 'planet' : 'star';
  const kind = (orbited.stats as CelestialBodyStats).kind;
  return kind === wanted ? [] : [{ level: 'error', path: 'stats.orbits', message: `a ${stats.kind} orbits a ${wanted}, not a ${kind}` }];
}

export const ruleset: RulesetModule = {
  definition,
  phrases: phrasesJson as unknown as PhraseBook,
  derive(type, stats) {
    if (type === 'creature') return { bestStations: bestStations(stats as CreatureStats) };
    if (type === 'ship') return deriveShip(stats as ShipStats);
    if (type === 'item') return { resale: resale(stats as ItemStats) };
    if (type === 'celestial-body') return deriveBody(stats as CelestialBodyStats);
    return {};
  },
  check(type, stats) {
    if (type === 'ship') return checkShip(stats as ShipStats);
    if (type === 'celestial-body') return checkBody(stats as CelestialBodyStats);
    return [];
  },
  checkLinks(type, stats, target) {
    return type === 'celestial-body' ? checkOrbit(stats as CelestialBodyStats, target) : [];
  },
  refLabels(type, path) {
    if (type === 'celestial-body' && path === 'stats.orbits') return { forward: 'Orbits', back: 'Orbited by' };
    if (type === 'celestial-body' && /^stats\.hazards\[\d+\]\.ship$/.test(path)) return { forward: 'Hostile ship', back: 'Threatens' };
    if (type === 'celestial-body' && /^stats\.hazards\[\d+\]\.station$/.test(path)) return { forward: 'Tests', back: 'Tested at' };
    return { forward: 'References', back: 'Referenced by' };
  },
};
