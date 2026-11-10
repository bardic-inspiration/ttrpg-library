// Text for the dnd-5e-2024 creature stat block in SRD 5.2 form (docs/rulesets.md#creatures),
// built from stored inputs and derived values. Styling arrives with the
// templates in milestone 3; this is the content. Optional fields display by
// presence alone (docs/content-model.md#situational-fields), through ./display.ts. Action bodies are
// markdown: stored text fields (`Text`, docs/content-model.md#text-fields) go in as written after
// tokens render, plain fields are escaped, and labels such as "Hit:" are
// italic. Templates render them through ./markdown.ts.

import { printMinus, signed } from '../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../rulesets/dnd-5e-2024/index.ts';
import { renderTokens } from '../../../rulesets/dnd-5e-2024/tokens.ts';
import { present, whenPresent } from './display.ts';
import { formatCr } from './format.ts';
import { escapeMarkdown } from './markdown.ts';
import { refOrTextName } from './refs.ts';
import { vocabularyName } from '../../../lib/wording/book.ts';
import { capitalize, concat, joinWith, link, list, name, phrases, pluralLink, pluralOf, say, sayMarkdown, sayText, titleCase, toMarkdown, toPlain, withNote } from './wording.ts';
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
  /** Markdown-subset text (docs/content-model.md#text-fields). */
  body: string;
}

/** An italic label such as "Hit:". */
const label = (text: string): string => `*${text}*`;

export { formatCr };

/** "Medium Humanoid (Wizard), Neutral", or a swarm's "Large Swarm of Tiny Beasts, Unaligned": the members' type in the plural ("Undead" stays). */
export const sizeTypeLine = (s: CreatureStats): string => {
  const type = name('creatureType', s.creatureType);
  const kind = whenPresent(s.swarm, (member) => sayText('creature.swarm', { size: name('size', member), types: pluralOf(type) })) ?? type;
  const sizes = list(s.size.map((size) => name('size', size)), 'or');
  return sayText('creature.typeLine', { sizes, kind: withNote(kind, whenPresent(s.descriptors, (d) => d.join(', '))), alignment: titleCase(s.alignment) });
};

export const acLine = (s: CreatureStats): string => whenPresent(s.ac.note, (note) => `${s.ac.value} (${note})`) ?? String(s.ac.value);

export const initiativeLine = (d: DerivedCreature): string => `${signed(d.initiative.bonus)} (${d.initiative.score})`;

export const hpLine = (d: DerivedCreature): string => `${d.hp.average} (${printMinus(d.hp.formula)})`;

/** Speed modes and senses print in this fixed order, whatever the entry's key order (docs/rulesets.md#creatures). */
const SPEED_ORDER = ['burrow', 'climb', 'fly', 'swim'] as const;
const SENSE_ORDER = ['blindsight', 'darkvision', 'tremorsense', 'truesight'] as const;

export function speedLine(s: CreatureStats): string {
  const { walk, hover, note } = s.speed;
  const parts = [`${walk} ft.`];
  for (const mode of SPEED_ORDER) {
    const feet = s.speed[mode];
    if (present(feet)) parts.push(`${name('speedMode', mode)} ${feet} ft.${mode === 'fly' && present(hover) ? ' (hover)' : ''}`);
  }
  // A speed the fields can't express, such as a form-limited one, as written (docs/rulesets.md#creatures).
  if (present(note)) parts.push(note);
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

/** The Skills line, or `undefined` when the creature has no `skills` (docs/content-model.md#situational-fields). */
export const skillsLine = (s: CreatureStats, d: DerivedCreature): string | undefined =>
  whenPresent(s.skills, () =>
    Object.entries(d.skills)
      .map(([skill, bonus]) => `${name('skill', skill)} ${signed(bonus)}`)
      .join(', '),
  );

/** Damage types by name, and a qualified entry as written, with its first letter in capitals. */
const damageList = (types: string[]): string => types.map((type) => vocabularyName(phrases, 'damageType', type) ?? capitalize(type)).join(', ');


/** Condition immunities as markdown: each a `{ref:…}` token, rendered as the condition's name linked to its anchor, with its note. */
const conditionList = (conditions: { ref: string; note?: string }[]): string => toMarkdown(joinWith(conditions.map((c) => withNote(link(c.ref), c.note)), ', '));

/**
 * The Gear line, markdown because its refs are links (docs/rulesets.md#creatures): a count reads as
 * the target's name in the plural with the count in parentheses ("Javelins (6)"), and a note in parentheses.
 */
export function gearLine(s: CreatureStats, names: Map<string, string> = new Map()): PropertyLine | undefined {
  const items = s.gear?.map((g) => {
    if (typeof g === 'string') return g;
    const counted = g.count === undefined ? link(g.ref) : concat(pluralLink(g.ref, names), ` (${g.count})`);
    return withNote(counted, g.note);
  });
  return items === undefined || items.length === 0 ? undefined : { label: 'Gear', value: toMarkdown(joinWith(items, ', ')), markdown: true };
}

/**
 * Vulnerabilities, Resistances, and Immunities, each only when present (docs/content-model.md#situational-fields).
 * The Immunities line is markdown, because its conditions are links (docs/rulesets.md#creatures).
 */
export function defenseLines(s: CreatureStats): PropertyLine[] {
  const immunities = whenPresent(s.immunities, (i) =>
    [whenPresent(i.damage, (d) => escapeMarkdown(damageList(d))), whenPresent(i.conditions, conditionList)].filter(present).join('; '),
  );
  const lines: (PropertyLine | { label: string; value: undefined })[] = [
    { label: 'Vulnerabilities', value: whenPresent(s.vulnerabilities, damageList) },
    { label: 'Resistances', value: whenPresent(s.resistances, damageList) },
    immunities === undefined ? { label: 'Immunities', value: undefined } : { label: 'Immunities', value: immunities, markdown: true },
  ];
  return lines.filter((line): line is PropertyLine => present(line.value));
}

export function sensesLine(s: CreatureStats, d: DerivedCreature): string {
  // Senses are comma-separated; Passive Perception follows a semicolon (docs/rulesets.md#creatures).
  const senses = SENSE_ORDER.flatMap((sense) => whenPresent(s.senses?.[sense], (feet) => [`${name('sense', sense)} ${feet} ft.`]) ?? []);
  const list = senses.join(', ') + (whenPresent(s.senses?.note, (note) => ` (${note})`) ?? '');
  return [list, sayText('creature.passivePerception', { score: String(d.passivePerception) })].filter(Boolean).join('; ');
}

export function languagesLine(s: CreatureStats): string {
  // `spoken` is required and may be empty; `understood` lists languages the
  // creature understands but can't speak. With neither, the line reads "None"
  // (docs/rulesets.md#creatures).
  const { spoken, understood } = s.languages;
  const parts = spoken.length ? [spoken.join(', ')] : [];
  if (understood?.length) {
    // With spoken languages, "but can't speak them" (or "it"); without, the clause starts the line.
    const key = spoken.length ? (understood.length > 1 ? 'creature.understandsThem' : 'creature.understandsIt') : 'creature.understands';
    const clause = sayText(key, { languages: list(understood, 'and') });
    parts.push(parts.length ? clause : capitalize(clause));
  }
  const telepathy = whenPresent(s.languages.telepathy, (feet) => sayText('creature.telepathy', { feet: String(feet) }));
  if (present(telepathy)) parts.push(telepathy);
  const line = parts.join('; ') || 'None';
  return whenPresent(s.languages.note, (note) => `${line} (${note})`) ?? line;
}

export function crLine(s: CreatureStats, d: DerivedCreature): string {
  const xp =
    d.xpInLair === undefined
      ? sayText('creature.xp', { xp: d.xp.toLocaleString('en-US') })
      : sayText('creature.xpInLair', { xp: d.xp.toLocaleString('en-US'), lair: d.xpInLair.toLocaleString('en-US') });
  return `${formatCr(s.cr)} (${xp}; PB ${signed(d.pb)})`;
}

function actionName(action: Action): string {
  const notes = [whenPresent(action.recharge, (r) => name('recharge', r)), whenPresent(action.uses, titleCase)].filter(present);
  return notes.length ? `${action.name} (${notes.join('; ')})` : action.name;
}

/**
 * The damage list: riders join with "plus", and a conditional rider takes a
 * comma before "plus" and its condition after (docs/rulesets.md#creatures): "5 (1d6 + 2)
 * Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage".
 */
function damageText(action: Action, derived: DerivedAction | undefined): string | undefined {
  return whenPresent(action.damage, (list) =>
    list
      .map((damage, i) => {
        const amount = whenPresent(derived?.damage[i]?.display, printMinus) ?? damage.dice ?? '';
        const text = present(damage.type)
          ? say('creature.damage', { amount, type: name('damageType', damage.type) })
          : say('creature.damageNote', { amount, note: damage.note ?? '' });
        if (i === 0) return toMarkdown(text);
        return whenPresent(damage.condition, (condition) => sayMarkdown('creature.conditionalRider', { damage: text, condition })) ?? sayMarkdown('creature.rider', { damage: text });
      })
      .join(''),
  );
}

const rangeText = (range: { normal: number; long?: number }): string =>
  sayText('creature.range', { range: `${range.normal}${whenPresent(range.long, (long) => `/${long}`) ?? ''}` });

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * The damage, then the prose after it (`onHit`, `onFailure`). Prose that
 * starts lowercase continues the damage sentence after a comma ("Cold damage,
 * and the target…"), prose that starts with a dash joins it directly
 * ("Piercing damage—or …"); otherwise the damage ends its sentence (docs/rulesets.md#creatures).
 */
function afterDamage(damage: string | undefined, prose: string | undefined): string {
  if (!present(damage)) return prose ?? '';
  if (!present(prose)) return sentence(damage);
  if (/^[a-z]/.test(prose)) return `${damage}, ${prose}`;
  // A dash continues the sentence with no punctuation: "Piercing damage—or …".
  if (/^[—–]/.test(prose)) return `${damage}${prose}`;
  return `${sentence(damage)} ${prose}`;
}

/** One action, trait, or reaction as SRD 5.2 prose. */
export function actionBlock(action: Action, derived: DerivedAction | undefined, d: DerivedCreature): ActionBlock {
  const prose = (text: string) => renderTokens(text, d, tables);
  const parts: string[] = [];
  if (action.kind === 'other') {
    parts.push(prose(action.text ?? ''));
  } else if (action.kind === 'save' && action.save) {
    parts.push(`${label(sayText('creature.saveLabel', { ability: name('ability', action.save.ability) }))} DC ${derived?.saveDc}, ${escapeMarkdown(action.save.targets)}.`);
    const damage = damageText(action, derived);
    const failure = afterDamage(damage, whenPresent(action.onFailure, prose));
    if (failure) parts.push(`${label('Failure:')} ${failure}`);
    if (present(action.onSuccess)) parts.push(`${label('Success:')} ${prose(action.onSuccess)}`);
    if (present(action.onFailureOrSuccess)) parts.push(`${label('Failure or Success:')} ${prose(action.onFailureOrSuccess)}`);
  } else {
    const reach = whenPresent(action.reach, (feet) => sayText('creature.reach', { feet: String(feet) }));
    const range = whenPresent(action.range, rangeText);
    const note = whenPresent(action.attackNote, (text) => ` (${escapeMarkdown(text)})`) ?? '';
    parts.push(`${label(vocabularyName(phrases, 'attackKind', action.kind) ?? '')} ${signed(derived?.attackBonus ?? 0)}${note}, ${toPlain(list([reach, range].filter(present), 'or'))}`);
    const damage = damageText(action, derived);
    const hit = afterDamage(damage, whenPresent(action.onHit, prose));
    parts.push(`${label('Hit:')} ${hit}`);
  }
  return { name: actionName(action), body: parts.join(' ') };
}

const refOrText = (value: RefOrText, names: Map<string, string>): string => escapeMarkdown(refOrTextName(value, names));

/**
 * The Legendary Actions paragraph before the actions (docs/rulesets.md#creatures): the
 * italic uses line, then the intro, as one paragraph: "*Legendary Action Uses:
 * 3 (4 in Lair).* Immediately after another creature's turn, …".
 */
export function legendaryIntro(legendary: NonNullable<CreatureStats['legendaryActions']>, d: DerivedCreature): string {
  const lair = whenPresent(legendary.usesInLair, (n) => sayText('creature.usesInLair', { uses: String(n) })) ?? '';
  const uses = label(sayText('creature.legendaryUses', { uses: String(legendary.uses), lair }));
  return whenPresent(legendary.intro, (intro) => `${uses} ${renderTokens(intro, d, tables)}`) ?? uses;
}

/** What generated prose calls the creature after "The": `shortName`, or the name's last word, lowercase (docs/rulesets.md#creatures). */
export const shortName = (s: CreatureStats, name: string): string =>
  s.shortName ?? (name.trim().split(/\s+/).at(-1) ?? name).toLowerCase();

/**
 * The 5.2 "Spellcasting" action (docs/rulesets.md#creatures). `name` is the entry's name,
 * and `names` maps `<type>/<id>` to entry names.
 */
export function spellcastingBlock(s: CreatureStats, d: DerivedCreature, names: Map<string, string>, entryName: string): ActionBlock | undefined {
  const sc = s.spellcasting;
  if (!sc || !d.spellcasting) return undefined;
  // The parenthetical holds the save DC (unless noSaveDc) and the attack bonus (with includeAttack), and is left out when empty (docs/content-model.md#situational-fields).
  const numbers = [
    ...(present(sc.noSaveDc) ? [] : [sayText('creature.spellSaveDc', { dc: String(d.spellcasting.dc) })]),
    ...(present(sc.includeAttack) ? [sayText('creature.spellAttack', { bonus: signed(d.spellcasting.attackBonus) })] : []),
  ];
  const parenthetical = numbers.length > 0 ? ` (${numbers.join(', ')})` : '';
  const components = whenPresent(sc.noComponents, (c) => say('creature.noComponents', { components: c })) ?? '';
  const parts = [
    sayMarkdown('creature.spellcasting', { name: shortName(s, entryName), components, ability: name('ability', sc.ability), numbers: parenthetical }),
  ];
  const spellList = (heading: string, spells: RefOrText[] | undefined) => {
    if (!present(spells)) return;
    parts.push(`${label(`${heading}:`)} ${spells.map((spell) => refOrText(spell, names)).join(', ')}`);
  };
  spellList('At Will', sc.atWill);
  // "Each" only when the level lists more than one spell: "1/Day: Fireball".
  for (const n of ['3', '2', '1'] as const) spellList(sayText((sc.perDay?.[n]?.length ?? 0) > 1 ? 'creature.perDayEach' : 'creature.perDay', { n }), sc.perDay?.[n]);
  if (present(sc.note)) parts.push(renderTokens(sc.note, d, tables));
  // Each list, and the note, starts a line of its own (a markdown hard break).
  return { name: 'Spellcasting', body: parts.join('\\\n') };
}
