// Text for the dnd-5e-2024 spell card (docs/rulesets.md#spells, docs/site.md#templates), worded
// through the phrase book (docs/site.md#wording). Spells have no derived values; every number here
// is authored and only formatted. Optional fields display by presence alone (docs/content-model.md#situational-fields).

import { present, whenPresent } from './display.ts';
import { formatSpellLevel } from './format.ts';
import { concat, countOf, joinWith, markdown, name, pluralOf, say, sayText, text, toMarkdown, toPlain, type Phrase } from './wording.ts';
import type { SpellStats } from '../../../rulesets/dnd-5e-2024/types.ts';

/**
 * "Level 1 Evocation (Sorcerer, Wizard)", or "Evocation Cantrip (…)" at level 0. The level reads as
 * the gallery's `spell-level` format does.
 */
export function levelLine(s: SpellStats): string {
  const school = name('school', s.school);
  const head = s.level === 0 ? say('spell.cantrip', { school }) : say('spell.leveled', { level: formatSpellLevel(s.level).replace(/^Level /, ''), school });
  return toPlain(concat(head, ' (', joinWith(s.classes.map((c) => name('class', c)), ', '), ')'));
}

/**
 * "Action", "Reaction, which you take when …", "10 minutes", with " or Ritual" when `ritual` is
 * true. Markdown, since `trigger` is a `Text` field.
 */
export function castingTimeLine(s: SpellStats): string {
  const { amount, unit, trigger, note } = s.castingTime;
  const word = name('castingUnit', unit);
  const isAction = ['action', 'bonus-action', 'reaction'].includes(unit);
  let line: Phrase = text(isAction ? (amount === 1 ? word : `${amount} ${pluralOf(word)}`) : countOf(amount, word));
  // A casting time the fields can't express, as printed (docs/content-model.md#srd-and-custom-entries, docs/rulesets.md#spells).
  if (present(note)) line = concat(line, ' ', note);
  if (present(trigger)) line = say('spell.trigger', { time: line, trigger: markdown(trigger) });
  return toMarkdown(s.ritual ? say('spell.ritual', { time: line }) : line);
}

/** "60 feet", "1 mile", "Self (15-foot Cone)". */
export function rangeLine(s: SpellStats): string {
  const { kind, feet, miles, area } = s.range;
  const distance = whenPresent(miles, (n) => countOf(n, 'mile')) ?? `${feet} feet`;
  const base = kind === 'distance' ? distance : name('rangeKind', kind);
  return whenPresent(area, (a) => sayText('spell.area', { range: base, size: String(a.size), shape: name('areaShape', a.shape) })) ?? base;
}

/** "V, S, M (a sliver of ice)". The material reads as printed; `costGp` and `consumed` are data only (docs/rulesets.md#spells). */
export function componentsLine(s: SpellStats): string {
  const { v, s: somatic, m } = s.components;
  const parts = [v && 'V', somatic && 'S'].filter((p): p is string => Boolean(p));
  const material = whenPresent(m, (mat) => `M (${mat.text})`);
  if (material) parts.push(material);
  return parts.join(', ') || sayText('spell.noComponents');
}

/** "Instantaneous", "1 hour", "Up to 8 hours", "Concentration, up to 1 minute". */
export function durationLine(s: SpellStats): string {
  const { kind, amount, unit, concentration, upTo } = s.duration;
  if (kind !== 'timed') return name('durationKind', kind);
  const span = countOf(amount ?? 0, name('durationUnit', unit ?? ''));
  if (concentration) return sayText('spell.concentration', { span });
  return present(upTo) ? sayText('spell.upTo', { span }) : span;
}
