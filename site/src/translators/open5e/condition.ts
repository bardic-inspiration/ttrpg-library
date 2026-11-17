// Conditions to and from Open5e's Condition record (docs/export.md#open5e): the effects as one
// description, in the form Open5e gives the SRD 5.2 conditions.

import type { ConditionStats } from '../../../../rulesets/dnd-5e-2024/types.ts';
import { nounFor, sayText } from '../../lib/wording.ts';
import type { ImportContext, ImportedEntry, TranslatorItem } from '../types.ts';
import { DOCUMENT, DOCUMENT_KEY, keyOf, type Record5e } from './document.ts';
import { exportText, Skips, slug } from './text.ts';

export function exportCondition(item: TranslatorItem, skips: Skips): Record5e {
  const s = item.entry.stats as ConditionStats;
  const intro = sayText('condition.intro', { name: item.entry.name, effects: nounFor(s.effects.length, 'effect') });
  const effects = s.effects.map((e, i) => `* **${e.name}.** ${exportText(e.text, item.names, skips, `stats.effects[${i}].text`)}`);
  return {
    key: keyOf(`condition/${item.entry.id}`),
    document: DOCUMENT,
    icon: null,
    descriptions: [{ desc: `${intro}\n\n${effects.join('\n')}`, document: DOCUMENT_KEY, gamesystem: '5e-2024' }],
    name: item.entry.name,
    crossreferences: { to: [] },
  };
}

/** Reads "* **Name.** Text" lines, or Open5e's plain "* Name. Text". */
export function importCondition(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined {
  const name = String(record.name ?? '');
  const descriptions = (record.descriptions ?? []) as Record5e[];
  const desc = String((descriptions.find((d) => d.gamesystem === '5e-2024') ?? descriptions[0])?.desc ?? '');
  const effects = desc.split('\n').flatMap((line) => {
    const match = /^\* (?:\*\*(.+?)\.\*\*|(.+?)\.) (.+)$/.exec(line.trim());
    return match ? [{ name: match[1] ?? match[2] ?? '', text: match[3] ?? '' }] : [];
  });
  if (effects.length === 0) {
    skips.add('', 'Its description lists no effects the library can read, so it isn\'t imported.');
    return undefined;
  }
  return { ruleset: context.ruleset, type: 'condition', id: slug(name), name, stats: { effects } };
}
