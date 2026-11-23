// Elementals, an original fixture ruleset (docs/rulesets.md#fixture-rulesets): a card game whose four
// colors are elements. A card costs chips drawn from a shared pool, and its colors set its element, one
// of the four or a blend of two. Key numbers are powers of 4.

import type { Issue, RulesetModule } from '../../../../../rulesets/module.ts';
import type { RulesData } from '../../../../../lib/rules.ts';
import type { PhraseBook } from '../../../../../lib/wording/book.ts';
import definition from './ruleset.json' with { type: 'json' };
import phrasesJson from './phrases.json' with { type: 'json' };
import tablesJson from './tables.json' with { type: 'json' };
import type { CardDerived, CardStats, Color, CreatureStats, ElementStats, Tables } from './types.ts';

export const tables = tablesJson as Tables;

const COLORS = Object.keys(tables.beats) as Color[];

const colorsOf = (cost: CardStats['cost']): Color[] => COLORS.filter((color) => (cost[color] ?? 0) > 0);

/**
 * The element a set of colors makes: the base element for one, and for two the blend whose parts they
 * are, read from the rules data's element primitives.
 */
export function elementOf(colors: Color[], rules?: RulesData): string | undefined {
  if (colors.length === 1) return colors[0];
  const parts = colors.map((c) => `element/${c}`).sort().join(' ');
  return rules?.primitives.find(
    (p) => p.type === 'element' && ((p.stats as unknown as ElementStats).blend ?? []).map((b) => b.ref).sort().join(' ') === parts,
  )?.id;
}

/** A card's element, total cost, and the base elements it beats and is beaten by. A blend has both parts'. */
export function deriveCard(stats: CardStats, rules?: RulesData): CardDerived {
  const colors = colorsOf(stats.cost);
  const element = elementOf(colors, rules);
  const beats = COLORS.filter((c) => colors.some((own) => tables.beats[own] === c));
  const beatenBy = COLORS.filter((c) => colors.includes(tables.beats[c]));
  return {
    ...(element ? { element } : {}),
    totalCost: Object.values(stats.cost).reduce((sum, n) => sum + (n ?? 0), 0),
    beats,
    beatenBy,
  };
}

/** A creature's power plus toughness against its budget, 8 per chip; a creature over it needs a reviewer's eye. */
export function checkCreature(stats: CreatureStats, rules?: RulesData): Issue[] {
  const { totalCost, element } = deriveCard(stats, rules);
  const issues: Issue[] = [];
  if (!element) issues.push({ level: 'error', path: 'stats.cost', message: 'no element blends these colors' });
  const budget = totalCost * tables.budgetPerChip;
  const spent = stats.power + stats.toughness;
  if (spent > budget) issues.push({ level: 'warning', path: 'stats.power', message: `power plus toughness is ${spent}, over the ${budget} its cost of ${totalCost} allows` });
  return issues;
}

const isCard = (type: string) => type === 'creature' || type === 'invocation' || type === 'ward';

export const ruleset: RulesetModule = {
  definition,
  phrases: phrasesJson as unknown as PhraseBook,
  derive(type, stats, rules) {
    return isCard(type) ? { ...deriveCard(stats as CardStats, rules) } : {};
  },
  check(type, stats, rules) {
    if (type === 'creature') return checkCreature(stats as CreatureStats, rules);
    if (isCard(type) && !deriveCard(stats as CardStats, rules).element) return [{ level: 'error', path: 'stats.cost', message: 'no element blends these colors' }];
    return [];
  },
  refLabels(type, path) {
    if (type === 'element' && /^stats\.blend\[\d+\]$/.test(path)) return { forward: 'Blend of', back: 'Blends into' };
    return { forward: 'References', back: 'Referenced by' };
  },
};
