// Text for a dnd-5e-2024 class and subclass (docs/rulesets.md#classes, docs/rulesets.md#subclasses):
// the Core Traits lines, the "Becoming a <Class> …" bullets, the Features table, feature and option
// headings, and the spell list, worded through the phrase book. Tables are markdown pipe tables,
// with each feature and spell a `{ref:…}` token, so they render with the site's table style.

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import type { ClassFeatureStats, ClassOptionStats, ClassStats, DerivedClass, LinkedClass } from '../../../rulesets/dnd-5e-2024/types.ts';
import { startingEquipment } from './starting-equipment.ts';
import type { PropertyLine } from './template.ts';
import { escapeMarkdown, joinWith, link, list, markdown, name, say, sayMarkdown, sayText, toMarkdown, withArticle, withNote, type Phrase } from './wording.ts';

/** The Core Traits table as labeled lines, in the SRD's order; Tool Proficiencies only when present. */
export function classLines(className: string, s: ClassStats, names: Map<string, string> = new Map()): PropertyLine[] {
  const abilities = s.primaryAbility.abilities.map((a) => name('ability', a));
  const skills = s.skills.from
    ? sayMarkdown('class.chooseSkills', { count: String(s.skills.choose), skills: list(s.skills.from.map((skill) => name('skill', skill)), 'or') })
    : sayMarkdown('class.chooseAnySkills', { count: String(s.skills.choose) });
  return [
    { label: 'Primary Ability', value: toMarkdown(s.primaryAbility.join ? list(abilities, s.primaryAbility.join) : abilities[0]!), markdown: true },
    { label: 'Hit Point Die', value: sayText('class.hitDie', { die: name('hitDie', s.hitDie), class: className }) },
    { label: 'Saving Throw Proficiencies', value: toMarkdown(list(s.savingThrows.map((a) => name('ability', a)), 'and')), markdown: true },
    { label: 'Skill Proficiencies', value: skills, markdown: true },
    { label: 'Weapon Proficiencies', value: s.weapons, markdown: true },
    ...(s.tools === undefined ? [] : [{ label: 'Tool Proficiencies', value: s.tools, markdown: true }]),
    { label: 'Armor Training', value: s.armor, markdown: true },
    { label: 'Starting Equipment', value: startingEquipment(s.equipment, names), markdown: true },
  ];
}

/** The class's headings and fixed sentences, each from the phrase book. */
export const classWords = (className: string) => ({
  coreTraits: sayText('class.coreTraits', { class: className }),
  becoming: sayText('class.becoming', { class: withArticle(className) }),
  levelOne: sayText('class.levelOne'),
  levelOneBullets: [sayText('class.levelOneTraits', { class: className }), sayText('class.levelOneFeatures', { class: className })],
  multiclass: sayText('class.multiclass'),
  classFeatures: sayText('class.classFeatures', { class: className }),
  featuresIntro: sayText('class.featuresIntro', { aClass: withArticle(className), class: className }),
  spellList: sayText('class.spellList', { class: className }),
  spellListIntro: sayText('class.spellListIntro', { class: className }),
  subclasses: sayText('class.subclasses', { class: className }),
});

/** "Level 1: Rage", at the level the feature is described at. */
export const featureHeading = (featureName: string, s: ClassFeatureStats): string => {
  const first = s.levels[0]!;
  return sayText('classFeature.heading', { level: String(typeof first === 'number' ? first : first.level), name: featureName });
};

/** A markdown pipe table with a title: a bold paragraph above it. */
const table = (title: string, header: string[], rows: string[][]): string =>
  [`**${escapeMarkdown(title)}**`, '', `| ${header.map(escapeMarkdown).join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');

const dash = (): string => sayText('class.noFeature');

/**
 * The Features table: Level, Proficiency Bonus, Class Features, the class's own columns, then
 * Cantrips, Prepared Spells, and the slots, as markdown. A feature reads as its name, linked, with
 * its row's note; a later subclass level reads "Subclass feature"; a level with neither, "—". Slot
 * columns run to the highest spell level with a slot, so a half caster prints levels 1–5.
 */
export function featuresTable(className: string, s: ClassStats, derived: DerivedClass & LinkedClass): string {
  const slotLevels = Math.max(0, ...(derived.spellSlots ?? []).map((row) => row.length));
  const header = [
    'Level',
    'Proficiency Bonus',
    'Class Features',
    ...(s.columns ?? []).map((c) => c.name),
    ...(s.spellcasting?.cantrips ? ['Cantrips'] : []),
    ...(s.spellcasting ? ['Prepared Spells'] : []),
    ...Array.from({ length: slotLevels }, (_, i) => sayText('class.slotLevel', { level: String(i + 1) })),
    ...(derived.pactSlots ? ['Spell Slots', 'Slot Level'] : []),
  ];
  const rows = derived.featureRows.map((row, i) => {
    const features: Phrase[] = [...row.features.map((f) => withNote(link(f.ref), f.note)), ...(row.subclass ? [say('class.subclassFeature')] : [])];
    const slots = derived.spellSlots?.[i] ?? [];
    return [
      String(i + 1),
      signed(derived.proficiencyBonus[i]!),
      features.length > 0 ? toMarkdown(joinWith(features, ', ')) : dash(),
      ...(s.columns ?? []).map((c) => escapeMarkdown(c.values[i]!)),
      ...(s.spellcasting?.cantrips ? [String(s.spellcasting.cantrips[i])] : []),
      ...(s.spellcasting ? [String(s.spellcasting.prepared[i])] : []),
      ...Array.from({ length: slotLevels }, (_, level) => (slots[level] ? String(slots[level]) : dash())),
      ...(derived.pactSlots ? [String(derived.pactSlots[i]!.slots), String(derived.pactSlots[i]!.slotLevel)] : []),
    ];
  });
  return table(sayText('class.featuresTable', { class: className }), header, rows);
}

/** The spell list, one titled table per spell level: Spell, School, and Special (C, R, M, or "—"). */
export function spellListTables(className: string, derived: LinkedClass): string[] {
  return derived.spellList.map(({ level, spells }) =>
    table(
      level === 0 ? sayText('class.cantrips', { class: className }) : sayText('class.spellLevel', { level: String(level), class: className }),
      ['Spell', 'School', 'Special'],
      spells.map((spell) => {
        const special = [spell.concentration && 'C', spell.ritual && 'R', spell.material && 'M'].filter((x): x is string => typeof x === 'string');
        return [toMarkdown(link(spell.ref)), name('school', spell.school), special.length > 0 ? special.join(', ') : dash()];
      }),
    ),
  );
}

/** An option's lines under its name: "Prerequisite: …" and "Cost: …", as markdown. */
export function optionLines(s: ClassOptionStats): string[] {
  return [
    ...(s.prerequisite === undefined ? [] : [sayMarkdown('classOption.prerequisite', { prerequisite: markdown(s.prerequisite) })]),
    ...(s.cost === undefined ? [] : [sayMarkdown('classOption.cost', { cost: s.cost })]),
  ];
}

/** The title of an option's closing "Repeatable." paragraph. */
export const OPTION_REPEATABLE = sayText('classOption.repeatable');

/** "Wizard Subclass: Evoker", the subclass page's heading. */
export const subclassHeading = (className: string, subclassName: string): string => sayText('subclass.heading', { class: className, name: subclassName });
