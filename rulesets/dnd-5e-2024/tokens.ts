// Text tokens that show derived values inside creature prose (docs/rulesets.md#text-tokens).
// The validator parses them; templates render them from the same derivations
// as the stat block.

import { deriveDamage, printMinus, signed } from './derive.ts';
import type { Ability, DerivedCreature, Tables } from './types.ts';

export type Token =
  | { kind: 'mod'; ability: Ability }
  | { kind: 'pb' }
  | { kind: 'atk' | 'dc'; ability: Ability; adjust: number }
  /** A DC the rules leave to the author, such as an ability check's (docs/rulesets.md#text-tokens). */
  | { kind: 'authored-dc'; value: number }
  | { kind: 'dmg'; dice: string; ability?: Ability; damageType?: string };

export interface TokenMatch {
  /** The token as written, braces included. */
  raw: string;
  index: number;
  token?: Token;
  error?: string;
}

const TOKEN = /\{([^{}]*)\}/g;
const ADJUST = /^[+-]?[1-9]\d*$/;
const DICE = /^[1-9]\d*d(4|6|8|10|12|20|100)$/;
const AUTHORED_DC = /^[1-9]\d*$/;

/** Parses the inside of one `{...}` token. */
export function parseToken(body: string, tables: Tables): { token?: Token; error?: string } {
  if (body.startsWith('dc=')) {
    const value = body.slice(3);
    return AUTHORED_DC.test(value)
      ? { token: { kind: 'authored-dc', value: Number(value) } }
      : { error: `authored DC "${value}" is not a positive integer; expected {dc=<n>}` };
  }
  const [kind, ...args] = body.split(':');
  const isAbility = (value: string | undefined): value is Ability =>
    value !== undefined && (tables.abilities as string[]).includes(value);
  const usage: Record<string, string> = {
    mod: '{mod:<ability>}',
    pb: '{pb}',
    atk: '{atk:<ability>[:<adjust>]}',
    dc: '{dc:<ability>[:<adjust>]}',
    'dc=': '{dc=<n>}',
    dmg: '{dmg:<dice>[+<ability>][:<type>]}',
  };
  const malformed = (detail: string) => ({ error: `${detail}; expected ${usage[kind ?? '']}` });

  switch (kind) {
    case 'pb':
      return args.length === 0 ? { token: { kind: 'pb' } } : malformed('{pb} takes no arguments');
    case 'mod': {
      if (args.length !== 1) return malformed('wrong number of arguments');
      if (!isAbility(args[0])) return malformed(`unknown ability "${args[0]}"`);
      return { token: { kind: 'mod', ability: args[0] } };
    }
    case 'atk':
    case 'dc': {
      if (args.length < 1 || args.length > 2) return malformed('wrong number of arguments');
      if (!isAbility(args[0])) return malformed(`unknown ability "${args[0]}"`);
      const adjust = args[1];
      if (adjust !== undefined && !ADJUST.test(adjust)) return malformed(`adjust "${adjust}" is not a non-zero integer`);
      return { token: { kind, ability: args[0], adjust: adjust === undefined ? 0 : Number(adjust) } };
    }
    case 'dmg': {
      if (args.length < 1 || args.length > 2) return malformed('wrong number of arguments');
      const [roll = '', damageType] = args;
      const [dice = '', ability, ...extra] = roll.split('+');
      if (!DICE.test(dice)) return malformed(`dice "${dice}" are not like 2d6`);
      if (extra.length > 0) return malformed(`"${roll}" adds more than one ability`);
      if (ability !== undefined && !isAbility(ability)) return malformed(`unknown ability "${ability}"`);
      if (damageType !== undefined && !tables.damageTypes.includes(damageType)) {
        return malformed(`unknown damage type "${damageType}"`);
      }
      const token: Token = { kind: 'dmg', dice };
      if (ability !== undefined) token.ability = ability;
      if (damageType !== undefined) token.damageType = damageType;
      return { token };
    }
    default:
      return { error: `unknown token "{${body}}"; known tokens are ${Object.values(usage).join(', ')}` };
  }
}

/**
 * A `{ref:…}` link token belongs to the core, not the ruleset (docs/content-model.md#references):
 * the validator checks it with the other refs, and the site renders it as a
 * link after the ruleset's tokens.
 */
const isRefToken = (body: string): boolean => body.startsWith('ref:');

/** Every ruleset token in a text, parsed. A stray brace is reported as an error. */
export function findTokens(text: string, tables: Tables): TokenMatch[] {
  const matches: TokenMatch[] = [];
  for (const match of text.matchAll(TOKEN)) {
    if (isRefToken(match[1] ?? '')) continue;
    matches.push({ raw: match[0], index: match.index, ...parseToken(match[1] ?? '', tables) });
  }
  const rest = text.replace(TOKEN, '');
  const stray = rest.search(/[{}]/);
  if (stray !== -1) {
    matches.push({ raw: rest[stray] ?? '', index: stray, error: 'unmatched brace; tokens look like {pb}' });
  }
  return matches;
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function renderToken(token: Token, derived: DerivedCreature): string {
  switch (token.kind) {
    case 'pb':
      return signed(derived.pb);
    case 'mod':
      return signed(derived.abilityMods[token.ability]);
    case 'atk':
      return signed(derived.pb + derived.abilityMods[token.ability] + token.adjust);
    case 'dc':
      return `DC ${8 + derived.pb + derived.abilityMods[token.ability] + token.adjust}`;
    case 'authored-dc':
      return `DC ${token.value}`;
    case 'dmg': {
      const display = printMinus(deriveDamage(token.dice, token.ability, 0, derived.abilityMods).display);
      return token.damageType ? `${display} ${capitalize(token.damageType)} damage` : display;
    }
  }
}

/** Replaces every ruleset token in `text` with its rendered value, leaving `{ref:…}` links. Throws on a bad token; validate first. */
export function renderTokens(text: string, derived: DerivedCreature, tables: Tables): string {
  return text.replace(TOKEN, (raw, body: string) => {
    if (isRefToken(body)) return raw;
    const { token, error } = parseToken(body, tables);
    if (!token) throw new Error(`${raw}: ${error}`);
    return renderToken(token, derived);
  });
}
