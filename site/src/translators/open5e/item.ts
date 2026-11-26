// Magic items to and from Open5e's MagicItem record (docs/export.md#open5e).

import type { ItemStats } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { name as word, phrases } from '../../lib/wording.ts';
import type { ImportContext, ImportedEntry, TranslatorItem } from '../types.ts';
import { DOCUMENT, keyOf, summary, type Record5e } from './document.ts';
import { exportText, Skips, slug } from './text.ts';

/** Open5e's rarity ranks, most common lowest. */
const RANK: Record<string, number> = { common: 1, uncommon: 2, rare: 3, 'very-rare': 4, legendary: 5, artifact: 6 };

/** An item Open5e can't hold, or undefined: Open5e has no rarity that varies. */
export const unexportableItem = (s: ItemStats): string | undefined =>
  RANK[s.rarity] === undefined ? 'Open5e has no rarity for an item whose rarity varies, so it isn\'t exported.' : undefined;

export function exportItem(item: TranslatorItem, skips: Skips): Record5e {
  const s = item.entry.stats as ItemStats;
  const dropped: [keyof ItemStats, string][] = [
    ['baseItem', 'Open5e has no field for a magic item\'s base item.'],
    ['charges', 'Open5e has no field for charges.'],
    ['spells', 'Open5e has no field for the spells an item casts.'],
    ['cursed', 'Open5e has no field for a curse.'],
    ['statBlocks', 'Open5e has no field for an embedded stat block.'],
    ['modifiers', 'Open5e has no field for an item\'s modifiers.'],
  ];
  for (const [key, reason] of dropped) if (s[key] !== undefined) skips.add(`stats.${key}`, reason);
  const requirement = s.attunement.requirement;
  if (requirement !== undefined && requirement.length > 128) skips.add('stats.attunement.requirement', 'Open5e\'s attunement detail holds 128 characters.');
  return {
    key: keyOf(`item/${item.entry.id}`),
    name: item.entry.name,
    desc: exportText(s.effect, item.names, skips, 'stats.effect'),
    category: summary(s.category, word('itemCategory', s.category)),
    rarity: { ...summary(s.rarity, word('rarity', s.rarity)), rank: RANK[s.rarity] },
    is_magic_item: 'true',
    weapon: null,
    armor: null,
    // Open5e gives an item without a size its default, Tiny, and no weight or cost as zero.
    size: summary('tiny', 'Tiny'),
    weight: '0.000',
    weight_unit: 'lb',
    cost: null,
    requires_attunement: s.attunement.required,
    attunement_detail: requirement !== undefined && requirement.length <= 128 ? requirement : null,
    document: DOCUMENT,
    crossreferences: { to: [] },
  };
}

export function importItem(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined {
  const name = String(record.name ?? '');
  const category = String(record.category?.key ?? '');
  const rarity = String(record.rarity?.key ?? '');
  const problems = [
    !phrases.vocabulary.itemCategory?.[category] ? 'a magic item category' : '',
    RANK[rarity] === undefined ? 'a rarity' : '',
  ].filter(Boolean);
  if (problems.length) {
    skips.add('', `It has no ${problems.join(' or ')} the library knows, so it isn't imported.`);
    return undefined;
  }
  const attunement: ItemStats['attunement'] = { required: record.requires_attunement === true };
  if (attunement.required && typeof record.attunement_detail === 'string' && record.attunement_detail !== '') {
    attunement.requirement = record.attunement_detail;
  }
  return {
    ruleset: context.ruleset,
    type: 'item',
    id: slug(name),
    name,
    stats: { category, rarity, attunement, effect: String(record.desc ?? '') },
  };
}
