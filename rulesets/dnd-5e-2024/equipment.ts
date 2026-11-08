// dnd-5e-2024 equipment (docs/rulesets.md#equipment): its derived values, its consistency checks,
// and the checks on an item's base item, which read the ruleset's equipment groups.

import type { Issue } from '../module.ts';
import type { GroupTree, RulesData } from '../../lib/rules.ts';
import type { BaseItem, Cost, DerivedEquipment, EquipmentStats } from './types.ts';

/** Gold pieces per unit of each coin (SRD 5.2 "Coin Values"). */
const GP_PER: Record<Cost['unit'], number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** A cost in gold pieces, rounded to the copper. */
export const costInGp = (cost: Cost): number => Math.round(cost.amount * GP_PER[cost.unit] * 100) / 100;

/** The category group a group sits in: itself, or its topmost ancestor. */
export function categoryOf(tree: GroupTree | undefined, group: string): string | undefined {
  let at = tree?.byId.get(group);
  while (at?.parent !== undefined) at = tree?.byId.get(at.parent);
  return at?.id;
}

/** Which category each category block belongs to; equipment in any other category has none. */
const BLOCKS: { key: 'weapon' | 'armor' | 'tool' | 'mount' | 'vehicle'; group: string; scope: 'category' | 'group' }[] = [
  { key: 'weapon', group: 'weapons', scope: 'category' },
  { key: 'armor', group: 'armor', scope: 'category' },
  { key: 'tool', group: 'tools', scope: 'category' },
  { key: 'mount', group: 'mounts-and-other-animals', scope: 'group' },
  { key: 'vehicle', group: 'airborne-and-waterborne-vehicles', scope: 'group' },
];

const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a');

const equipmentTree = (rules: RulesData | undefined): GroupTree | undefined => rules?.groups.get('equipment');

/** Equipment derives its category, so it's never stored beside the group, and its cost in gold pieces. */
export function deriveEquipment(stats: EquipmentStats, rules: RulesData | undefined): DerivedEquipment {
  const category = categoryOf(equipmentTree(rules), stats.group);
  return { ...(category ? { category } : {}), ...(stats.cost ? { costGp: costInGp(stats.cost) } : {}) };
}

const has = (stats: EquipmentStats, property: string): boolean =>
  (stats.weapon?.properties ?? []).some((p) => p.ref === `weapon-property/${property}`);

/** Equipment checks (docs/rulesets.md#consistency-checks "Equipment"). The leaf-group check is the validator's. */
export function checkEquipment(stats: EquipmentStats, rules: RulesData | undefined): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const tree = equipmentTree(rules);
  const category = categoryOf(tree, stats.group);

  if (tree?.byId.has(stats.group)) {
    for (const block of BLOCKS) {
      const belongs = block.scope === 'category' ? category === block.group : stats.group === block.group;
      if (belongs && stats[block.key] === undefined) {
        error(`stats.${block.key}`, `equipment in ${block.group} needs ${article(block.key)} ${block.key} block`);
      }
      if (!belongs && stats[block.key] !== undefined) {
        error(`stats.${block.key}`, `${article(block.key)} ${block.key} block is only for equipment in ${block.group}`);
      }
    }
  }
  if (stats.variants !== undefined) {
    if (stats.cost !== undefined) error('stats.cost', 'equipment with variants has no cost of its own; each variant has its cost');
    if (stats.weight !== undefined) error('stats.weight', 'equipment with variants has no weight of its own; each variant has its weight');
  } else if (stats.cost === undefined) {
    error('stats.cost', 'missing: equipment without variants has a cost');
  }
  if (stats.weightNote !== undefined && stats.weight === undefined) error('stats.weightNote', 'a weightNote needs a weight');

  const weapon = stats.weapon;
  if (weapon) {
    const ranged = has(stats, 'ammunition') || has(stats, 'thrown');
    if (ranged && weapon.range === undefined) error('stats.weapon.range', 'a weapon with the Ammunition or Thrown property has a range');
    if (!ranged && weapon.range !== undefined) error('stats.weapon.range', 'a range is only for a weapon with the Ammunition or Thrown property');
    if (weapon.range && weapon.range.long <= weapon.range.normal) error('stats.weapon.range.long', 'the long range must be above the normal range');
    if (has(stats, 'ammunition') !== (weapon.ammunition !== undefined)) {
      error('stats.weapon.ammunition', 'a weapon names its ammunition exactly when it has the Ammunition property');
    }
    if (has(stats, 'versatile') !== (weapon.versatile !== undefined)) {
      error('stats.weapon.versatile', 'a weapon has versatile damage exactly when it has the Versatile property');
    }
  }
  if (stats.armor?.dexMax !== undefined && stats.armor.dex === undefined) error('stats.armor.dexMax', 'a dexMax needs dex');
  return issues;
}

/** Base item checks (docs/rulesets.md#consistency-checks "Item"): what each list may name. */
export function checkBaseItem(base: BaseItem, rules: RulesData | undefined): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const tree = equipmentTree(rules);
  if (!tree) return issues;
  const idOf = (ref: string) => ref.slice(ref.indexOf('/') + 1);
  const isGroup = (ref: string) => tree.byId.has(idOf(ref));
  const primitive = (ref: string) => rules?.primitives.find((p) => p.type === 'equipment' && p.id === idOf(ref));

  if (base.oneOf) {
    base.oneOf.forEach((r, i) => {
      if (isGroup(r.ref)) error(`stats.baseItem.oneOf[${i}]`, `${r.ref} is a group; name groups under "any"`);
    });
  }
  if (base.any) {
    base.any.forEach((r, i) => {
      const p = primitive(r.ref);
      if (!isGroup(r.ref) && p && (p.stats as unknown as EquipmentStats).variants === undefined) {
        error(`stats.baseItem.any[${i}]`, `${r.ref} is one item; "any" names groups or items with variants, and "oneOf" names items`);
      }
    });
    (base.except ?? []).forEach((r, i) => {
      const p = primitive(r.ref);
      const inside = p !== undefined && base.any!.some((a) => isGroup(a.ref) && tree.contains(idOf(a.ref), p));
      if (p && !inside) error(`stats.baseItem.except[${i}]`, `${r.ref} isn't in any of the groups "any" names`);
    });
  }
  return issues;
}

