import { describe, expect, it } from 'vitest';
import { parseNameStatus, renderSummary } from '../scripts/pr-summary/index.ts';

describe('parseNameStatus', () => {
  it('keeps entry files and maps statuses', () => {
    const output = [
      'A\tcontent/dnd-5e-2024/creature/cinder-hound.json',
      'M\tcontent/dnd-5e-2024/spell/ember-lash.json',
      'D\tcontent/dnd-5e-2024/magic-item/old-ring.json',
      'A\tassets/images/dnd-5e-2024/creature/cinder-hound.png',
      'M\tSPEC.md',
      '',
    ].join('\n');
    expect(parseNameStatus(output)).toEqual([
      { status: 'added', path: 'content/dnd-5e-2024/creature/cinder-hound.json' },
      { status: 'modified', path: 'content/dnd-5e-2024/spell/ember-lash.json' },
      { status: 'removed', path: 'content/dnd-5e-2024/magic-item/old-ring.json' },
    ]);
  });
});

describe('renderSummary', () => {
  it('tables each changed entry with name, type, and summary', () => {
    const markdown = renderSummary([
      {
        status: 'added',
        path: 'content/dnd-5e-2024/creature/cinder-hound.json',
        entry: { name: 'Cinder Hound', type: 'creature', summary: 'A hound | of embers.' },
      },
      {
        status: 'removed',
        path: 'content/dnd-5e-2024/magic-item/old-ring.json',
        entry: undefined,
      },
    ]);
    expect(markdown).toContain('## Changed entries');
    expect(markdown).toContain('| added | Cinder Hound | creature | A hound \\| of embers. |');
    expect(markdown).toContain('| removed | `old-ring` | magic-item |  |');
  });

  it('says so when no entries changed', () => {
    expect(renderSummary([])).toContain('No entries changed.');
  });
});
