import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { deriveCreature } from '../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../rulesets/dnd-5e-2024/index.ts';
import type { CreatureStats } from '../../rulesets/dnd-5e-2024/types.ts';
import CreatureStatBlock from '../../site/src/components/templates/CreatureStatBlock.astro';
import { present, whenPresent } from '../../site/src/lib/display.ts';
import { cinderHound } from '../helpers.ts';

describe('display helpers (SPEC.md §5.8)', () => {
  it('decides from presence alone, so 0, false, and "" are present', () => {
    expect([0, false, '', undefined].map(present)).toEqual([true, true, true, false]);
    expect(whenPresent(0, (n) => `+${n}`)).toBe('+0');
    expect(whenPresent(undefined as number | undefined, (n) => `+${n}`)).toBeUndefined();
  });
});

async function render(stats: CreatureStats): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(CreatureStatBlock, {
    props: { name: 'Test Creature', stats, derived: deriveCreature(stats, tables), names: new Map() },
  });
  // Compare text, not markup: drop tags and collapse whitespace.
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('creature stat block situational fields (SPEC.md §5.8, §9.5)', () => {
  it('omits every optional field that is absent', async () => {
    const { skills, immunities, senses, traits, ac, ...required } = (await cinderHound()).stats as CreatureStats;
    const text = await render({ ...required, ac: { value: ac.value } });
    for (const label of ['Skills', 'Vulnerabilities', 'Resistances', 'Immunities', 'Gear', 'Traits', 'Bonus Actions', 'Reactions', 'Legendary Actions', 'Spellcasting', 'Darkvision', 'natural armor', '(hover)', 'in lair']) {
      expect(text).not.toContain(label);
    }
  });

  it('shows required fields even at 0 or empty, and derived lines without their optional inputs', async () => {
    const { senses, ...base } = (await cinderHound()).stats as CreatureStats;
    const text = await render({ ...base, speed: { walk: 0 }, cr: 0, languages: { list: [] } });
    expect(text).toContain('Speed 0 ft.');
    expect(text).toContain('CR 0 (XP 10; PB +2)'); // CR 0 that deals damage is worth 10 XP
    expect(text).toContain('Languages None');
    expect(text).toContain('Senses Passive Perception 13');
    expect(text).toContain('Initiative +2 (12)');
  });

  it('shows optional fields when present', async () => {
    const base = (await cinderHound()).stats as CreatureStats;
    const text = await render({
      ...base,
      speed: { walk: 30, fly: 60, hover: true },
      lair: true,
      gear: ['Spear'],
      languages: { list: ['Common'], telepathy: 60 },
      legendaryActions: { uses: 3, usesInLair: 4, items: [{ name: 'Snap', kind: 'other', text: 'The hound bites.' }] },
    });
    expect(text).toContain('Skills Perception +3, Stealth +4');
    expect(text).toContain('Immunities Fire');
    expect(text).toContain('Gear Spear');
    expect(text).toContain('Fly 60 ft. (hover)');
    expect(text).toContain('or 700 in lair');
    expect(text).toContain('Common; telepathy 60 ft.');
    expect(text).toContain('Legendary Action Uses: 3 (4 in Lair).');
    expect(text).toContain('13 (natural armor)');
  });
});
