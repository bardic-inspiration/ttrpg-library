// Text for the dnd-5e-2024 creature stat block in SRD 5.2 form (SPEC.md §6.5),
// built from stored inputs and derived values. Styling arrives with the
// templates in milestone 3; this is the content.

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { renderTokens } from '../../../rulesets/dnd-5e-2024/tokens.ts';
import type {
  Action,
  CreatureStats,
  DerivedAction,
  DerivedCreature,
  RefOrText,
} from '../../../rulesets/dnd-5e-2024/types.ts';

/** A run of text, optionally emphasized. Templates render these; nothing is raw HTML. */
export interface Segment {
  text: string;
  em?: boolean;
}

export interface ActionBlock {
  name: string;
  body: Segment[];
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string): string => s.split(/[\s-]+/).map(capitalize).join(' ');

const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };
export const formatCr = (cr: number): string => FRACTIONS[cr] ?? String(cr);

export const sizeTypeLine = (s: CreatureStats): string => {
  const descriptors = s.descriptors?.length ? ` (${s.descriptors.join(', ')})` : '';
  return `${s.size.map(capitalize).join(' or ')} ${capitalize(s.creatureType)}${descriptors}, ${titleCase(s.alignment)}`;
};

export const acLine = (s: CreatureStats): string => (s.ac.note ? `${s.ac.value} (${s.ac.note})` : String(s.ac.value));

export const initiativeLine = (d: DerivedCreature): string => `${signed(d.initiative.bonus)} (${d.initiative.score})`;

export const hpLine = (d: DerivedCreature): string => `${d.hp.average} (${d.hp.formula})`;

export function speedLine(s: CreatureStats): string {
  const { walk, hover, ...others } = s.speed;
  const parts = [`${walk} ft.`];
  for (const [mode, feet] of Object.entries(others)) {
    parts.push(`${capitalize(mode)} ${feet} ft.${mode === 'fly' && hover ? ' (hover)' : ''}`);
  }
  return parts.join(', ');
}

export function abilityRows(s: CreatureStats, d: DerivedCreature) {
  return tables.abilities.map((ability) => ({
    ability: ability.toUpperCase(),
    score: s.abilities[ability],
    mod: signed(d.abilityMods[ability]),
    save: signed(d.saves[ability]),
  }));
}

export const skillsLine = (d: DerivedCreature): string =>
  Object.entries(d.skills)
    .map(([skill, bonus]) => `${titleCase(skill)} ${signed(bonus)}`)
    .join(', ');

const damageList = (list: string[] | undefined): string => (list ?? []).map(capitalize).join(', ');

export function defenseLines(s: CreatureStats): { label: string; value: string }[] {
  const lines = [
    { label: 'Vulnerabilities', value: damageList(s.vulnerabilities) },
    { label: 'Resistances', value: damageList(s.resistances) },
    {
      label: 'Immunities',
      value: [damageList(s.immunities?.damage), damageList(s.immunities?.conditions)].filter(Boolean).join('; '),
    },
  ];
  return lines.filter((line) => line.value);
}

export function sensesLine(s: CreatureStats, d: DerivedCreature): string {
  const senses = Object.entries(s.senses ?? {}).map(([sense, feet]) => `${capitalize(sense)} ${feet} ft.`);
  return [...senses, `Passive Perception ${d.passivePerception}`].join(', ');
}

export function languagesLine(s: CreatureStats): string {
  const parts = s.languages.list.length ? [s.languages.list.join(', ')] : [];
  if (s.languages.telepathy) parts.push(`telepathy ${s.languages.telepathy} ft.`);
  const line = parts.join('; ') || 'None';
  return s.languages.note ? `${line} (${s.languages.note})` : line;
}

export function crLine(s: CreatureStats, d: DerivedCreature): string {
  const xp = d.xpInLair === undefined ? `XP ${d.xp.toLocaleString('en-US')}` : `XP ${d.xp.toLocaleString('en-US')}, or ${d.xpInLair.toLocaleString('en-US')} in lair`;
  return `${formatCr(s.cr)} (${xp}; PB ${signed(d.pb)})`;
}

const RECHARGE: Record<string, string> = {
  '5-6': 'Recharge 5–6',
  '6': 'Recharge 6',
  'short-or-long-rest': 'Recharges after a Short or Long Rest',
  'long-rest': 'Recharges after a Long Rest',
};

function actionName(action: Action): string {
  const notes = [action.recharge ? RECHARGE[action.recharge] : undefined, action.uses ? titleCase(action.uses) : undefined].filter(Boolean);
  return notes.length ? `${action.name} (${notes.join('; ')})` : action.name;
}

function damageText(action: Action, derived: DerivedAction | undefined): string {
  return (action.damage ?? [])
    .map((damage, i) => `${derived?.damage[i]?.display ?? damage.dice} ${capitalize(damage.type)} damage`)
    .join(' plus ');
}

const ATTACK_LABEL: Record<string, string> = {
  'melee-attack': 'Melee Attack Roll:',
  'ranged-attack': 'Ranged Attack Roll:',
  'melee-or-ranged-attack': 'Melee or Ranged Attack Roll:',
};

const rangeText = (range: { normal: number; long?: number }): string =>
  `range ${range.normal}${range.long ? `/${range.long}` : ''} ft.`;

/** One action, trait, or reaction as SRD 5.2 prose. */
export function actionBlock(action: Action, derived: DerivedAction | undefined, d: DerivedCreature): ActionBlock {
  const prose = (text: string) => renderTokens(text, d, tables);
  const body: Segment[] = [];
  const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
  if (action.kind === 'other') {
    body.push({ text: prose(action.text ?? '') });
  } else if (action.kind === 'save' && action.save) {
    body.push({ text: `${tables.abilityNames[action.save.ability]} Saving Throw:`, em: true });
    body.push({ text: ` DC ${derived?.saveDc}, ${action.save.targets}. ` });
    const damage = damageText(action, derived);
    const failure = [damage ? `${damage}.` : '', action.onFailure ? prose(action.onFailure) : ''].filter(Boolean).join(' ');
    if (failure) body.push({ text: 'Failure:', em: true }, { text: ` ${failure}` });
    if (action.onSuccess) body.push({ text: ' ' }, { text: 'Success:', em: true }, { text: ` ${prose(action.onSuccess)}` });
  } else {
    const reach = action.reach ? `reach ${action.reach} ft.` : '';
    const range = action.range ? rangeText(action.range) : '';
    body.push({ text: ATTACK_LABEL[action.kind] ?? '', em: true });
    body.push({ text: ` ${signed(derived?.attackBonus ?? 0)}, ${[reach, range].filter(Boolean).join(' or ')} ` });
    const damage = damageText(action, derived);
    const hit = [damage ? sentence(damage) : '', action.onHit ? prose(action.onHit) : ''].filter(Boolean).join(' ');
    body.push({ text: 'Hit:', em: true }, { text: ` ${hit}` });
  }
  return { name: actionName(action), body };
}

const refOrText = (value: RefOrText, names: Map<string, string>): string =>
  typeof value === 'string' ? value : (names.get(value.ref) ?? value.ref);

/** The 5.2 "Spellcasting" action (SPEC.md §6.5). `names` maps `<type>/<id>` to entry names. */
export function spellcastingBlock(s: CreatureStats, d: DerivedCreature, names: Map<string, string>): ActionBlock | undefined {
  const sc = s.spellcasting;
  if (!sc || !d.spellcasting) return undefined;
  const attack = sc.includeAttack ? `, ${signed(d.spellcasting.attackBonus)} to hit with spell attacks` : '';
  const body: Segment[] = [
    { text: `The creature casts one of the following spells, using ${tables.abilityNames[sc.ability]} as the spellcasting ability (spell save DC ${d.spellcasting.dc}${attack}):` },
  ];
  const list = (label: string, spells: RefOrText[] | undefined) => {
    if (!spells?.length) return;
    body.push({ text: ' ' }, { text: `${label}:`, em: true }, { text: ` ${spells.map((spell) => refOrText(spell, names)).join(', ')}` });
  };
  list('At Will', sc.atWill);
  for (const n of ['3', '2', '1'] as const) list(`${n}/Day Each`, sc.perDay?.[n]);
  if (sc.note) body.push({ text: ` ${renderTokens(sc.note, d, tables)}` });
  return { name: 'Spellcasting', body };
}
