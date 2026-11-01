// Text for the dnd-5e-2024 creature stat block in SRD 5.2 form (SPEC.md §6.5),
// built from stored inputs and derived values. Styling arrives with the
// templates in milestone 3; this is the content. Optional fields display by
// presence alone (SPEC.md §5.8), through ./display.ts.

import { signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { renderTokens } from '../../../rulesets/dnd-5e-2024/tokens.ts';
import { present, whenPresent } from './display.ts';
import { formatCr } from './format.ts';
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

export { formatCr };

export const sizeTypeLine = (s: CreatureStats): string => {
  const descriptors = whenPresent(s.descriptors, (list) => ` (${list.join(', ')})`) ?? '';
  return `${s.size.map(capitalize).join(' or ')} ${capitalize(s.creatureType)}${descriptors}, ${titleCase(s.alignment)}`;
};

export const acLine = (s: CreatureStats): string => whenPresent(s.ac.note, (note) => `${s.ac.value} (${note})`) ?? String(s.ac.value);

export const initiativeLine = (d: DerivedCreature): string => `${signed(d.initiative.bonus)} (${d.initiative.score})`;

export const hpLine = (d: DerivedCreature): string => `${d.hp.average} (${d.hp.formula})`;

export function speedLine(s: CreatureStats): string {
  const { walk, hover, ...others } = s.speed;
  const parts = [`${walk} ft.`];
  for (const [mode, feet] of Object.entries(others)) {
    parts.push(`${capitalize(mode)} ${feet} ft.${mode === 'fly' && present(hover) ? ' (hover)' : ''}`);
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

/** The Skills line, or `undefined` when the creature has no `skills` (SPEC.md §5.8). */
export const skillsLine = (s: CreatureStats, d: DerivedCreature): string | undefined =>
  whenPresent(s.skills, () =>
    Object.entries(d.skills)
      .map(([skill, bonus]) => `${titleCase(skill)} ${signed(bonus)}`)
      .join(', '),
  );

const damageList = (list: string[]): string => list.map(capitalize).join(', ');

/** A labeled stat-block line. */
export interface PropertyLine {
  label: string;
  value: string;
}

/** Vulnerabilities, Resistances, and Immunities, each only when present (SPEC.md §5.8). */
export function defenseLines(s: CreatureStats): PropertyLine[] {
  const immunities = whenPresent(s.immunities, (i) =>
    [whenPresent(i.damage, damageList), whenPresent(i.conditions, damageList)].filter(present).join('; '),
  );
  const lines = [
    { label: 'Vulnerabilities', value: whenPresent(s.vulnerabilities, damageList) },
    { label: 'Resistances', value: whenPresent(s.resistances, damageList) },
    { label: 'Immunities', value: immunities },
  ];
  return lines.filter((line): line is PropertyLine => present(line.value));
}

export function sensesLine(s: CreatureStats, d: DerivedCreature): string {
  const senses = Object.entries(s.senses ?? {}).map(([sense, feet]) => `${capitalize(sense)} ${feet} ft.`);
  return [...senses, `Passive Perception ${d.passivePerception}`].join(', ');
}

export function languagesLine(s: CreatureStats): string {
  // `list` is required and may be empty; an empty list reads "None" (SPEC.md §6.5).
  const parts = s.languages.list.length ? [s.languages.list.join(', ')] : [];
  const telepathy = whenPresent(s.languages.telepathy, (feet) => `telepathy ${feet} ft.`);
  if (present(telepathy)) parts.push(telepathy);
  const line = parts.join('; ') || 'None';
  return whenPresent(s.languages.note, (note) => `${line} (${note})`) ?? line;
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
  const notes = [whenPresent(action.recharge, (r) => RECHARGE[r]), whenPresent(action.uses, titleCase)].filter(present);
  return notes.length ? `${action.name} (${notes.join('; ')})` : action.name;
}

function damageText(action: Action, derived: DerivedAction | undefined): string | undefined {
  return whenPresent(action.damage, (list) =>
    list.map((damage, i) => `${derived?.damage[i]?.display ?? damage.dice} ${capitalize(damage.type)} damage`).join(' plus '),
  );
}

const ATTACK_LABEL: Record<string, string> = {
  'melee-attack': 'Melee Attack Roll:',
  'ranged-attack': 'Ranged Attack Roll:',
  'melee-or-ranged-attack': 'Melee or Ranged Attack Roll:',
};

const rangeText = (range: { normal: number; long?: number }): string =>
  `range ${range.normal}${whenPresent(range.long, (long) => `/${long}`) ?? ''} ft.`;

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
    const failure = [whenPresent(damage, (text) => `${text}.`), whenPresent(action.onFailure, prose)].filter(present).join(' ');
    if (failure) body.push({ text: 'Failure:', em: true }, { text: ` ${failure}` });
    if (present(action.onSuccess)) body.push({ text: ' ' }, { text: 'Success:', em: true }, { text: ` ${prose(action.onSuccess)}` });
  } else {
    const reach = whenPresent(action.reach, (feet) => `reach ${feet} ft.`);
    const range = whenPresent(action.range, rangeText);
    body.push({ text: ATTACK_LABEL[action.kind] ?? '', em: true });
    body.push({ text: ` ${signed(derived?.attackBonus ?? 0)}, ${[reach, range].filter(present).join(' or ')} ` });
    const damage = damageText(action, derived);
    const hit = [whenPresent(damage, sentence), whenPresent(action.onHit, prose)].filter(present).join(' ');
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
  const attack = present(sc.includeAttack) ? `, ${signed(d.spellcasting.attackBonus)} to hit with spell attacks` : '';
  const body: Segment[] = [
    { text: `The creature casts one of the following spells, using ${tables.abilityNames[sc.ability]} as the spellcasting ability (spell save DC ${d.spellcasting.dc}${attack}):` },
  ];
  const list = (label: string, spells: RefOrText[] | undefined) => {
    if (!present(spells)) return;
    body.push({ text: ' ' }, { text: `${label}:`, em: true }, { text: ` ${spells.map((spell) => refOrText(spell, names)).join(', ')}` });
  };
  list('At Will', sc.atWill);
  for (const n of ['3', '2', '1'] as const) list(`${n}/Day Each`, sc.perDay?.[n]);
  if (present(sc.note)) body.push({ text: ` ${renderTokens(sc.note, d, tables)}` });
  return { name: 'Spellcasting', body };
}
