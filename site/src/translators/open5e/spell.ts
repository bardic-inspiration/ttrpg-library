// Spells to and from Open5e's Spell record (docs/export.md#open5e). Spells have no derived values:
// every number is authored and maps to its Open5e field.

import type { SpellStats } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { rangeLine } from '../../lib/spell.ts';
import { countOf, name as word, phrases } from '../../lib/wording.ts';
import type { ImportContext, ImportedEntry, TranslatorItem } from '../types.ts';
import { DOCUMENT, keyOf, summary, type Record5e } from './document.ts';
import { exportText, resolveName, Skips, slug } from './text.ts';

/** Library casting times and Open5e's `casting_time` values. */
const CASTING_TIMES: [string, string][] = [
  ['1 action', 'action'],
  ['1 bonus-action', 'bonus-action'],
  ['1 reaction', 'reaction'],
  ['1 minute', '1minute'],
  ['5 minute', '5minutes'],
  ['10 minute', '10minutes'],
  ['1 hour', '1hour'],
  ['4 hour', '4hours'],
  ['7 hour', '7hours'],
  ['8 hour', '8hours'],
  ['9 hour', '9hours'],
  ['12 hour', '12hours'],
  ['24 hour', '24hours'],
];
const DURATION_KINDS: [SpellStats['duration']['kind'], string][] = [
  ['instantaneous', 'instantaneous'],
  ['until-dispelled', 'until dispelled'],
  ['until-dispelled-or-triggered', 'until dispelled or triggered'],
  ['special', 'special'],
];
/** Open5e's `duration` values (its schema's enum) that a timed duration can take. */
const TIMED = new Set([
  '1 round', '2 rounds', '3 rounds', '4 rounds', '5 rounds', '6 rounds', '10 rounds', 'up to 1 minute', '1 minute', '5 minutes', '10 minutes',
  'up to 1 hour', '1 hour', '2 hours', '3 hours', '6 hours', 'up to 8 hours', '8 hours', '10 hours', '12 hours', '24 hours', '1 day', '3 days',
  '5 days', '7 days', '10 days', '13 days', '30 days', '1 year',
]);
const SHAPES = new Set(['cone', 'cube', 'cylinder', 'line', 'sphere']);
const TRIGGER = 'which you take ';

function durationOf(s: SpellStats): string | undefined {
  const { kind, amount, unit, upTo, concentration } = s.duration;
  if (kind !== 'timed') return DURATION_KINDS.find(([k]) => k === kind)?.[1];
  const span = `${upTo && !concentration ? 'up to ' : ''}${countOf(amount ?? 0, unit ?? '')}`;
  return TIMED.has(span) ? span : undefined;
}

export function exportSpell(item: TranslatorItem, skips: Skips): Record5e {
  const s = item.entry.stats as SpellStats;
  const text = (value: string | undefined, path: string) => (value === undefined ? undefined : exportText(value, item.names, skips, path));
  if (s.statBlocks) skips.add('stats.statBlocks', 'Open5e has no field for an embedded stat block.');
  if (s.castingTime.note !== undefined) skips.add('stats.castingTime.note', 'Open5e has no field for a casting time note.');
  const castingTime = CASTING_TIMES.find(([k]) => k === `${s.castingTime.amount} ${s.castingTime.unit}`)?.[1];
  if (!castingTime) skips.add('stats.castingTime', `Open5e has no casting time of ${s.castingTime.amount} ${s.castingTime.unit}; it exports as an action.`);
  const duration = durationOf(s);
  if (!duration) skips.add('stats.duration', 'Open5e has no such duration; it exports as special.');
  const area = s.range.area;
  if (area && !SHAPES.has(area.shape)) skips.add('stats.range.area', `Open5e has no ${area.shape} shape; the range text keeps it.`);
  const cost = s.components.m?.costGp;
  const higher = s.level === 0 ? s.cantripUpgrade : s.higherLevels;
  return {
    key: keyOf(`spell/${item.entry.id}`),
    document: DOCUMENT,
    casting_options: [],
    school: summary(s.school, word('school', s.school)),
    classes: s.classes.map((c) => summary(keyOf(c.ref), item.names[c.ref] ?? c.ref)),
    range_unit: 'feet',
    shape_size_unit: 'feet',
    name: item.entry.name,
    desc: text(s.effect, 'stats.effect'),
    level: s.level,
    higher_level: text(higher, s.level === 0 ? 'stats.cantripUpgrade' : 'stats.higherLevels') ?? '',
    target_type: null,
    range_text: rangeLine(s),
    range: s.range.feet ?? null,
    ritual: s.ritual,
    casting_time: castingTime ?? 'action',
    reaction_condition: s.castingTime.trigger === undefined ? null : `${TRIGGER}${text(s.castingTime.trigger, 'stats.castingTime.trigger')}`,
    verbal: s.components.v,
    somatic: s.components.s,
    material: s.components.m !== undefined,
    material_specified: s.components.m?.text ?? '',
    material_cost: cost === undefined ? null : cost.toFixed(2),
    material_consumed: s.components.m?.consumed === true,
    target_count: null,
    saving_throw_ability: '',
    attack_roll: false,
    damage_roll: '',
    damage_types: [],
    duration: duration ?? 'special',
    shape_type: area && SHAPES.has(area.shape) ? area.shape : null,
    shape_size: area && SHAPES.has(area.shape) ? area.size : null,
    concentration: s.duration.concentration,
    crossreferences: { to: [] },
  };
}

const singular = (unit: string): string => (unit.endsWith('s') ? unit.slice(0, -1) : unit);
const vocabularyKey = (vocabulary: string, display: string): string | undefined =>
  Object.entries(phrases.vocabulary[vocabulary] ?? {}).find(([, v]) => v === display)?.[0];

/** Reads range_text as rangeLine writes it (site/src/lib/spell.ts). */
function readRange(text: string): SpellStats['range'] | undefined {
  const area = /^(.*) \((\d+)-foot (\w+)\)$/.exec(text);
  const base = area ? (area[1] ?? '') : text;
  let range: SpellStats['range'] | undefined;
  const feet = /^(\d+) (?:feet|foot)$/.exec(base);
  const miles = /^(\d+) miles?$/.exec(base);
  const kind = vocabularyKey('rangeKind', base) as SpellStats['range']['kind'] | undefined;
  if (feet) range = { kind: 'distance', feet: Number(feet[1]) };
  else if (miles) range = { kind: 'distance', miles: Number(miles[1]) };
  else if (kind) range = { kind };
  if (!range) return undefined;
  const shape = area && vocabularyKey('areaShape', area[3] ?? '');
  if (area && shape) range.area = { shape, size: Number(area[2]) };
  return area && !shape ? undefined : range;
}

function readDuration(value: string, concentration: boolean): SpellStats['duration'] | undefined {
  const kind = DURATION_KINDS.find(([, v]) => v === value)?.[0];
  if (kind) return { kind, concentration };
  const timed = /^(up to )?(\d+) (round|minute|hour|day)s?$/.exec(value);
  if (!timed) return undefined;
  const duration: SpellStats['duration'] = { kind: 'timed', amount: Number(timed[2]), unit: singular(timed[3] ?? '') as 'round', concentration };
  if (timed[1] && !concentration) duration.upTo = true;
  return duration;
}

export function importSpell(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined {
  const name = String(record.name ?? '');
  const level = Number(record.level);
  const school = String(record.school?.key ?? '');
  const casting = CASTING_TIMES.find(([, v]) => v === record.casting_time)?.[0];
  const range = readRange(String(record.range_text ?? ''));
  const duration = readDuration(String(record.duration ?? ''), record.concentration === true);
  const problems = [
    !(level >= 0 && level <= 9) ? 'a level' : '',
    !phrases.vocabulary.school?.[school] ? 'a school' : '',
    !casting ? 'a casting time' : '',
    !range ? 'a range' : '',
    !duration ? 'a duration' : '',
  ].filter(Boolean);
  if (problems.length) {
    skips.add('', `It has no ${problems.join(', ')} the library can read, so it isn't imported.`);
    return undefined;
  }
  const classes = ((record.classes ?? []) as Record5e[]).flatMap((c) => {
    const ref = resolveName('class', String(c.name ?? ''), context.names);
    if (!ref) skips.add('stats.classes', `No class in the library is named "${String(c.name)}".`);
    return ref ? [{ ref }] : [];
  });
  const [amount = '1', unit = 'action'] = casting!.split(' ');
  const castingTime: SpellStats['castingTime'] = { amount: Number(amount), unit: unit as 'action' };
  if (typeof record.reaction_condition === 'string' && record.reaction_condition !== '') {
    castingTime.trigger = record.reaction_condition.replace(new RegExp(`^${TRIGGER}`), '');
  }
  const components: SpellStats['components'] = { v: record.verbal === true, s: record.somatic === true };
  if (record.material === true) {
    const m: NonNullable<SpellStats['components']['m']> = { text: String(record.material_specified ?? '') };
    if (record.material_cost !== null && record.material_cost !== undefined && Number(record.material_cost) > 0) m.costGp = Number(record.material_cost);
    if (record.material_consumed === true) m.consumed = true;
    components.m = m;
  }
  const stats: Record<string, unknown> = {
    level,
    school,
    classes,
    castingTime,
    ritual: record.ritual === true,
    range,
    components,
    duration,
    effect: String(record.desc ?? ''),
  };
  const higher = typeof record.higher_level === 'string' && record.higher_level !== '' ? record.higher_level : undefined;
  if (higher !== undefined) stats[level === 0 ? 'cantripUpgrade' : 'higherLevels'] = higher;
  return { ruleset: context.ruleset, type: 'spell', id: slug(name), name, stats };
}
