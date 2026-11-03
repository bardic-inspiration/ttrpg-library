// Text for the dnd-5e-2024 creature stat block in SRD 5.2 form (SPEC.md §6.5),
// built from stored inputs and derived values. Styling arrives with the
// templates in milestone 3; this is the content. Optional fields display by
// presence alone (SPEC.md §5.8), through ./display.ts. Action bodies are
// markdown: stored text fields (`Text`, SPEC.md §5.5) go in as written after
// tokens render, plain fields are escaped, and labels such as "Hit:" are
// italic. Templates render them through ./markdown.ts.

import { printMinus, signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { renderTokens } from '../../../rulesets/dnd-5e-2024/tokens.ts';
import { present, whenPresent } from './display.ts';
import { formatCr } from './format.ts';
import { escapeMarkdown } from './markdown.ts';
import type { PropertyLine } from './template.ts';
import type {
  Action,
  CreatureStats,
  DerivedAction,
  DerivedCreature,
  RefOrText,
} from '../../../rulesets/dnd-5e-2024/types.ts';

export interface ActionBlock {
  /** Plain text. */
  name: string;
  /** Markdown-subset text (SPEC.md §5.5). */
  body: string;
}

/** An italic label such as "Hit:". */
const label = (text: string): string => `*${text}*`;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** Words title case leaves lowercase unless they come first (SPEC.md §6.5). */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'per', 'the', 'to', 'with']);

/**
 * Capitalizes each word but a minor one, splitting on spaces, hyphens, and
 * slashes: `4/day, or 5/day in lair` is `4/Day, or 5/Day in Lair`, and
 * `sleight-of-hand` is `Sleight of Hand`.
 */
const titleCase = (s: string): string =>
  s
    .split(/[\s-]+/)
    .map((word, i) => (i > 0 && MINOR_WORDS.has(word) ? word : word.split('/').map(capitalize).join('/')))
    .join(' ');

export { formatCr };

export const sizeTypeLine = (s: CreatureStats): string => {
  const descriptors = whenPresent(s.descriptors, (list) => ` (${list.join(', ')})`) ?? '';
  return `${s.size.map(capitalize).join(' or ')} ${capitalize(s.creatureType)}${descriptors}, ${titleCase(s.alignment)}`;
};

export const acLine = (s: CreatureStats): string => whenPresent(s.ac.note, (note) => `${s.ac.value} (${note})`) ?? String(s.ac.value);

export const initiativeLine = (d: DerivedCreature): string => `${signed(d.initiative.bonus)} (${d.initiative.score})`;

export const hpLine = (d: DerivedCreature): string => `${d.hp.average} (${printMinus(d.hp.formula)})`;

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
  // Senses are comma-separated; Passive Perception follows a semicolon (SPEC.md §6.5).
  const senses = Object.entries(s.senses ?? {}).map(([sense, feet]) => `${capitalize(sense)} ${feet} ft.`);
  return [senses.join(', '), `Passive Perception ${d.passivePerception}`].filter(Boolean).join('; ');
}

export function languagesLine(s: CreatureStats): string {
  // `spoken` is required and may be empty; `understood` lists languages the
  // creature understands but can't speak. With neither, the line reads "None"
  // (SPEC.md §6.5).
  const { spoken, understood } = s.languages;
  const parts = spoken.length ? [spoken.join(', ')] : [];
  if (understood?.length) {
    const object = spoken.length ? (understood.length > 1 ? ' them' : ' it') : '';
    const clause = `understands ${understood.join(', ')} but can't speak${object}`;
    parts.push(parts.length ? clause : capitalize(clause));
  }
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

/**
 * The damage list: riders join with "plus", and a conditional rider takes a
 * comma before "plus" and its condition after (SPEC.md §6.5): "5 (1d6 + 2)
 * Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage".
 */
function damageText(action: Action, derived: DerivedAction | undefined): string | undefined {
  return whenPresent(action.damage, (list) =>
    list
      .map((damage, i) => {
        const text = `${whenPresent(derived?.damage[i]?.display, printMinus) ?? damage.dice} ${capitalize(damage.type)} damage`;
        if (i === 0) return text;
        return whenPresent(damage.condition, (condition) => `, plus ${text} ${escapeMarkdown(condition)}`) ?? ` plus ${text}`;
      })
      .join(''),
  );
}

const ATTACK_LABEL: Record<string, string> = {
  'melee-attack': 'Melee Attack Roll:',
  'ranged-attack': 'Ranged Attack Roll:',
  'melee-or-ranged-attack': 'Melee or Ranged Attack Roll:',
};

const rangeText = (range: { normal: number; long?: number }): string =>
  `range ${range.normal}${whenPresent(range.long, (long) => `/${long}`) ?? ''} ft.`;

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * The damage, then the prose after it (`onHit`, `onFailure`). Prose that
 * starts lowercase continues the damage sentence after a comma ("Cold damage,
 * and the target…"); otherwise the damage ends its sentence (SPEC.md §6.5).
 */
function afterDamage(damage: string | undefined, prose: string | undefined): string {
  if (!present(damage)) return prose ?? '';
  if (!present(prose)) return sentence(damage);
  return /^[a-z]/.test(prose) ? `${damage}, ${prose}` : `${sentence(damage)} ${prose}`;
}

/** One action, trait, or reaction as SRD 5.2 prose. */
export function actionBlock(action: Action, derived: DerivedAction | undefined, d: DerivedCreature): ActionBlock {
  const prose = (text: string) => renderTokens(text, d, tables);
  const parts: string[] = [];
  if (action.kind === 'other') {
    parts.push(prose(action.text ?? ''));
  } else if (action.kind === 'save' && action.save) {
    parts.push(`${label(`${tables.abilityNames[action.save.ability]} Saving Throw:`)} DC ${derived?.saveDc}, ${escapeMarkdown(action.save.targets)}.`);
    const damage = damageText(action, derived);
    const failure = afterDamage(damage, whenPresent(action.onFailure, prose));
    if (failure) parts.push(`${label('Failure:')} ${failure}`);
    if (present(action.onSuccess)) parts.push(`${label('Success:')} ${prose(action.onSuccess)}`);
  } else {
    const reach = whenPresent(action.reach, (feet) => `reach ${feet} ft.`);
    const range = whenPresent(action.range, rangeText);
    const note = whenPresent(action.attackNote, (text) => ` (${escapeMarkdown(text)})`) ?? '';
    parts.push(`${label(ATTACK_LABEL[action.kind] ?? '')} ${signed(derived?.attackBonus ?? 0)}${note}, ${[reach, range].filter(present).join(' or ')}`);
    const damage = damageText(action, derived);
    const hit = afterDamage(damage, whenPresent(action.onHit, prose));
    parts.push(`${label('Hit:')} ${hit}`);
  }
  return { name: actionName(action), body: parts.join(' ') };
}

const refOrText = (value: RefOrText, names: Map<string, string>): string =>
  escapeMarkdown(typeof value === 'string' ? value : (names.get(value.ref) ?? value.ref));

/** What generated prose calls the creature after "The": `shortName`, or the name's last word, lowercase (SPEC.md §6.5). */
export const shortName = (s: CreatureStats, name: string): string =>
  s.shortName ?? (name.trim().split(/\s+/).at(-1) ?? name).toLowerCase();

/**
 * The 5.2 "Spellcasting" action (SPEC.md §6.5). `name` is the entry's name,
 * and `names` maps `<type>/<id>` to entry names.
 */
export function spellcastingBlock(s: CreatureStats, d: DerivedCreature, names: Map<string, string>, name: string): ActionBlock | undefined {
  const sc = s.spellcasting;
  if (!sc || !d.spellcasting) return undefined;
  const attack = present(sc.includeAttack) ? `, ${signed(d.spellcasting.attackBonus)} to hit with spell attacks` : '';
  const components = whenPresent(sc.noComponents, (c) => `requiring no ${escapeMarkdown(c)} components and `) ?? '';
  const parts = [
    `The ${escapeMarkdown(shortName(s, name))} casts one of the following spells, ${components}using ${tables.abilityNames[sc.ability]} as the spellcasting ability (spell save DC ${d.spellcasting.dc}${attack}):`,
  ];
  const list = (name: string, spells: RefOrText[] | undefined) => {
    if (!present(spells)) return;
    parts.push(`${label(`${name}:`)} ${spells.map((spell) => refOrText(spell, names)).join(', ')}`);
  };
  list('At Will', sc.atWill);
  // "Each" only when the level lists more than one spell: "1/Day: Fireball".
  for (const n of ['3', '2', '1'] as const) list(`${n}/Day${(sc.perDay?.[n]?.length ?? 0) > 1 ? ' Each' : ''}`, sc.perDay?.[n]);
  if (present(sc.note)) parts.push(renderTokens(sc.note, d, tables));
  // Each list, and the note, starts a line of its own (a markdown hard break).
  return { name: 'Spellcasting', body: parts.join('\\\n') };
}
