// Creatures to and from Open5e's Creature record (docs/export.md#open5e). Export fills Open5e's
// numbers from `derived` and writes each trait and action as its SRD 5.2 stat block text; import
// reads that text back into structured actions where its numbers match what the ruleset derives
// from the imported inputs.

import { attackBonus, crRow, deriveAction, diceAverage, saveDc, signed } from '../../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../../rulesets/dnd-5e-2024/index.ts';
import { renderTokens } from '../../../../rulesets/dnd-5e-2024/tokens.ts';
import type {
  Ability,
  Action,
  ActionKind,
  CreatureStats,
  Damage,
  DerivedAction,
  DerivedCreature,
  Proficiency,
  Ref,
  RefOrText,
  Size,
} from '../../../../rulesets/dnd-5e-2024/types.ts';
import { ACTION_LISTS } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { actionBlock, languagesLine, shortName, spellcastingBlock } from '../../lib/creature.ts';
import { name as word, phrases, titleCase } from '../../lib/wording.ts';
import type { ImportContext, ImportedEntry, TranslatorItem } from '../types.ts';
import { DOCUMENT, keyOf, summary, type Record5e } from './document.ts';
import {
  abilityFor,
  basisOf,
  PREFER,
  plainRefs,
  reportRefs,
  resolveName,
  signedNumber,
  Skips,
  slug,
  tokenizeCreatureText,
  unescapeMarkdown,
  type CreatureBasis,
} from './text.ts';

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};
const SKILL_KEY = (skill: string): string => skill.replace(/-/g, '_');
const SENSES = ['blindsight', 'darkvision', 'tremorsense', 'truesight'] as const;
const SPEEDS = ['fly', 'swim', 'climb', 'burrow'] as const;

type ListName = (typeof ACTION_LISTS)[number] | 'legendary';
const ACTION_TYPE: Record<Exclude<ListName, 'traits'>, string> = {
  actions: 'ACTION',
  bonusActions: 'BONUS_ACTION',
  reactions: 'REACTION',
  legendary: 'LEGENDARY_ACTION',
};

const vocabularyKey = (vocabulary: string, display: string): string | undefined =>
  Object.entries(phrases.vocabulary[vocabulary] ?? {}).find(([, v]) => v === display)?.[0];

const DAMAGE_TYPE = new Map(tables.damageTypes.map((t) => [t.charAt(0).toUpperCase() + t.slice(1), t]));
const DAMAGE_ALT = [...DAMAGE_TYPE.keys()].join('|');

const basisFrom = (d: DerivedCreature): CreatureBasis => ({ mods: d.abilityMods, pb: d.pb });

// ---------------------------------------------------------------- export

/** What import would read a damage roll's modifier as: no ability at 0, the action's ability when its modifier matches, or the one ability that has it. */
export function damageAbility(modifier: number, actionAbility: Ability | undefined, basis: CreatureBasis): Ability | undefined | null {
  if (modifier === 0) return undefined;
  if (actionAbility && basis.mods[actionAbility] === modifier) return actionAbility;
  return abilityFor(modifier, (a) => basis.mods[a], PREFER.melee) ?? null;
}

const preferFor = (kind: ActionKind): Ability[] => (kind === 'save' ? PREFER.save : kind === 'ranged-attack' ? PREFER.ranged : PREFER.melee);

/** The ability import reads from an attack bonus or a save DC. */
const actionAbilityFor = (kind: ActionKind, value: number, basis: CreatureBasis): Ability | undefined =>
  kind === 'save'
    ? abilityFor(value, (a) => saveDc(basis.pb, basis.mods[a]), PREFER.save)
    : abilityFor(value, (a) => attackBonus(basis.pb, basis.mods[a]), preferFor(kind));

const PROSE = ['text', 'onHit', 'onFailure', 'onSuccess', 'onFailureOrSuccess'] as const;

/** Reports what in one prose field won't come back: its links, and numbers that tokenize differently. */
function reportProse(text: string | undefined, item: TranslatorItem, d: DerivedCreature, skips: Skips, path: string): void {
  if (text === undefined) return;
  reportRefs(text, item.names, skips, path);
  const rendered = renderTokens(text, d, tables);
  const back = tokenizeCreatureText(rendered, basisFrom(d), new Skips([], ''), path);
  if (back !== text) skips.add(path, 'Its numbers print as plain values, and some read back as different tokens.');
}

/** Reports the parts of one action that Open5e's text can't carry back. */
function reportAction(action: Action, derived: DerivedAction | undefined, item: TranslatorItem, d: DerivedCreature, skips: Skips, path: string): void {
  const basis = basisFrom(d);
  for (const field of PROSE) reportProse(action[field], item, d, skips, `${path}.${field}`);
  if (action.save) reportRefs(action.save.targets, item.names, skips, `${path}.save.targets`);
  if (action.attackNote) reportRefs(action.attackNote, item.names, skips, `${path}.attackNote`);
  if (action.adjust !== undefined) skips.add(path, 'Open5e keeps only the resulting number, not the adjustment, so the action reads back as text.');
  else if (action.kind !== 'other' && action.ability) {
    const value = action.kind === 'save' ? derived?.saveDc : derived?.attackBonus;
    const read = actionAbilityFor(action.kind, value ?? NaN, basis);
    if (read !== action.ability) skips.add(`${path}.ability`, `Its number derives from ${read} too, which is what reads back.`);
  }
  if (action.uses !== undefined && titleCase(action.uses).toLowerCase() !== action.uses) {
    skips.add(`${path}.uses`, 'Its capitals print in title case and read back lowercase.');
  }
  if (action.uses !== undefined && !/^\d+\/day/i.test(action.uses)) skips.add(`${path}.uses`, 'Uses that aren\'t "N/Day" read back as part of the name.');
  const lead = action.kind === 'save' ? 'onFailure' : 'onHit';
  if (action.kind !== 'other' && action.damage === undefined && new RegExp(`^(\\{dmg:|\\d+ (${DAMAGE_ALT}) damage)`).test(action[lead] ?? '')) {
    skips.add(path, `Damage written at the start of its ${lead} text reads back as the action's damage.`);
  }
  (action.damage ?? []).forEach((damage, i) => {
    const at = `${path}.damage[${i}]`;
    if (damage.type === undefined) return skips.add(path, 'Damage without a fixed type can\'t be read back, so the action reads back as text.');
    if (damage.dice === undefined) return;
    if (damage.bonus !== undefined) return skips.add(path, 'Open5e keeps only the total damage modifier, so the action reads back as text.');
    const modifier = derived?.damage[i]?.modifier ?? 0;
    const actionAbility = action.kind === 'other' ? undefined : action.ability;
    const read = damageAbility(modifier, actionAbility ? actionAbilityFor(action.kind, (action.kind === 'save' ? derived?.saveDc : derived?.attackBonus) ?? NaN, basis) : undefined, basis);
    if (read !== damage.ability) skips.add(`${at}.ability`, 'Its modifier derives from another ability too, which is what reads back.');
  });
}

function attackOf(action: Action, derived: DerivedAction | undefined): Record5e[] {
  if (!['melee-attack', 'ranged-attack', 'melee-or-ranged-attack'].includes(action.kind)) return [];
  const bonus = derived?.attackBonus ?? 0;
  const [first, second] = (action.damage ?? []).map((damage, i) => ({ damage, derived: derived?.damage[i] }));
  const dice = (d: Damage | undefined) => /^(\d+)d(\d+)$/.exec(d?.dice ?? '');
  const typeOf = (d: Damage | undefined) => (d?.type ? summary(d.type, word('damageType', d.type)) : null);
  const inRange = (n: number | undefined) => (n === undefined || n < -5 || n > 20 ? null : n);
  if (bonus < -5 || bonus > 20) return [];
  return [
    {
      name: `${action.name} attack`,
      attack_type: 'WEAPON',
      to_hit_mod: bonus,
      reach: action.reach ?? null,
      range: action.range?.normal ?? null,
      long_range: action.range?.long ?? null,
      target_creature_only: false,
      damage_die_count: dice(first?.damage) ? Number(dice(first?.damage)![1]) : null,
      damage_die_type: dice(first?.damage) ? `D${dice(first?.damage)![2]}` : null,
      damage_bonus: inRange(first?.derived?.modifier),
      damage_type: typeOf(first?.damage),
      extra_damage_die_count: dice(second?.damage) ? Number(dice(second?.damage)![1]) : null,
      extra_damage_die_type: dice(second?.damage) ? `D${dice(second?.damage)![2]}` : null,
      extra_damage_bonus: inRange(second?.derived?.modifier),
      extra_damage_type: typeOf(second?.damage),
      distance_unit: 'feet',
    },
  ];
}

export function exportCreature(item: TranslatorItem, skips: Skips): Record5e {
  const s = item.entry.stats as CreatureStats;
  const d = item.derived as unknown as DerivedCreature;
  const names = new Map(Object.entries(item.names));

  const dropped: [keyof CreatureStats, string][] = [
    ['shortName', 'Open5e has no field for it, and only a Spellcasting action\'s text carries it.'],
    ['swarm', 'Open5e has no field for a swarm.'],
    ['descriptors', 'Open5e has no field for type descriptors.'],
    ['gear', 'Open5e has no field for gear.'],
    ['lair', 'Open5e has no field for a lair, or the XP in one.'],
  ];
  for (const [key, reason] of dropped) if (s[key] !== undefined && !(key === 'shortName' && s.spellcasting)) skips.add(`stats.${key}`, reason);
  if (s.size.length > 1) skips.add('stats.size', `Open5e takes one size; ${s.size.slice(1).join(', ')} is dropped.`);
  if (s.ac.note !== undefined && s.ac.note.length > 64) skips.add('stats.ac.note', 'Open5e\'s armor detail holds 64 characters.');
  if (s.initiative?.adjust !== undefined) skips.add('stats.initiative.adjust', 'Open5e keeps only the resulting number, not the adjustment.');
  if (s.speed.note !== undefined) skips.add('stats.speed.note', 'Open5e has no field for a speed note.');
  if (s.senses?.note !== undefined) skips.add('stats.senses.note', 'Open5e has no field for a senses note.');
  const lastLanguage = [...s.languages.spoken, ...(s.languages.understood ?? [])].at(-1) ?? '';
  if (s.languages.note === undefined && s.languages.telepathy === undefined && /\)$/.test(lastLanguage)) {
    skips.add('stats.languages', 'A language ending in parentheses reads back as the languages\' note.');
  }
  for (const [skill, value] of Object.entries(s.skills ?? {})) {
    if (typeof value !== 'string') skips.add(`stats.skills.${skill}`, 'Open5e keeps only the resulting bonus, not the adjustment.');
  }
  const damageLists = { vulnerabilities: s.vulnerabilities, resistances: s.resistances, 'immunities.damage': s.immunities?.damage };
  for (const [list, values] of Object.entries(damageLists)) {
    (values ?? []).forEach((value, i) => {
      if (!tables.damageTypes.includes(value)) skips.add(`stats.${list}[${i}]`, `"${value}" isn't one of Open5e's damage types.`);
    });
  }
  (s.immunities?.conditions ?? []).forEach((c, i) => {
    if (c.note !== undefined) skips.add(`stats.immunities.conditions[${i}].note`, 'Open5e has no field for a note on a condition immunity.');
  });
  const legendary = s.legendaryActions;
  if (legendary) {
    skips.add('stats.legendaryActions.uses', 'Open5e has no field for legendary action uses, so the legendary actions don\'t read back.');
    if (legendary.usesInLair !== undefined) skips.add('stats.legendaryActions.usesInLair', 'Open5e has no field for legendary action uses in a lair.');
    if (legendary.intro !== undefined) skips.add('stats.legendaryActions.intro', 'Open5e has no field for the legendary actions\' introduction.');
  }

  const block = (action: Action, derived: DerivedAction | undefined, path: string) => {
    reportAction(action, derived, item, d, skips, path);
    const { name, body } = actionBlock(action, derived, d);
    return { name, desc: plainRefs(body, item.names) };
  };
  const traits = (s.traits ?? []).map((t, i) => block(t, d.traits[i], `stats.traits[${i}]`));
  const actions: Record5e[] = [];
  const pushList = (list: Exclude<ListName, 'traits'>, items: Action[], derived: DerivedAction[], path: string) =>
    items.forEach((action, i) =>
      actions.push({
        ...block(action, derived[i], `${path}[${i}]`),
        crossreferences: { to: [] },
        attacks: attackOf(action, derived[i]),
        action_type: ACTION_TYPE[list],
        order_in_statblock: i,
        legendary_action_cost: list === 'legendary' ? 1 : null,
        limited_to_form: null,
        usage_limits: null,
      }),
    );
  pushList('actions', s.actions ?? [], d.actions, 'stats.actions');
  const spellcasting = spellcastingBlock(s, d, names, item.entry.name);
  if (spellcasting && s.spellcasting) {
    const sc = s.spellcasting;
    if (sc.adjust !== undefined) skips.add('stats.spellcasting.adjust', 'Open5e keeps only the resulting numbers, not the adjustment.');
    if (sc.note !== undefined) reportProse(sc.note, item, d, skips, 'stats.spellcasting.note');
    actions.push({
      name: spellcasting.name,
      desc: plainRefs(spellcasting.body, item.names),
      crossreferences: { to: [] },
      attacks: [],
      action_type: 'ACTION',
      order_in_statblock: (s.actions ?? []).length,
      legendary_action_cost: null,
      limited_to_form: null,
      usage_limits: null,
    });
  }
  pushList('bonusActions', s.bonusActions ?? [], d.bonusActions, 'stats.bonusActions');
  pushList('reactions', s.reactions ?? [], d.reactions, 'stats.reactions');
  pushList('legendary', legendary?.items ?? [], d.legendaryActions.items, 'stats.legendaryActions.items');

  const damage = (values: string[] | undefined) => (values ?? []).filter((v) => tables.damageTypes.includes(v));
  const damageSummaries = (values: string[] | undefined) => damage(values).map((v) => summary(v, word('damageType', v)));
  const display = (values: string[] | undefined) => damage(values).join(', ');
  const conditions = (s.immunities?.conditions ?? []).map((c) => summary(keyOf(c.ref), names.get(c.ref) ?? c.ref));
  const allSkills = Object.fromEntries(
    Object.entries(tables.skills).map(([skill, ability]) => [SKILL_KEY(skill), d.skills[skill] ?? d.abilityMods[ability]]),
  );
  const speed: Record5e = { unit: 'feet', walk: s.speed.walk };
  for (const mode of SPEEDS) if (s.speed[mode] !== undefined) speed[mode] = s.speed[mode];
  if (s.speed.hover) speed.hover = true;
  const firstSize = s.size[0] as Size;

  return {
    key: keyOf(`creature/${item.entry.id}`),
    name: item.entry.name,
    document: DOCUMENT,
    type: summary(s.creatureType, word('creatureType', s.creatureType)),
    size: summary(firstSize, word('size', firstSize)),
    challenge_rating: s.cr,
    proficiency_bonus: d.pb,
    speed,
    speed_all: {
      unit: 'feet',
      walk: s.speed.walk,
      crawl: 0,
      hover: s.speed.hover === true,
      fly: s.speed.fly ?? 0,
      burrow: s.speed.burrow ?? 0,
      climb: s.speed.climb ?? 0,
      swim: s.speed.swim ?? 0,
    },
    category: 'Monsters',
    subcategory: null,
    alignment: s.alignment,
    languages: { as_string: languagesLine(s), data: [] },
    armor_class: s.ac.value,
    armor_detail: s.ac.note !== undefined && s.ac.note.length <= 64 ? s.ac.note : null,
    hit_points: d.hp.average,
    hit_dice: d.hp.formula,
    experience_points: d.xp,
    ability_scores: Object.fromEntries(tables.abilities.map((a) => [ABILITY_NAMES[a], s.abilities[a]])),
    modifiers: Object.fromEntries(tables.abilities.map((a) => [ABILITY_NAMES[a], d.abilityMods[a]])),
    initiative_bonus: d.initiative.bonus,
    saving_throws: Object.fromEntries(tables.abilities.map((a) => [ABILITY_NAMES[a], d.saves[a]])),
    saving_throws_all: Object.fromEntries(tables.abilities.map((a) => [ABILITY_NAMES[a], d.saves[a]])),
    skill_bonuses: Object.fromEntries(Object.entries(d.skills).map(([skill, bonus]) => [SKILL_KEY(skill), bonus])),
    skill_bonuses_all: allSkills,
    passive_perception: d.passivePerception,
    resistances_and_immunities: {
      damage_immunities_display: display(s.immunities?.damage),
      damage_immunities: damageSummaries(s.immunities?.damage),
      damage_resistances_display: display(s.resistances),
      damage_resistances: damageSummaries(s.resistances),
      damage_vulnerabilities_display: display(s.vulnerabilities),
      damage_vulnerabilities: damageSummaries(s.vulnerabilities),
      condition_immunities_display: conditions.map((c) => String(c.name).toLowerCase()).join(', '),
      condition_immunities: conditions,
    },
    normal_sight_range: null,
    darkvision_range: s.senses?.darkvision ?? null,
    blindsight_range: s.senses?.blindsight ?? null,
    tremorsense_range: s.senses?.tremorsense ?? null,
    truesight_range: s.senses?.truesight ?? null,
    actions,
    traits,
    creaturesets: [],
    environments: [],
    illustration: null,
    crossreferences: { to: [] },
  };
}

// ---------------------------------------------------------------- import

const num = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const keyName = (value: unknown): { key?: string; name?: string } =>
  value && typeof value === 'object' ? (value as { key?: string; name?: string }) : {};
const proficiencyFor = (extra: number, pb: number): Proficiency | undefined | null =>
  extra === 0 ? undefined : extra === pb ? 'proficient' : extra === 2 * pb ? 'expertise' : null;

/** "Bite (Recharge 5–6; 3/Day)" → the name and its recharge and uses. */
function nameNotes(raw: string): { name: string; recharge?: string; uses?: string } {
  const match = /^(.*) \(([^()]+)\)$/.exec(raw);
  if (!match) return { name: raw };
  const result: { name: string; recharge?: string; uses?: string } = { name: match[1] ?? raw };
  for (const note of (match[2] ?? '').split('; ')) {
    const recharge = vocabularyKey('recharge', note);
    if (recharge) result.recharge = recharge;
    else if (/^\d+\/day/i.test(note)) result.uses = note.toLowerCase();
    else return { name: raw };
  }
  return result;
}

const ROLLED = new RegExp(`^(\\d+) \\((\\d+d\\d+)(?: ([+\\-−]) (\\d+))?\\) (${DAMAGE_ALT}) damage`);
const FLAT = new RegExp(`^(\\d+) (${DAMAGE_ALT}) damage`);

/** Reads one damage roll at the start of `text`; returns it and what follows, or undefined. */
function readDamage(text: string, actionAbility: Ability | undefined, basis: CreatureBasis): { damage: Damage; rest: string } | 'mismatch' | undefined {
  const rolled = ROLLED.exec(text);
  if (rolled) {
    const [raw, average = '', dice = '', sign, amount, type = ''] = rolled;
    const modifier = sign === undefined ? 0 : (sign === '+' ? 1 : -1) * Number(amount);
    if (diceAverage(dice) + modifier !== Number(average)) return 'mismatch';
    const ability = damageAbility(modifier, actionAbility, basis);
    if (ability === null) return 'mismatch';
    const damage: Damage = { dice };
    if (ability) damage.ability = ability;
    damage.type = DAMAGE_TYPE.get(type)!;
    return { damage, rest: text.slice(raw.length) };
  }
  const flat = FLAT.exec(text);
  if (flat) return { damage: { amount: Number(flat[1]), type: DAMAGE_TYPE.get(flat[2] ?? '')! }, rest: text.slice(flat[0].length) };
  return undefined;
}

/** The damage list and the prose after it, reversing afterDamage (site/src/lib/creature.ts). */
function readHit(text: string, ability: Ability | undefined, basis: CreatureBasis): { damage?: Damage[]; prose?: string } | 'mismatch' {
  const first = readDamage(text, ability, basis);
  if (first === 'mismatch') return 'mismatch';
  if (!first) return text === '' ? {} : { prose: text };
  const damage = [first.damage];
  let rest = first.rest;
  for (;;) {
    const conditional = rest.startsWith(', plus ');
    if (!conditional && !rest.startsWith(' plus ')) break;
    const next = readDamage(rest.slice(conditional ? 7 : 6), undefined, basis);
    if (next === 'mismatch' || !next) return 'mismatch';
    rest = next.rest;
    if (conditional) {
      const end = /^ ([^.,—–]+)/.exec(rest);
      if (!end) return 'mismatch';
      next.damage.condition = end[1];
      rest = rest.slice(end[0].length);
    }
    damage.push(next.damage);
  }
  if (rest === '.' || rest === '') return { damage };
  if (rest.startsWith(', ')) return { damage, prose: rest.slice(2) };
  if (/^[—–]/.test(rest)) return { damage, prose: rest };
  if (rest.startsWith('. ')) return { damage, prose: rest.slice(2) };
  return 'mismatch';
}

const LABEL = (text: string) => `\\*?${text}\\*?`;
const ATTACK = new RegExp(
  `^${LABEL('(Melee or Ranged|Melee|Ranged) Attack Roll:')} ([+\\-−]\\d+)(?: \\((.+?)\\))?, (?:reach (\\d+) ft\\.)?(?: or )?(?:range (\\d+)(?:/(\\d+))? ft\\.)?(?: ${LABEL('Hit:')})? ?(.*)$`,
  's',
);
const SAVE = new RegExp(`^${LABEL('(\\w+) Saving Throw:')} DC (\\d+), (.*)$`, 's');
const KIND: Record<string, ActionKind> = { Melee: 'melee-attack', Ranged: 'ranged-attack', 'Melee or Ranged': 'melee-or-ranged-attack' };
const abilityByName = (display: string): Ability | undefined => vocabularyKey('ability', display) as Ability | undefined;

/** Text compared loosely: without emphasis, the "Hit:" label, or typographic minus signs. */
const loose = (text: string): string => text.replace(/\*/g, '').replace(/ Hit: /g, ' ').replace(/\u2212/g, '-').replace(/\s+/g, ' ').trim();

/** An action's stat block text from its imported inputs, to check a parse against its source. */
function renderAction(action: Action, basis: CreatureBasis): string {
  return actionBlock(action, deriveAction(action, basis.pb, basis.mods), { pb: basis.pb, abilityMods: basis.mods } as DerivedCreature).body;
}

/** One Open5e action or trait as a library action: structured when its text reads back exactly, else as text. */
function readAction(rawName: string, desc: string, basis: CreatureBasis, skips: Skips, path: string): Action {
  const parsed = readStructured(rawName, desc, basis, new Skips([], ''), path);
  if (parsed && parsed !== 'text' && loose(renderAction(parsed, basis)) === loose(desc)) return readStructured(rawName, desc, basis, skips, path) as Action;
  if (parsed === undefined) readStructured(rawName, desc, basis, skips, path);
  const { name, recharge, uses } = nameNotes(rawName);
  const action = { name, kind: 'other', text: tokenizeCreatureText(desc, basis, skips, `${path}.text`) } as Action;
  if (recharge) action.recharge = recharge;
  if (uses) action.uses = uses;
  return action;
}

/** Parses one action's text, or returns 'text' when it isn't an attack or save. */
function readStructured(rawName: string, desc: string, basis: CreatureBasis, skips: Skips, path: string): Action | 'text' | undefined {
  const { name, recharge, uses } = nameNotes(rawName);
  const action = { name } as Action;
  const prose = (text: string, field: string) => tokenizeCreatureText(text, basis, skips, `${path}.${field}`);
  const fail = (why: string) => {
    skips.add(path, `${rawName}: ${why} It stays as text.`);
    return undefined;
  };
  const attack = ATTACK.exec(desc);
  const save = SAVE.exec(desc);
  if (attack) {
    const [, kind = '', bonus = '', note, reach, range, long, hit = ''] = attack;
    const ability = actionAbilityFor(KIND[kind]!, signedNumber(bonus), basis);
    if (!ability) return fail(`no ability gives its attack bonus of ${bonus}.`);
    Object.assign(action, { kind: KIND[kind], ability });
    if (reach) action.reach = Number(reach);
    if (range) action.range = { normal: Number(range), ...(long ? { long: Number(long) } : {}) };
    if (note) action.attackNote = unescapeMarkdown(note);
    const read = readHit(hit, ability, basis);
    if (read === 'mismatch') return fail('its damage doesn\'t match what the ruleset derives.');
    if (read.damage) action.damage = read.damage;
    if (read.prose) action.onHit = prose(read.prose, 'onHit');
  } else if (save) {
    const [, abilityName = '', dc = '', rest = ''] = save;
    const saveAbility = abilityByName(abilityName);
    const ability = actionAbilityFor('save', Number(dc), basis);
    if (!saveAbility) return fail(`"${abilityName}" isn't an ability.`);
    if (!ability) return fail(`no ability gives its DC of ${dc}.`);
    // Labels are italic in the library's text and plain in Open5e's, where "Second Failure:" can't be told apart.
    const labels = rest.includes('*Failure') || rest.includes('*Success') ? / \*(Failure or Success|Failure|Success):\* / : / (Failure or Success|Failure|Success): /;
    const [head = '', ...labelled] = rest.split(labels);
    Object.assign(action, { kind: 'save', ability, save: { ability: saveAbility, targets: unescapeMarkdown(head.replace(/\.$/, '')) } });
    for (let i = 0; i < labelled.length; i += 2) {
      const label = labelled[i];
      const text = labelled[i + 1] ?? '';
      if (label === 'Failure') {
        const read = readHit(text, ability, basis);
        if (read === 'mismatch') return fail('its damage doesn\'t match what the ruleset derives.');
        if (read.damage) action.damage = read.damage;
        if (read.prose) action.onFailure = prose(read.prose, 'onFailure');
      } else if (label === 'Success') action.onSuccess = prose(text, 'onSuccess');
      else action.onFailureOrSuccess = prose(text, 'onFailureOrSuccess');
    }
  } else {
    return 'text';
  }
  if (recharge) action.recharge = recharge;
  if (uses) action.uses = uses;
  return action;
}

/** Splits a list on commas outside parentheses. */
function splitList(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (depth === 0 && text.startsWith(', ', i)) {
      items.push(text.slice(start, i));
      start = i + 2;
    }
  }
  items.push(text.slice(start));
  return items;
}

const SPELLCASTING = new RegExp(
  '^The (.+?) casts one of the following spells, (?:requiring no (.+?) components and )?using (\\w+) as the spellcasting ability(?: \\((.+)\\))?:$',
);

/** The Spellcasting action's text as `stats.spellcasting`, reversing spellcastingBlock (site/src/lib/creature.ts). */
function readSpellcasting(
  desc: string,
  basis: CreatureBasis,
  context: ImportContext,
  skips: Skips,
): { spellcasting: NonNullable<CreatureStats['spellcasting']>; shortName: string } | undefined {
  const [intro = '', ...lines] = desc.split(/\\?\n/);
  const match = SPELLCASTING.exec(unescapeMarkdown(intro));
  const ability = match && abilityByName(match[3] ?? '');
  if (!match || !ability) return undefined;
  const sc: NonNullable<CreatureStats['spellcasting']> = { ability };
  if (match[2]) sc.noComponents = match[2];
  const numbers = (match[4] ?? '').split(', ');
  const dc = numbers.map((n) => /^spell save DC (\d+)$/.exec(n)?.[1]).find(Boolean);
  const attack = numbers.map((n) => /^([+\-−]\d+) to hit with spell attacks$/.exec(n)?.[1]).find(Boolean);
  const derivedDc = saveDc(basis.pb, basis.mods[ability]);
  const derivedBonus = attackBonus(basis.pb, basis.mods[ability]);
  if (dc === undefined) sc.noSaveDc = true;
  else if (Number(dc) !== derivedDc) skips.add('stats.spellcasting', `Its save DC ${dc} isn't what the ruleset derives (${derivedDc}); the ruleset's is kept.`);
  if (attack !== undefined) {
    sc.includeAttack = true;
    if (signedNumber(attack) !== derivedBonus) skips.add('stats.spellcasting', `Its attack bonus ${attack} isn't what the ruleset derives (${signed(derivedBonus)}); the ruleset's is kept.`);
  }
  const notes: string[] = [];
  for (const line of lines) {
    const list = /^\*(At Will|([123])\/Day(?: Each)?):\* (.*)$/.exec(line);
    if (!list) {
      notes.push(line);
      continue;
    }
    const spells: RefOrText[] = splitList(list[3] ?? '').map((raw) => {
      const text = unescapeMarkdown(raw);
      const noted = /^(.+?) \((.+)\)$/.exec(text);
      const ref = resolveName('spell', text, context.names);
      if (ref) return { ref };
      const notedRef = noted && resolveName('spell', noted[1] ?? '', context.names);
      if (noted && notedRef) return { ref: notedRef, note: noted[2] ?? '' } as Ref;
      skips.add('stats.spellcasting', `No spell in the library is named "${text}"; it stays as text.`);
      return text;
    });
    if (list[2]) (sc.perDay ??= {})[list[2] as '1' | '2' | '3'] = spells;
    else sc.atWill = spells;
  }
  if (notes.length) sc.note = tokenizeCreatureText(notes.join('\n'), basis, skips, 'stats.spellcasting.note');
  return { spellcasting: sc, shortName: match[1] ?? '' };
}

/** Parses the languages line written by languagesLine (site/src/lib/creature.ts). */
function readLanguages(text: string): CreatureStats['languages'] {
  const languages: CreatureStats['languages'] = { spoken: [] };
  const noted = /^(.*) \(([^()]+)\)$/.exec(text);
  const line = noted ? (noted[1] ?? '') : text;
  if (noted) languages.note = noted[2] ?? '';
  if (line === 'None' || line === '') return languages;
  const items = (text: string) => text.replace(/,? and /, ', ').split(', ');
  for (const part of line.split('; ')) {
    const telepathy = /^telepathy (\d+) ft\.$/.exec(part);
    const understood = /^[Uu]nderstands (.+) but can't speak(?: them| it)?$/.exec(part);
    if (telepathy) languages.telepathy = Number(telepathy[1]);
    else if (understood) languages.understood = items(understood[1] ?? '');
    else languages.spoken = part.split(', ');
  }
  return languages;
}

export function importCreature(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined {
  const name = String(record.name ?? '');
  const size = keyName(record.size).key as Size | undefined;
  const creatureType = keyName(record.type).key;
  const cr = num(record.challenge_rating);
  const scores = (record.ability_scores ?? {}) as Record<string, unknown>;
  const abilities = Object.fromEntries(tables.abilities.map((a) => [a, num(scores[ABILITY_NAMES[a]])])) as Record<Ability, number>;
  const missing = [
    !size || !(size in tables.sizes) ? 'a size' : '',
    !creatureType || !tables.creatureTypes.includes(creatureType) ? 'a creature type' : '',
    cr === undefined || !tables.challengeRatings.some((r) => r.cr === cr) ? 'a challenge rating' : '',
    tables.abilities.some((a) => abilities[a] === undefined) ? 'ability scores' : '',
  ].filter(Boolean);
  if (missing.length) {
    skips.add('', `It has no ${missing.join(', ')} the ruleset knows, so it isn't imported.`);
    return undefined;
  }
  const pb = crRow(cr!, tables).row.pb;
  const basis = basisOf(abilities, pb);
  const stats: Partial<CreatureStats> & Record<string, unknown> = { size: [size!], creatureType, alignment: String(record.alignment ?? '') };
  const ac: CreatureStats['ac'] = { value: num(record.armor_class) ?? 10 };
  if (typeof record.armor_detail === 'string' && record.armor_detail !== '') ac.note = record.armor_detail;
  stats.ac = ac;

  const initiative = num(record.initiative_bonus);
  if (initiative !== undefined) {
    const proficiency = proficiencyFor(initiative - basis.mods.dex, pb);
    if (proficiency === null) skips.add('stats.initiative', `Its initiative ${signed(initiative)} doesn't derive from a proficiency; the ruleset's is kept.`);
    else if (proficiency) stats.initiative = { proficiency };
  }

  const hitDice = /^(\d+)d(\d+)/.exec(String(record.hit_dice ?? ''));
  if (!hitDice) {
    skips.add('', 'It has no hit dice, so it isn\'t imported.');
    return undefined;
  }
  stats.hitDice = Number(hitDice[1]);
  const die = tables.sizes[size!].hitDie;
  const hp = Math.max(1, Math.floor((stats.hitDice * (die + 1)) / 2) + stats.hitDice * basis.mods.con);
  if (Number(hitDice[2]) !== die || num(record.hit_points) !== hp) {
    skips.add('stats.hitDice', `Its hit points ${String(record.hit_points)} (${String(record.hit_dice)}) aren't what the ruleset derives (${hp}); the ruleset's are kept.`);
  }

  const speedIn = (record.speed ?? {}) as Record<string, unknown>;
  const speed: CreatureStats['speed'] = { walk: num(speedIn.walk) ?? 0 };
  for (const mode of SPEEDS) {
    const feet = num(speedIn[mode]);
    if (feet) speed[mode] = feet;
  }
  if (speedIn.hover === true) speed.hover = true;
  stats.speed = speed;
  stats.abilities = abilities;

  const saves = (record.saving_throws ?? {}) as Record<string, unknown>;
  const saveProficiencies = tables.abilities.filter((a) => {
    const bonus = num(saves[ABILITY_NAMES[a]]);
    if (bonus === undefined) return false;
    const extra = bonus - basis.mods[a];
    if (extra !== 0 && extra !== pb) skips.add('stats.saveProficiencies', `Its ${ABILITY_NAMES[a]} save ${signed(bonus)} doesn't derive from proficiency; the ruleset's is kept.`);
    return extra === pb;
  });
  if (saveProficiencies.length) stats.saveProficiencies = saveProficiencies;

  const skills: Record<string, Proficiency> = {};
  for (const [key, value] of Object.entries((record.skill_bonuses ?? {}) as Record<string, unknown>)) {
    const skill = key.replace(/_/g, '-');
    const ability = tables.skills[skill];
    const bonus = num(value);
    if (!ability || bonus === undefined) continue;
    const proficiency = proficiencyFor(bonus - basis.mods[ability], pb);
    if (proficiency === null) skips.add(`stats.skills.${skill}`, `Its ${skill} bonus ${signed(bonus)} doesn't derive from a proficiency; the ruleset's is kept.`);
    else if (proficiency) skills[skill] = proficiency;
  }
  if (Object.keys(skills).length) stats.skills = skills;

  const defenses = (record.resistances_and_immunities ?? {}) as Record<string, unknown>;
  const damageKeys = (field: string) =>
    ((defenses[field] ?? []) as unknown[]).map((v) => keyName(v).key ?? '').filter((k) => tables.damageTypes.includes(k));
  const vulnerabilities = damageKeys('damage_vulnerabilities');
  const resistances = damageKeys('damage_resistances');
  const immuneDamage = damageKeys('damage_immunities');
  if (vulnerabilities.length) stats.vulnerabilities = vulnerabilities;
  if (resistances.length) stats.resistances = resistances;
  const conditions = ((defenses.condition_immunities ?? []) as unknown[]).flatMap((v) => {
    const conditionName = keyName(v).name ?? '';
    const ref = resolveName('condition', conditionName, context.names);
    if (!ref) skips.add('stats.immunities.conditions', `No condition in the ruleset is named "${conditionName}".`);
    return ref ? [{ ref }] : [];
  });
  if (immuneDamage.length || conditions.length) {
    stats.immunities = { ...(immuneDamage.length ? { damage: immuneDamage } : {}), ...(conditions.length ? { conditions } : {}) };
  }

  const senses: NonNullable<CreatureStats['senses']> = {};
  for (const sense of SENSES) {
    const feet = num(record[`${sense}_range`]);
    if (feet) senses[sense] = feet;
  }
  if (Object.keys(senses).length) stats.senses = senses;
  stats.languages = readLanguages(String((record.languages as Record5e | undefined)?.as_string ?? ''));
  stats.cr = cr!;

  const traits = ((record.traits ?? []) as Record5e[]).flatMap((t, i) => {
    const a = readAction(String(t.name ?? ''), String(t.desc ?? ''), basis, skips, `stats.traits[${i}]`);
    return a ? [a] : [];
  });
  if (traits.length) stats.traits = traits;
  const lists: Record<string, Action[]> = { actions: [], bonusActions: [], reactions: [], legendary: [] };
  const byType = Object.fromEntries(Object.entries(ACTION_TYPE).map(([list, type]) => [type, list]));
  for (const a of (record.actions ?? []) as Record5e[]) {
    const list = byType[String(a.action_type ?? 'ACTION')] ?? 'actions';
    const desc = String(a.desc ?? '');
    if (list === 'actions' && a.name === 'Spellcasting' && !stats.spellcasting) {
      const read = readSpellcasting(desc, basis, context, skips);
      if (read) {
        stats.spellcasting = read.spellcasting;
        if (read.shortName !== shortName({} as CreatureStats, name)) stats.shortName = read.shortName;
        continue;
      }
    }
    const path = list === 'legendary' ? 'stats.legendaryActions.items' : `stats.${list}`;
    const action = readAction(String(a.name ?? ''), desc, basis, skips, `${path}[${lists[list]!.length}]`);
    if (action) lists[list]!.push(action);
  }
  for (const list of ['actions', 'bonusActions', 'reactions'] as const) if (lists[list]!.length) stats[list] = lists[list];
  if (lists.legendary!.length) skips.add('stats.legendaryActions', 'Open5e doesn\'t give legendary action uses, so its legendary actions aren\'t imported.');

  // Keys in the order the schema and the library's entries list them.
  const order = ['size', 'creatureType', 'shortName', 'alignment', 'ac', 'initiative', 'hitDice', 'speed', 'abilities', 'saveProficiencies', 'skills', 'vulnerabilities', 'resistances', 'immunities', 'senses', 'languages', 'cr', 'traits', 'actions', 'spellcasting', 'bonusActions', 'reactions'];
  const ordered = Object.fromEntries(order.filter((k) => stats[k] !== undefined).map((k) => [k, stats[k]]));
  return { ruleset: context.ruleset, type: 'creature', id: slug(name), name, stats: ordered };
}
