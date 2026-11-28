// Starships & Galaxies' own rules (docs/rulesets.md#fixture-rulesets): its derived values, checks, and
// ref labels. Run with `npm run test:originals`.
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { ruleset, tables } from '../fixtures/originals/rulesets/starships-and-galaxies/index.ts';
import { brokenOriginals, originalsJson, originalsSite, validateOriginals } from './fixture.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const BODY = (id: string) => `content/starships-and-galaxies/celestial-body/${id}.json`;
const SHIP = (id: string) => `content/starships-and-galaxies/ship/${id}.json`;

async function errorsWith(changes: Record<string, unknown | null>): Promise<string[]> {
  const root = await brokenOriginals(changes);
  temps.push(root);
  return (await validateOriginals(root)).errors.map((e) => `${e.file}: ${e.message}`);
}

const derived = async (id: string) => (await originalsSite()).all.find(({ entry }) => entry.id === id)!.derived;

describe('derived values', () => {
  it('give a ship its crew and hull from its size, and the system points it uses', async () => {
    expect(await derived('wren')).toEqual({ crew: 2, hull: 30, systemPoints: 20 });
    expect(await derived('bastion')).toEqual({ crew: 10, hull: 100, systemPoints: 41 });
  });

  it('name every station a crew member is best at', async () => {
    expect(await derived('veteran-pilot')).toEqual({ bestStations: ['helm'] });
    expect(await derived('dockside-broker')).toEqual({ bestStations: ['helm', 'comms'] });
  });

  it('sell an item back at half its value, rounded down to 10 credits', async () => {
    expect(await derived('ice-cores')).toEqual({ resale: 60 });
    expect(await derived('glowsilk')).toEqual({ resale: 150 });
  });

  it('mark a body dockable when it offers a service, with the worst hazard on the way in and the span of its damage', async () => {
    expect(await derived('grinder')).toEqual({ dockable: false, danger: 'extreme', damage: { min: 1, max: 4 } });
    expect(await derived('shard')).toEqual({ dockable: true });
    expect(await derived('harrow')).toEqual({ dockable: true, danger: 'routine' });
    expect(await derived('veil')).toMatchObject({ damage: { min: 3, max: 3 } });
  });

  it('read the d100 check table: skill plus system, times 5, plus difficulty', () => {
    expect(tables.checkMultiplier * (8 + 7) + tables.difficulty.severe).toBe(55);
  });
});

describe('checks', () => {
  it('fail a ship whose systems add up to more than its size allows', async () => {
    const wren = await originalsJson(SHIP('wren'));
    wren.stats.systems.engines = 10;
    expect(await errorsWith({ [SHIP('wren')]: wren })).toEqual([`${SHIP('wren')}: stats.systems: the system ratings add up to 23, over a scout's 20`]);
  });

  it('fail a star with a port or an orbit', async () => {
    const sun = await originalsJson(BODY('pale-sun'));
    sun.stats.services = ['trade'];
    sun.stats.orbits = { ref: 'celestial-body/harrow' };
    expect(await errorsWith({ [BODY('pale-sun')]: sun })).toEqual([
      `${BODY('pale-sun')}: stats.services: a star has no port; a ship can’t dock at one`,
      `${BODY('pale-sun')}: stats.orbits: a star orbits nothing`,
    ]);
  });

  it('fail a body that orbits nothing, or the wrong kind of body', async () => {
    const { orbits: _orbits, ...stats } = (await originalsJson(BODY('harrow'))).stats;
    const shard = await originalsJson(BODY('shard'));
    shard.stats.orbits = { ref: 'celestial-body/pale-sun' };
    expect(await errorsWith({ [BODY('harrow')]: { ...(await originalsJson(BODY('harrow'))), stats }, [BODY('shard')]: shard })).toEqual([
      `${BODY('harrow')}: stats.orbits: a planet must name what it orbits`,
      `${BODY('shard')}: stats.orbits: a moon orbits a planet, not a star`,
    ]);
  });

  it('fail a hostile hazard that names a station instead of a ship', async () => {
    const harrow = await originalsJson(BODY('harrow'));
    harrow.stats.hazards[0] = { ...harrow.stats.hazards[0], station: { ref: 'station/comms' } };
    const errors = await errorsWith({ [BODY('harrow')]: harrow });
    expect(errors).toEqual([`${BODY('harrow')}: stats.hazards[0]: must NOT be valid`]);
  });
});

describe('ref labels', () => {
  it('name orbits, hostile ships, and the stations a hazard tests, from each end', () => {
    expect(ruleset.refLabels('celestial-body', 'stats.orbits')).toEqual({ forward: 'Orbits', back: 'Orbited by' });
    expect(ruleset.refLabels('celestial-body', 'stats.hazards[1].ship')).toEqual({ forward: 'Hostile ship', back: 'Threatens' });
    expect(ruleset.refLabels('celestial-body', 'stats.hazards[0].station')).toEqual({ forward: 'Tests', back: 'Tested at' });
    expect(ruleset.refLabels('celestial-body', 'stats.text')).toEqual({ forward: 'References', back: 'Referenced by' });
  });
});
