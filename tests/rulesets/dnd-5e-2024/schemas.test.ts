import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';

const dir = join(import.meta.dirname, '../../../rulesets/dnd-5e-2024/schemas');
const read = async (file: string) => JSON.parse(await readFile(join(dir, file), 'utf8'));

// The schemas and tables.json both list the shared enums (SPEC.md §6.2);
// these tests keep the two in step.
describe('dnd-5e-2024 schemas match tables.json', () => {
  it('shares abilities, damage types, and conditions', async () => {
    const { $defs } = await read('common.schema.json');
    expect($defs.Ability.enum).toEqual(tables.abilities);
    expect($defs.DamageType.enum).toEqual(tables.damageTypes);
    expect($defs.Condition.enum).toEqual(tables.conditions);
  });

  it('shares sizes, creature types, skills, and CRs', async () => {
    const { properties } = await read('creature.schema.json');
    expect(properties.size.items.enum).toEqual(Object.keys(tables.sizes));
    expect(properties.creatureType.enum).toEqual(tables.creatureTypes);
    expect(properties.skills.propertyNames.enum).toEqual(Object.keys(tables.skills));
    expect(properties.cr.enum).toEqual(tables.challengeRatings.map((row) => row.cr));
  });

  it('has the Appendix A CR table', () => {
    const row = (cr: number) => tables.challengeRatings.find((r) => r.cr === cr);
    expect(tables.challengeRatings).toHaveLength(34);
    expect(row(0)).toEqual({ cr: 0, xp: 0, xpWithDamage: 10, pb: 2 });
    expect(row(0.125)).toEqual({ cr: 0.125, xp: 25, pb: 2 });
    expect(row(4)).toEqual({ cr: 4, xp: 1100, pb: 2 });
    expect(row(13)).toEqual({ cr: 13, xp: 10000, pb: 5 });
    expect(row(24)).toEqual({ cr: 24, xp: 62000, pb: 7 });
    expect(row(29)).toEqual({ cr: 29, xp: 135000, pb: 9 });
  });
});
