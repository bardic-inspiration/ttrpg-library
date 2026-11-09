// Lines for a dnd-5e-2024 background (docs/rulesets.md#backgrounds), as SRD 5.2 prints them. Each
// value is markdown, so the feat, tool, and equipment refs render as links.

import type { BackgroundStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { titleCase } from './creature.ts';
import { formatAbility } from './format.ts';
import { escapeMarkdown } from './markdown.ts';
import { startingEquipment } from './starting-equipment.ts';
import type { PropertyLine } from './template.ts';

const noted = (ref: { ref: string; note?: string }): string =>
  ref.note === undefined ? `{ref:${ref.ref}}` : `{ref:${ref.ref}} (${escapeMarkdown(ref.note)})`;

export function backgroundLines(s: BackgroundStats): PropertyLine[] {
  return [
    { label: 'Ability Scores', value: s.abilities.map(formatAbility).join(', '), markdown: true },
    // The SRD sends the reader to the Feats chapter after the feat's name.
    { label: 'Feat', value: `${noted(s.feat)} (see “Feats”)`, markdown: true },
    { label: 'Skill Proficiencies', value: s.skills.map(titleCase).join(' and '), markdown: true },
    { label: 'Tool Proficiency', value: `${s.tool.choose ? 'Choose one kind of ' : ''}${noted(s.tool)}`, markdown: true },
    { label: 'Equipment', value: startingEquipment(s.equipment, { and: false }), markdown: true },
  ];
}
