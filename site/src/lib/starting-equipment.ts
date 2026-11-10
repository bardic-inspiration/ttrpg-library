// Starting equipment (docs/rulesets.md#starting-equipment), for classes and backgrounds: lettered
// options, each a list of items and coins, worded through the phrase book. The result is markdown,
// with each ref a `{ref:…}` token, so it renders as the target's name linked to its rules anchor or page.

import type { StartingItem, StartingOption } from '../../../rulesets/dnd-5e-2024/types.ts';
import { concat, joinWith, link, list, markdown, pluralLink, say, sayMarkdown, toMarkdown, withNote, type Phrase } from './wording.ts';

/** One item: "Robe", "Parchment (10 sheets)", "2 Daggers", or text as written. */
export function startingItem(item: StartingItem, names: Map<string, string> = new Map()): Phrase {
  if (typeof item === 'string') return markdown(item);
  const counted = item.count === undefined ? link(item.ref) : concat(`${item.count} `, pluralLink(item.ref, names));
  return withNote(counted, item.note);
}

/** The option letters: "A or B", "A, B, or C". */
const lettersFor = (n: number): string[] => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

/**
 * The options, lettered: "Choose A or B: (A) Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP; or (B) 75 GP",
 * every option's parts joined as an English list.
 */
export function startingEquipment(options: StartingOption[], names: Map<string, string> = new Map()): string {
  const letters = lettersFor(options.length);
  const parts = options.map((option, i) =>
    say('startingEquipment.option', {
      letter: letters[i]!,
      items: list([...(option.items ?? []).map((item) => startingItem(item, names)), ...(option.gp === undefined ? [] : [say('coins.gp', { amount: String(option.gp) })])], 'and'),
    }),
  );
  return sayMarkdown('startingEquipment.choose', { letters: list(letters, 'or'), options: concat(joinWith(parts.slice(0, -1), '; '), parts.length > 1 ? '; or ' : '', parts.at(-1)!) });
}

export { toMarkdown };
