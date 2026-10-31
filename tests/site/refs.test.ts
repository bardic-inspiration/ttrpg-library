import { describe, expect, it } from 'vitest';
import { ruleset } from '../../rulesets/dnd-5e-2024/index.ts';
import { groupRefs, type RefTarget } from '../../site/src/lib/refs.ts';

const targets = new Map<string, RefTarget>([
  ['spell/frost-lance', { type: 'spell', name: 'Frost Lance', path: 'dnd-5e-2024/spell/frost-lance/' }],
  ['magic-item/wand-of-frost-lances', { type: 'magic-item', name: 'Wand of Frost Lances', path: 'dnd-5e-2024/magic-item/wand-of-frost-lances/' }],
  ['creature/cinder-witch', { type: 'creature', name: 'Cinder Witch', path: 'dnd-5e-2024/creature/cinder-witch/' }],
]);
const labels = ruleset.refLabels.bind(ruleset);

describe('dnd-5e-2024 ref labels (SPEC.md §5.7)', () => {
  it('labels spell lists "Casts" and gear "Gear"', () => {
    expect(labels('magic-item', 'stats.spells[0].spell')).toEqual({ forward: 'Casts', back: 'Cast by' });
    expect(labels('creature', 'stats.spellcasting.perDay.1[0]')).toEqual({ forward: 'Casts', back: 'Cast by' });
    expect(labels('creature', 'stats.gear[2]')).toEqual({ forward: 'Gear', back: 'Carried by' });
    expect(labels('spell', 'stats.somethingElse')).toEqual({ forward: 'References', back: 'Referenced by' });
  });
});

describe('groupRefs (SPEC.md §9.4)', () => {
  it('shows the wand casting Frost Lance, and Frost Lance cast by the wand and a creature', () => {
    expect(groupRefs('magic-item', [{ path: 'stats.spells[0].spell', key: 'spell/frost-lance' }], [], targets, labels)).toEqual({
      forward: [{ label: 'Casts', targets: [targets.get('spell/frost-lance')] }],
      back: [],
    });
    const back = groupRefs(
      'spell',
      [],
      [
        { path: 'stats.spellcasting.atWill[0]', key: 'creature/cinder-witch' },
        { path: 'stats.spellcasting.perDay.1[0]', key: 'creature/cinder-witch' },
        { path: 'stats.spells[0].spell', key: 'magic-item/wand-of-frost-lances' },
      ],
      targets,
      labels,
    );
    expect(back.back).toEqual([
      { label: 'Cast by', targets: [targets.get('creature/cinder-witch'), targets.get('magic-item/wand-of-frost-lances')] },
    ]);
  });

  it('skips a link whose target is unknown', () => {
    expect(groupRefs('magic-item', [{ path: 'stats.spells[0].spell', key: 'spell/gone' }], [], targets, labels).forward).toEqual([]);
  });
});
