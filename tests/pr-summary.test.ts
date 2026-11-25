import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { parseNameStatus, renderSummary, type ChangedFile } from '../scripts/pr-summary/index.ts';
import { validateLibrary } from '../scripts/validate/index.ts';
import { loadRegistry } from '../scripts/validate/schema.ts';
import { ruleset } from '../rulesets/dnd-5e-2024/index.ts';
import { cinderHound, frostLance, tempLibrary, wandOfFrostLances } from './helpers.ts';

// docs/workflow.md#ci-checks: the content-checks job summary.
const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The summary of `changes` against a library of `entries`, validated as CI validates the PR. */
async function summarize(entries: Record<string, any>[], changes: ChangedFile[]): Promise<string> {
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const library = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  expect(library.errors).toEqual([]);
  return renderSummary({ changes, library, registry: await loadRegistry(), modules: new Map([['dnd-5e-2024', ruleset]]) });
}

const HOUND = 'content/dnd-5e-2024/creature/cinder-hound.json';
const LANCE = 'content/dnd-5e-2024/spell/frost-lance.json';
const RING = 'content/dnd-5e-2024/item/old-ring.json';

/** The example hound, now casting Frost Lance with an adjusted spellcasting bonus. */
async function castingHound() {
  const hound = await cinderHound();
  hound.stats.spellcasting = { ability: 'cha', adjust: 1, atWill: [{ ref: 'spell/frost-lance' }] };
  return hound;
}

const oldRing = {
  ruleset: 'dnd-5e-2024',
  type: 'item',
  id: 'old-ring',
  name: 'Old Ring',
  summary: 'A ring | of old.',
  stats: { rarity: 'very-rare' },
};

describe('parseNameStatus', () => {
  it('keeps entry files and maps statuses', () => {
    const output = [
      'A\tcontent/dnd-5e-2024/creature/cinder-hound.json',
      'M\tcontent/dnd-5e-2024/spell/ember-lash.json',
      'D\tcontent/dnd-5e-2024/item/old-ring.json',
      'A\tassets/images/dnd-5e-2024/creature/cinder-hound.png',
      'M\tSPEC.md',
      '',
    ].join('\n');
    expect(parseNameStatus(output)).toEqual([
      { status: 'added', path: 'content/dnd-5e-2024/creature/cinder-hound.json' },
      { status: 'modified', path: 'content/dnd-5e-2024/spell/ember-lash.json' },
      { status: 'removed', path: 'content/dnd-5e-2024/item/old-ring.json' },
    ]);
  });
});

describe('renderSummary', () => {
  it('tables each changed entry with name, type, summary field, and summary, a removed one from the base', async () => {
    const markdown = await summarize([await castingHound(), await frostLance()], [
      { status: 'modified', path: HOUND, base: await cinderHound() },
      { status: 'added', path: LANCE },
      { status: 'removed', path: RING, base: oldRing },
      { status: 'removed', path: 'content/dnd-5e-2024/item/lost-ring.json' },
    ]);
    expect(markdown).toContain('## Changed entries');
    expect(markdown).toContain('| Change | Name | Type | Summary field | Summary |');
    expect(markdown).toContain('| modified | Cinder Hound | creature | CR: 2 | A soot-black hunting hound that exhales a cone of embers and tracks prey by the smell of smoke. |');
    // The summary field reads as its facet does: a spell level by its format, a rarity by its vocabulary.
    expect(markdown).toContain('| added | Frost Lance | spell | Level: 1 | A spear of ice that pierces a target and slows its movement. |');
    expect(markdown).toContain('| removed | Old Ring | item | Rarity: Very Rare | A ring \\| of old. |');
    // An entry that can't be read falls back to the id and type its path gives.
    expect(markdown).toContain('| removed | `lost-ring` | item |  |  |');
  });

  it('gives a creature its AC, derived HP, attack bonuses, DCs, and average damage per action', async () => {
    const markdown = await summarize([await castingHound(), await frostLance()], [{ status: 'modified', path: HOUND, base: await cinderHound() }]);
    expect(markdown).toContain(
      [
        '### Creature values',
        '',
        '**Cinder Hound**: AC 13 (natural armor), HP 32 (5d8 + 10)',
        '- Bite: +4 to hit, 6 (1d8 + 2) + 3 (1d6) damage, 9 on average',
        '- Ember Breath: DC 12, 10 (3d6) damage, 10 on average',
        '- Spellcasting: +1 to hit, DC 9',
      ].join('\n'),
    );
  });

  it('lists every warning, including each formula adjustment', async () => {
    const markdown = await summarize([await castingHound(), await frostLance()], [{ status: 'modified', path: HOUND, base: await cinderHound() }]);
    expect(markdown).toContain(
      '### Warnings\n\n- `content/dnd-5e-2024/creature/cinder-hound.json`: stats.spellcasting.adjust: spellcasting adjusted by 1; confirm the deviation',
    );
    const quiet = await summarize([await frostLance()], [{ status: 'added', path: LANCE }]);
    expect(quiet).toContain('### Warnings\n\nNone.');
  });

  it('lists the back-links the change adds, labeled as the target’s page shows them', async () => {
    const markdown = await summarize([await castingHound(), await frostLance()], [
      { status: 'modified', path: HOUND, base: await cinderHound() },
      { status: 'added', path: LANCE },
    ]);
    expect(markdown).toContain(
      [
        '### New back-links',
        '',
        '| Entry | Back-link |',
        '|---|---|',
        '| Frost Lance | Cast by: Cinder Hound |',
        '| Sorcerer | Spells: Frost Lance |',
        '| Wizard | Spells: Frost Lance |',
      ].join('\n'),
    );
  });

  it('leaves out a link the base already had, and the links of unchanged entries', async () => {
    const markdown = await summarize([await castingHound(), await frostLance(), await wandOfFrostLances()], [
      { status: 'modified', path: HOUND, base: await castingHound() },
    ]);
    expect(markdown).toContain('### New back-links\n\nNone.');
  });

  it('says so when no entries changed', async () => {
    expect(await summarize([], [])).toContain('No entries changed.');
  });
});
