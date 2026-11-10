// Lines for a dnd-5e-2024 background (docs/rulesets.md#backgrounds), worded through the phrase book.
// Each value is markdown, so the feat, tool, and equipment refs render as links.

import type { BackgroundStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { startingEquipment } from './starting-equipment.ts';
import type { PropertyLine } from './template.ts';
import { joinWith, link, list, name, sayMarkdown, toMarkdown, withNote } from './wording.ts';

export function backgroundLines(s: BackgroundStats, names: Map<string, string> = new Map()): PropertyLine[] {
  const tool = withNote(link(s.tool.ref), s.tool.note);
  return [
    // A labeled set reads as a comma list, as the SRD prints it; a prose list takes a conjunction.
    { label: 'Ability Scores', value: toMarkdown(joinWith(s.abilities.map((a) => name('ability', a)), ', ')), markdown: true },
    { label: 'Feat', value: sayMarkdown('background.feat', { feat: withNote(link(s.feat.ref), s.feat.note) }), markdown: true },
    { label: 'Skill Proficiencies', value: toMarkdown(list(s.skills.map((skill) => name('skill', skill)), 'and')), markdown: true },
    { label: 'Tool Proficiency', value: s.tool.choose ? sayMarkdown('background.chooseTool', { tool }) : toMarkdown(tool), markdown: true },
    { label: 'Equipment', value: startingEquipment(s.equipment, names), markdown: true },
  ];
}
