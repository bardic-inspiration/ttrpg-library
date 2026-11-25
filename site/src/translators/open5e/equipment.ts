// Equipment to and from Open5e's Item record (docs/export.md#open5e): weapons and armor through
// its weapon and armor summaries, other equipment by its category.

import type { DerivedEquipment, EquipmentStats } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { name as word } from '../../lib/wording.ts';
import type { ImportContext, ImportedEntry, TranslatorItem } from '../types.ts';
import { DOCUMENT, keyOf, summary, type Record5e } from './document.ts';
import { exportText, resolveName, Skips, slug } from './text.ts';

/** Open5e's item category for each equipment category the library derives. */
const CATEGORY: Record<string, { key: string; name: string }> = {
  weapons: summary('weapon', 'Weapon'),
  armor: summary('armor', 'Armor'),
  tools: summary('tools', 'Tools'),
  'adventuring-gear': summary('adventuring-gear', 'Adventuring Gear'),
  'mounts-and-vehicles': summary('mount', 'Mount'),
};
const ARMOR_GROUP: Record<string, string> = { light: 'light-armor', medium: 'medium-armor', heavy: 'heavy-armor', shield: 'shields' };

/** Equipment whose group Open5e can carry: a weapon, armor, or a category that is itself a group. */
const groupReadsBack = (s: EquipmentStats): boolean => s.weapon !== undefined || s.armor !== undefined || s.group === 'adventuring-gear';

export function exportEquipment(item: TranslatorItem, skips: Skips): Record5e {
  const s = item.entry.stats as EquipmentStats;
  const d = item.derived as DerivedEquipment;
  const name = (ref: string) => item.names[ref] ?? ref.slice(ref.indexOf('/') + 1);
  for (const key of ['weightNote', 'variants', 'tool', 'mount', 'vehicle'] as const) {
    if (s[key] !== undefined) skips.add(`stats.${key}`, `Open5e has no field for equipment's ${key}.`);
  }
  if (s.cost && s.cost.unit !== 'gp') skips.add('stats.cost', 'Open5e gives costs in gold pieces, so the coin doesn\'t read back.');
  const weapon = s.weapon;
  for (const [i, p] of (weapon?.properties ?? []).entries()) {
    if (p.note !== undefined) skips.add(`stats.weapon.properties[${i}].note`, 'Open5e has no field for a weapon property\'s note.');
  }
  const range = weapon?.range ? `Range ${weapon.range.normal}/${weapon.range.long}` : undefined;
  const detail = (ref: string): string | null => {
    if (ref === 'weapon-property/versatile') return weapon?.versatile ?? null;
    if (ref === 'weapon-property/ammunition') return [range, weapon?.ammunition].filter(Boolean).join('; ') || null;
    if (ref === 'weapon-property/thrown') return range ?? null;
    return null;
  };
  const category = CATEGORY[d.category ?? ''] ?? CATEGORY['adventuring-gear']!;
  // Import reads a group only from a weapon, armor, or the adventuring-gear category, so other equipment doesn't come back.
  if (!s.weapon && !s.armor && category.key !== 'adventuring-gear') skips.add('', `Open5e's ${category.name} category doesn't name one equipment group, so it exports but doesn't import back.`);
  else if (!groupReadsBack(s)) skips.add('stats.group', 'Open5e\'s item categories are coarser than equipment groups, so the group doesn\'t read back.');
  return {
    key: keyOf(`equipment/${item.entry.id}`),
    name: item.entry.name,
    desc: s.text === undefined ? '' : exportText(s.text, item.names, skips, 'stats.text'),
    category,
    weapon: weapon
      ? {
          name: item.entry.name,
          key: keyOf(`equipment/${item.entry.id}`),
          damage_type: summary(weapon.damage.type, word('damageType', weapon.damage.type)),
          damage_dice: weapon.damage.dice ?? String(weapon.damage.flat ?? ''),
          properties: [
            ...(weapon.properties ?? []).map((p) => ({ property: { name: name(p.ref), type: null }, detail: detail(p.ref) })),
            { property: { name: name(weapon.mastery.ref), type: 'Mastery' }, detail: null },
          ],
          is_melee: String(s.group.includes('melee')),
          is_simple: s.group.startsWith('simple'),
          is_martial: s.group.startsWith('martial'),
          is_improvised: false,
          distance_unit: 'feet',
        }
      : null,
    armor: s.armor
      ? {
          name: item.entry.name,
          key: keyOf(`equipment/${item.entry.id}`),
          category: Object.entries(ARMOR_GROUP).find(([, g]) => g === s.group)?.[0] ?? 'light',
          ac_base: s.armor.ac,
          ac_display: s.group === 'shields' ? `+${s.armor.ac}` : `${s.armor.ac}${s.armor.dex ? ` + Dex modifier${s.armor.dexMax !== undefined ? ` (max ${s.armor.dexMax})` : ''}` : ''}`,
          ac_add_dexmod: s.armor.dex === true,
          ac_cap_dexmod: s.armor.dexMax ?? null,
          grants_stealth_disadvantage: s.armor.stealthDisadvantage === true,
          strength_score_required: s.armor.strength ?? null,
        }
      : null,
    size: summary('tiny', 'Tiny'),
    weight: (s.weight ?? 0).toFixed(3),
    weight_unit: 'lb',
    cost: d.costGp === undefined ? null : d.costGp.toFixed(2),
    document: DOCUMENT,
    crossreferences: { to: [] },
  };
}

const truthy = (value: unknown): boolean => value === true || value === 'true';

export function importEquipment(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined {
  const name = String(record.name ?? '');
  const weapon = record.weapon as Record5e | null | undefined;
  const armor = record.armor as Record5e | null | undefined;
  if (weapon && weapon.is_melee === undefined) {
    skips.add('', 'Its weapon doesn\'t say whether it\'s melee or ranged, so it isn\'t imported.');
    return undefined;
  }
  const group = weapon
    ? `${truthy(weapon.is_simple) ? 'simple' : 'martial'}-${truthy(weapon.is_melee) ? 'melee' : 'ranged'}-weapons`
    : armor
      ? ARMOR_GROUP[String(armor.category)]
      : record.category?.key === 'adventuring-gear'
        ? 'adventuring-gear'
        : undefined;
  if (!group) {
    skips.add('', 'Its category doesn\'t name one equipment group, so it isn\'t imported.');
    return undefined;
  }
  const stats: Record<string, unknown> = { group };
  const cost = Number(record.cost);
  if (record.cost !== null && record.cost !== undefined && cost > 0) stats.cost = { amount: cost, unit: 'gp' };
  const weight = Number(record.weight);
  if (weight > 0) stats.weight = weight;
  if (typeof record.desc === 'string' && record.desc !== '') stats.text = record.desc;
  if (weapon) {
    const dice = String(weapon.damage_dice ?? '');
    const damage: Record<string, unknown> = /^\d+d\d+$/.test(dice) ? { dice } : { flat: Number(dice) };
    damage.type = String(weapon.damage_type?.key ?? '');
    const block: Record<string, unknown> = { damage };
    const properties: { ref: string }[] = [];
    for (const assigned of (weapon.properties ?? []) as Record5e[]) {
      const propertyName = String(assigned.property?.name ?? '');
      const mastery = assigned.property?.type === 'Mastery';
      const ref = resolveName(mastery ? 'mastery-property' : 'weapon-property', propertyName, context.names);
      if (!ref) {
        skips.add('stats.weapon', `No ${mastery ? 'mastery' : 'weapon'} property is named "${propertyName}".`);
        continue;
      }
      if (mastery) block.mastery = { ref };
      else properties.push({ ref });
      const detail = typeof assigned.detail === 'string' ? assigned.detail : '';
      const range = /Range (\d+)\/(\d+)/.exec(detail);
      if (range) block.range = { normal: Number(range[1]), long: Number(range[2]) };
      if (ref === 'weapon-property/versatile' && detail) block.versatile = detail;
      if (ref === 'weapon-property/ammunition') {
        const ammunition = detail.split('; ')[1];
        if (ammunition) block.ammunition = ammunition;
      }
    }
    if (properties.length) block.properties = properties;
    stats.weapon = block;
  }
  if (armor) {
    const block: Record<string, unknown> = { ac: Number(armor.ac_base) };
    if (armor.ac_add_dexmod === true) block.dex = true;
    if (armor.ac_cap_dexmod !== null && armor.ac_cap_dexmod !== undefined) block.dexMax = Number(armor.ac_cap_dexmod);
    if (armor.strength_score_required) block.strength = Number(armor.strength_score_required);
    if (armor.grants_stealth_disadvantage === true) block.stealthDisadvantage = true;
    stats.armor = block;
  }
  return { ruleset: context.ruleset, type: 'equipment', id: slug(name), name, stats };
}
