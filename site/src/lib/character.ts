// Text for a dnd-5e-2024 character's profile (docs/rulesets.md#characters, docs/site.md#templates): its
// identity, combat, skill, proficiency, attack, spellcasting, feature, and equipment lines, composed
// from its stats and derived values through the phrase book. Every number arrives from the derived
// values; nothing here computes a rules value.

import { printMinus, signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { CharacterAttack, CharacterStats, DerivedCharacter, LinkedCharacter } from '../../../rulesets/dnd-5e-2024/types.ts';
import { escapeMarkdown } from './markdown.ts';
import type { PropertyLine } from './template.ts';
import { concat, countOf, joinWith, link, list, name, say, sayText, toMarkdown, toPlain, withNote, type Phrase } from './wording.ts';

export type Character = DerivedCharacter & LinkedCharacter;

const nameOf = (ref: string, names: Map<string, string>): string => names.get(ref) ?? ref.slice(ref.indexOf('/') + 1);

/** "Fighter 3 (Champion) / Wizard 2", the class levels in the order taken. */
export const classLevels = (s: CharacterStats, names: Map<string, string>): string =>
  s.classes
    .map((c) => {
      const slots = { class: nameOf(c.class.ref, names), level: String(c.level) };
      return c.subclass ? sayText('character.classLevelSubclass', { ...slots, subclass: nameOf(c.subclass.ref, names) }) : sayText('character.classLevel', slots);
    })
    .join(' / ');

/** Species and Background, each linked. */
export const identityLines = (s: CharacterStats): PropertyLine[] => [
  { label: 'Species', value: toMarkdown(link(s.species.ref)), markdown: true },
  { label: 'Background', value: toMarkdown(link(s.background.ref)), markdown: true },
];

const feet = (n: number): string => sayText('character.feet', { feet: String(n) });

/** "30 ft.", then any Climb, Swim, or Fly Speed. */
const speedText = (d: Character): string =>
  [feet(d.speed), ...(['climb', 'swim', 'fly'] as const).flatMap((mode) => (d.speeds?.[mode] === undefined ? [] : [`${name('speedMode', mode)} ${feet(d.speeds[mode]!)}`]))].join(', ');

/** Armor Class, Hit Points, Initiative, Speed, Proficiency Bonus, and Passive Perception. */
export const combatLines = (d: Character): PropertyLine[] => [
  { label: 'Armor Class', value: String(d.ac.value) },
  { label: 'Hit Points', value: String(d.hp) },
  { label: 'Initiative', value: signed(d.initiative) },
  { label: 'Speed', value: speedText(d) },
  { label: 'Proficiency Bonus', value: signed(d.proficiencyBonus) },
  { label: 'Passive Perception', value: String(d.passivePerception) },
];

/** The ability table's rows: each score, modifier, and saving throw. */
export const abilityRows = (d: Character) =>
  tables.abilities.map((ability) => ({ ability: ability.toUpperCase(), score: d.scores[ability], mod: signed(d.abilityMods[ability]), save: signed(d.saves[ability]) }));

export interface SkillItem {
  skill: string;
  bonus: string;
  /** "Proficient" or "Expertise", when it has one. */
  mark?: string;
}

const MARKS = { proficient: 'Proficient', expertise: 'Expertise' } as const;

/** Every skill with its bonus, alphabetized by name, its proficiency marked. */
export const skillItems = (d: Character): SkillItem[] =>
  Object.entries(d.skills)
    .map(([skill, { bonus, proficiency }]) => ({ skill: name('skill', skill), bonus: signed(bonus), ...(proficiency && { mark: MARKS[proficiency] }) }))
    .sort((a, b) => a.skill.localeCompare(b.skill));

/**
 * Saving Throws, Armor and Weapons as the starting class prints them, its Tools text, the tool
 * picks, and the languages, each line only when it has something.
 */
export function proficiencyLines(d: Character): PropertyLine[] {
  const p = d.proficiencies;
  const starting = p.training.find((t) => t.multiclass === undefined);
  const lines: PropertyLine[] = [{ label: 'Saving Throws', value: toPlain(list(tables.abilities.filter((a) => p.saves.some((s) => s.abilities.includes(a))).map((a) => name('ability', a)), 'and')) }];
  if (starting?.armor) lines.push({ label: 'Armor', value: starting.armor });
  if (starting?.weapons) lines.push({ label: 'Weapons', value: starting.weapons });
  const tools: Phrase[] = [
    ...(starting?.tools ? [concat({ markdown: escapeMarkdown(starting.tools) })] : []),
    ...p.tools.map((t) => withNote(link(t.ref), t.note)),
  ];
  if (tools.length > 0) lines.push({ label: 'Tools', value: toMarkdown(joinWith(tools, ', ')), markdown: true });
  if (p.languages.length > 0) lines.push({ label: 'Languages', value: p.languages.map((l) => l.language).join(', ') });
  return lines;
}

/** Each later class's "As a Multiclass Character" text, headed with its class, as markdown. */
export const multiclassTraining = (d: Character, names: Map<string, string>): string[] =>
  d.proficiencies.training.flatMap((t) =>
    t.multiclass === undefined ? [] : [`***${escapeMarkdown(sayText('character.multiclass', { class: nameOf(t.source, names) }))}.***\n\n${t.multiclass}`],
  );

/**
 * One equipped weapon's attack as markdown, led by its linked name as an inline heading:
 * "***Longsword.*** +6 to hit, 1d8 + 3 Slashing damage, or 1d10 + 3 two-handed; Versatile; Mastery: Sap",
 * each minus printed as U+2212 (docs/rulesets.md#creature-display-forms).
 */
export function attackText(a: CharacterAttack): string {
  const damage = say('creature.damage', { amount: printMinus(a.damage.display), type: name('damageType', a.damage.type) });
  const twoHanded = a.versatile && printMinus(a.versatile.display);
  const hit = say('character.attack', { bonus: signed(a.attackBonus), damage: twoHanded ? say('character.versatile', { damage, twoHanded }) : damage });
  const parts: Phrase[] = [
    hit,
    ...(a.range ? [say('creature.range', { range: `${a.range.normal}/${a.range.long}` })] : []),
    ...(a.properties.length > 0 ? [joinWith(a.properties.map((p) => link(p.ref)), ', ')] : []),
    say('character.mastery', { mastery: link(a.mastery.ref) }),
  ];
  return `***${toMarkdown(link(a.ref))}.*** ${toMarkdown(joinWith(parts, '; '))}`;
}

/** Per casting class: its ability, save DC, and attack bonus, and its cantrip and prepared counts. */
export const spellcastingLines = (d: Character, names: Map<string, string>): PropertyLine[] =>
  d.spellcasting.map((c) => {
    const counts = c.cantrips > 0 ? sayText('character.spellCounts', { cantrips: countOf(c.cantrips, 'cantrip'), prepared: String(c.prepared) }) : `${c.prepared} prepared`;
    return {
      label: nameOf(c.class, names),
      value: `${sayText('character.spellcasting', { ability: name('ability', c.ability), dc: String(c.saveDc), bonus: signed(c.attackBonus) })}; ${counts}`,
    };
  });

/** Spell Slots per level, and Pact Magic's slots apart. */
export function slotLines(d: Character): PropertyLine[] {
  const lines: PropertyLine[] = [];
  if (d.spellSlots) lines.push({ label: 'Spell Slots', value: d.spellSlots.map((n, i) => sayText('character.slots', { slots: String(n), level: String(i + 1) })).join(', ') });
  if (d.pactSlots) lines.push({ label: 'Pact Magic Slots', value: sayText('character.slots', { slots: String(d.pactSlots.slots), level: String(d.pactSlots.slotLevel) }) });
  return lines;
}

/** The spell list by level, "Cantrips" then "Level 1" and up, each spell linked. */
export const spellLines = (d: Character): PropertyLine[] =>
  d.spells.map(({ level, spells }) => ({
    label: level === 0 ? 'Cantrips' : sayText('classFeature.level', { level: String(level) }),
    value: toMarkdown(joinWith(spells.map((ref) => link(ref)), ', ')),
    markdown: true,
  }));

/**
 * The features by source, each linked to its section: each class's and subclass's, the species'
 * traits, then the feats, each with the choice it's taken with and where it came from, and the
 * class options.
 */
export function featureLines(s: CharacterStats, d: Character, names: Map<string, string>): PropertyLine[] {
  const linked = (refs: string[]) => toMarkdown(joinWith(refs.map((ref) => link(ref)), ', '));
  const lines: PropertyLine[] = d.features
    .filter((group) => group.features.length > 0)
    .map((group) => ({ label: nameOf(group.source, names), value: linked(group.features.map((f) => f.ref)), markdown: true }));
  const feats = (s.feats ?? []).map((f) => {
    const from = f.source.level === undefined ? nameOf(f.source.ref, names) : sayText('character.classLevel', { class: nameOf(f.source.ref, names), level: String(f.source.level) });
    return withNote(link(f.ref), [f.note, from].filter((n): n is string => n !== undefined).join('; '));
  });
  if (feats.length > 0) lines.push({ label: 'Feats', value: toMarkdown(joinWith(feats, ', ')), markdown: true });
  if (s.options && s.options.length > 0) lines.push({ label: 'Options', value: linked(s.options.map((o) => o.ref)), markdown: true });
  return lines;
}

/** Each equipped item, linked, with its base item, variant, and attunement noted: "Armor, +1, +2, or +3 (Chain Mail, +1)". */
export const equipmentItems = (s: CharacterStats): string[] =>
  (s.equipped ?? []).map((e) => {
    const notes: Phrase[] = [...(e.base ? [link(e.base.ref)] : []), ...(e.variant ? [concat(e.variant)] : []), ...(e.attuned ? [say('character.attuned')] : [])];
    return toMarkdown(withNote(link(e.ref), notes.length > 0 ? joinWith(notes, ', ') : undefined));
  });
