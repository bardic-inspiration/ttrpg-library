// Starting equipment as SRD 5.2 words it (docs/rulesets.md#starting-equipment), for classes and
// backgrounds: lettered options, each a list of items and coins. The result is markdown, with each
// ref a `{ref:…}` token, so it renders as the target's name linked to its rules anchor or page.

import type { StartingItem, StartingOption } from '../../../rulesets/dnd-5e-2024/types.ts';
import { escapeMarkdown } from './markdown.ts';

/** One item: "Robe", "Parchment (10 sheets)", "2 Daggers", or text as written. */
export function startingItem(item: StartingItem): string {
  if (typeof item === 'string') return item;
  const name = item.count === undefined ? `{ref:${item.ref}}` : `${item.count} {ref:${item.ref}}s`;
  return item.note === undefined ? name : `${name} (${escapeMarkdown(item.note)})`;
}

/**
 * The options, lettered: "Choose A or B: (A) Greataxe, 4 Handaxes, and 15 GP; or (B) 75 GP".
 * `and` joins an option's last part with "and", as the class chapter prints it; the background
 * chapter doesn't ("Robe, 8 GP").
 */
export function startingEquipment(options: StartingOption[], { and }: { and: boolean }): string {
  const letters = options.map((_, i) => String.fromCharCode(65 + i));
  const choose = letters.length === 2 ? letters.join(' or ') : `${letters.slice(0, -1).join(', ')}, or ${letters.at(-1)}`;
  const parts = options.map((option, i) => {
    const words = [...(option.items ?? []).map(startingItem), ...(option.gp === undefined ? [] : [`${option.gp} GP`])];
    const joined =
      and && words.length > 1
        ? words.length === 2
          ? words.join(' and ')
          : `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`
        : words.join(', ');
    return `(${letters[i]}) ${joined}`;
  });
  return `Choose ${choose}: ${parts.slice(0, -1).join('; ')}; or ${parts.at(-1)}`;
}
