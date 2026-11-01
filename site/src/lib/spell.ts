// Text for the dnd-5e-2024 spell card in SRD 5.2 form (SPEC.md §6.7, §9.5).
// Spells have no derived values; every number here is authored and only
// formatted. Optional fields display by presence alone (SPEC.md §5.8).

import { whenPresent } from './display.ts';
import type { SpellStats } from '../../../rulesets/dnd-5e-2024/types.ts';

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string): string => s.split(/[\s-]+/).map(capitalize).join(' ');
const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "Level 1 Evocation (Sorcerer, Wizard)", or "Evocation Cantrip (…)" at level 0. */
export function levelLine(s: SpellStats): string {
  const school = capitalize(s.school);
  const head = s.level === 0 ? `${school} Cantrip` : `Level ${s.level} ${school}`;
  return `${head} (${s.classes.map(capitalize).join(', ')})`;
}

const ACTION_UNITS: Record<string, string> = { action: 'Action', 'bonus-action': 'Bonus Action', reaction: 'Reaction' };

/** "Action", "Reaction, which you take when …", "10 minutes", with " or Ritual" when `ritual` is true. */
export function castingTimeLine(s: SpellStats): string {
  const { amount, unit, trigger } = s.castingTime;
  const action = ACTION_UNITS[unit];
  let line = action ? (amount === 1 ? action : `${amount} ${action}s`) : plural(amount, unit);
  line += whenPresent(trigger, (t) => `, which you take ${t}`) ?? '';
  return s.ritual ? `${line} or Ritual` : line;
}

const RANGE_KINDS: Record<string, string> = { self: 'Self', touch: 'Touch', sight: 'Sight', unlimited: 'Unlimited', special: 'Special' };

/** "60 feet", "Self (15-foot Cone)". */
export function rangeLine(s: SpellStats): string {
  const { kind, feet, area } = s.range;
  const base = kind === 'distance' ? `${feet} feet` : (RANGE_KINDS[kind] ?? capitalize(kind));
  return base + (whenPresent(area, (a) => ` (${a.size}-foot ${capitalize(a.shape)})`) ?? '');
}

/** "V, S, M (a sliver of ice)"; a consumed material says so. */
export function componentsLine(s: SpellStats): string {
  const { v, s: somatic, m } = s.components;
  const parts = [v && 'V', somatic && 'S'].filter((p): p is string => Boolean(p));
  const material = whenPresent(m, (mat) => `M (${mat.text}${mat.consumed ? ', which the spell consumes' : ''})`);
  if (material) parts.push(material);
  return parts.join(', ') || 'None';
}

const DURATION_KINDS: Record<string, string> = { instantaneous: 'Instantaneous', 'until-dispelled': 'Until dispelled', special: 'Special' };

/** "Instantaneous", "1 hour", "Concentration, up to 1 minute". */
export function durationLine(s: SpellStats): string {
  const { kind, amount, unit, concentration } = s.duration;
  if (kind !== 'timed') return DURATION_KINDS[kind] ?? titleCase(kind);
  const span = plural(amount ?? 0, unit ?? '');
  return concentration ? `Concentration, up to ${span}` : span;
}
