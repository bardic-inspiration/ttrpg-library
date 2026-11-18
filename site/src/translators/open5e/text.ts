// Text in and out of Open5e (docs/export.md#open5e). On export, a `{ref:…}` token becomes its
// target's plain name, and each one is reported. On import, prose stays as written, except that a
// creature's damage and DC numbers become tokens where they match what the ruleset derives.

import { abilityMod, diceAverage, saveDc } from '../../../../rulesets/dnd-5e-2024/derive.ts';
import { tables } from '../../../../rulesets/dnd-5e-2024/index.ts';
import type { Ability } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { replaceRefTokens, textRefs as findRefs } from '../../../../scripts/validate/refs.ts';
import type { Skip } from '../types.ts';


/** A skip list for one entry, so callers only name the path and the reason. */
export class Skips {
  constructor(
    private readonly list: Skip[],
    readonly entry: string,
  ) {}
  add(path: string, reason: string): void {
    this.list.push({ entry: this.entry, path, reason });
  }
}

/** The ref keys of `{ref:…}` tokens in a text, in order. */
export const textRefs = (text: string): string[] => findRefs(text, '').refs.map((r) => r.ref);

const nameOf = (key: string, names: Record<string, string>): string => names[key] ?? key.slice(key.indexOf('/') + 1);

/** `text` with each `{ref:…}` token as its display text or target's name. Reports nothing. */
export const plainRefs = (text: string, names: Record<string, string>): string =>
  replaceRefTokens(text, (token) => token.text ?? nameOf(token.key, names));

/** Reports each `{ref:…}` token in `text`, at `path`, as a link that became plain text. */
export function reportRefs(text: string | undefined, names: Record<string, string>, skips: Skips, path: string): void {
  for (const key of textRefs(text ?? '')) skips.add(path, `The link to ${nameOf(key, names)} became plain text.`);
}

/** `text` with its refs plain, each reported at `path`. */
export function exportText(text: string, names: Record<string, string>, skips: Skips, path: string): string {
  reportRefs(text, names, skips, path);
  return plainRefs(text, names);
}

/** Undoes `escapeMarkdown` (lib/wording/phrase.ts). */
export const unescapeMarkdown = (text: string): string => text.replace(/\\([\\`*_[\]<>#~|!&])/g, '$1');

/** `−3` or `+3` or `3` as a number; U+2212 and ASCII minus both read as minus. */
export const signedNumber = (text: string): number => Number(text.replace('−', '-').replace(/^\+/, ''));

/** What a creature's numbers derive from: its ability modifiers and Proficiency Bonus. */
export interface CreatureBasis {
  mods: Record<Ability, number>;
  pb: number;
}

export const basisOf = (abilities: Record<Ability, number>, pb: number): CreatureBasis => ({
  mods: Object.fromEntries(tables.abilities.map((a) => [a, abilityMod(abilities[a])])) as Record<Ability, number>,
  pb,
});

/**
 * The ability whose value under `of` is `target`. When several are, the first of `prefer` among
 * them, else the first in table order: any of them derives the same number.
 */
export function abilityFor(target: number, of: (ability: Ability) => number, prefer: Ability[] = []): Ability | undefined {
  const found = tables.abilities.filter((a) => of(a) === target);
  return prefer.find((a) => found.includes(a)) ?? found[0];
}

/** The abilities a tie prefers: Strength for a melee attack, Dexterity for a ranged one, Constitution for a save DC. */
export const PREFER = { melee: ['str', 'dex'], ranged: ['dex', 'str'], save: ['con'] } satisfies Record<string, Ability[]>;

/** Each damage type by its printed name, `Fire` to `fire`. */
export const DAMAGE_NAMES = new Map(tables.damageTypes.map((t) => [t.charAt(0).toUpperCase() + t.slice(1), t]));
/** The printed damage type names as regex alternatives. */
export const DAMAGE_ALT = [...DAMAGE_NAMES.keys()].join('|');
/** `11 (2d10)`, `15 (3d6 + 5)`, `4 (1d8 − 1)`, then an optional ` Fire damage`. */
const DAMAGE_TOKEN = new RegExp(`(\\d+) \\((\\d+d\\d+)(?: ([+\\-−]) (\\d+))?\\)(?: (${DAMAGE_ALT}) damage)?`, 'g');
const DC = /\bDC (\d+)\b/g;

/**
 * A creature's prose with its rendered numbers as tokens (docs/rulesets.md#text-tokens): a damage
 * roll whose average matches becomes `{dmg:…}`, with the ability whose modifier it adds, and a DC
 * becomes `{dc:<ability>}` when an ability derives it (ties by `abilityFor`), else the authored
 * `{dc=<n>}`. An escape DC or an ability check's DC is always authored. A roll that doesn't match stays as written and is listed.
 */
export function tokenizeCreatureText(text: string, basis: CreatureBasis, skips: Skips, path: string): string {
  const damaged = text.replace(DAMAGE_TOKEN, (raw, average: string, dice: string, sign?: string, amount?: string, type?: string) => {
    const modifier = sign === undefined ? 0 : (sign === '+' ? 1 : -1) * Number(amount);
    if (diceAverage(dice) + modifier !== Number(average)) {
      skips.add(path, `"${raw}" doesn't average to what its dice roll; it stays as written.`);
      return raw;
    }
    let roll = dice;
    if (modifier !== 0) {
      const ability = abilityFor(modifier, (a) => basis.mods[a], PREFER.melee);
      if (!ability) {
        skips.add(path, `No ability adds the ${modifier} in "${raw}"; it stays as written.`);
        return raw;
      }
      roll = `${dice}+${ability}`;
    }
    const damageType = type === undefined ? '' : `:${DAMAGE_NAMES.get(type)}`;
    return `{dmg:${roll}${damageType}}`;
  });
  return damaged.replace(DC, (raw, n: string, at: number, whole: string) => {
    // An escape DC and an ability check's DC are the author's (docs/rulesets.md#text-tokens).
    const authored = /escape $/.test(whole.slice(0, at)) || /^ \w+ \(\w[\w ]*\) check/.test(whole.slice(at + raw.length));
    const ability = authored ? undefined : abilityFor(Number(n), (a) => saveDc(basis.pb, basis.mods[a]), PREFER.save);
    return ability ? `{dc:${ability}}` : `{dc=${n}}`;
  });
}

/** A name as an id: lowercase words joined by hyphens, without punctuation. */
export const slug = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The key of the entry or primitive of `type` named exactly `name`, if exactly one is. */
export function resolveName(type: string, name: string, names: Map<string, string>): string | undefined {
  const found = [...names].filter(([key, n]) => key.startsWith(`${type}/`) && n === name).map(([key]) => key);
  return found.length === 1 ? found[0] : undefined;
}
