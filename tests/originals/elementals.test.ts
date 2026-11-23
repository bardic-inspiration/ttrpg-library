// Elementals' own rules (docs/rulesets.md#fixture-rulesets): a card's element from its chip colors, the
// advantage cycle, and the creature budget. Run with `npm run test:originals`.
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { ruleset, tables } from '../fixtures/originals/rulesets/elementals/index.ts';
import { brokenOriginals, originalsJson, originalsSite, validateOriginals } from './fixture.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const CREATURE = (id: string) => `content/elementals/creature/${id}.json`;

async function resultWith(changes: Record<string, unknown | null>) {
  const root = await brokenOriginals(changes);
  temps.push(root);
  const { errors, warnings } = await validateOriginals(root);
  return { errors: errors.map((e) => `${e.file}: ${e.message}`), warnings: warnings.map((e) => `${e.file}: ${e.message}`) };
}

const derived = async (id: string) => (await originalsSite()).all.find(({ entry }) => entry.id === id)!.derived;

describe('derived values', () => {
  it('give a one-color card its base element, and what it beats and falls to', async () => {
    expect(await derived('ember-sprite')).toEqual({ element: 'fire', totalCost: 1, beats: ['wind'], beatenBy: ['water'] });
  });

  it('give a two-color card the blend of its colors, with both parts’ advantages', async () => {
    expect(await derived('steam-wraith')).toEqual({ element: 'steam', totalCost: 2, beats: ['fire', 'wind'], beatenBy: ['water', 'earth'] });
    expect(await derived('kiln')).toEqual({ element: 'magma', totalCost: 3, beats: ['water', 'wind'], beatenBy: ['water', 'wind'] });
  });

  it('keep key numbers in powers of 4', () => {
    expect([tables.life, tables.deckSize, tables.handSize, tables.chipsPerColor]).toEqual([64, 64, 4, 16]);
  });
});

describe('checks', () => {
  it('warn on a creature over its budget of 8 per chip', async () => {
    const devil = await originalsJson(CREATURE('dust-devil'));
    devil.stats.power = 12;
    expect(await resultWith({ [CREATURE('dust-devil')]: devil })).toEqual({
      errors: [],
      warnings: [`${CREATURE('dust-devil')}: stats.power: power plus toughness is 20, over the 16 its cost of 2 allows`],
    });
  });

  it('fail a card whose colors no element blends', async () => {
    expect((await resultWith({ 'rulesets/elementals/rules/element/mud.json': null })).errors).toEqual([
      `${CREATURE('mud-golem')}: stats.cost: no element blends these colors`,
    ]);
  });

  it('fail a cost of three colors, or a power off the steps of 4', async () => {
    const golem = await originalsJson(CREATURE('mud-golem'));
    golem.stats.cost.fire = 1;
    golem.stats.power = 6;
    expect((await resultWith({ [CREATURE('mud-golem')]: golem })).errors).toEqual([
      `${CREATURE('mud-golem')}: stats.cost: must NOT have more than 2 properties`,
      `${CREATURE('mud-golem')}: stats.power: must be multiple of 4`,
    ]);
  });
});

describe('ref labels', () => {
  it('name a blend’s parts, from each end', () => {
    expect(ruleset.refLabels('element', 'stats.blend[0]')).toEqual({ forward: 'Blend of', back: 'Blends into' });
    expect(ruleset.refLabels('invocation', 'stats.text')).toEqual({ forward: 'References', back: 'Referenced by' });
  });
});
