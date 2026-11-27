// The kit's parts as an arrangement's page shows them (docs/site.md#kit-parts,
// docs/content-model.md#arrangements): each part's heading, each ref object's line and how it
// shows, a spawn table's and a loot part's rows in difficulty order, and the cards a part embeds.
// Composed text goes through the wording layer (docs/site.md#wording).

import { DIFFICULTIES } from '../../../rulesets/dnd-5e-2024/difficulty.ts';
import type { Difficulty, LootRow, Part, Show, SpawnRow } from '../../../rulesets/dnd-5e-2024/types.ts';
import { refObjectKey } from '../../../scripts/validate/refs.ts';
import type { LoadedEntry } from './library.ts';
import type { TextRefs } from './markdown.ts';
import type { TemplateMode } from './template.ts';
import { link, name, sayMarkdown, sayText, toMarkdown } from './wording.ts';

/** A ref object in a part: its target, an optional zone, count, and how it shows. */
export interface KitRef {
  ref: string;
  zone?: string;
  count?: number | string;
  show?: Show;
}

/** One ref as its part lists it: the line's markdown, and how the target shows beside it or after the part. */
export interface KitRefView {
  /** `<type>/<id>`, or a zone's `map/<id>#<zone-id>`. */
  key: string;
  /** The target entry's key, without a zone. */
  entry: string;
  zone?: string;
  /** The line: the name linked, after its count when it has one ("2 × {ref:equipment/dagger}"). */
  line: string;
  show: Show;
}

/** A ref object as its line: its count, when it has one, then its name linked. */
export function refView(value: KitRef): KitRefView {
  const key = refObjectKey(value);
  const target = link(key);
  const line = value.count === undefined ? toMarkdown(target) : sayMarkdown('kit.count', { count: String(value.count), target });
  return { key, entry: value.ref, ...(value.zone !== undefined && { zone: value.zone }), line, show: value.show ?? 'link' };
}

/** A part's heading, or none: a prose part without a title, and a table, whose title is its caption. */
export function partHeading(part: Part): string | undefined {
  switch (part.part) {
    case 'prose':
      return part.title;
    case 'table':
      return undefined;
    default:
      return sayText(`kit.heading.${part.part}`);
  }
}

/** A difficulty's display name: "Low", "Moderate", "High". */
export const difficultyName = (difficulty: Difficulty): string => name('difficulty', difficulty);

/** A keyed part's rows in difficulty order, low to high, leaving out a difficulty it has no row for. */
export const byDifficulty = <R>(rows: Partial<Record<Difficulty, R>>): { difficulty: Difficulty; row: R }[] =>
  DIFFICULTIES.flatMap((difficulty) => (rows[difficulty] ? [{ difficulty, row: rows[difficulty] }] : []));

/** A spawn table row's range on the roll: "1–2", or "6" for one face. */
export const rangeText = (range: NonNullable<SpawnRow['range']>): string =>
  range.min === range.max ? String(range.min) : sayText('kit.range', { min: String(range.min), max: String(range.max) });

/** A loot row's coins: "3d6 SP", "4d6 × 10 GP". */
export function coinsText(coins: NonNullable<LootRow['coins']>): string {
  const unit = name('coin', coins.unit);
  return coins.times === undefined
    ? sayText('kit.coins', { dice: coins.dice, unit })
    : sayText('kit.coinsTimes', { dice: coins.dice, times: String(coins.times), unit });
}

/** A loot row's contents as markdown: its coins, then its items with their counts, as a list. */
export const lootLine = (row: LootRow): string =>
  [...(row.coins ? [coinsText(row.coins)] : []), ...(row.items ?? []).map((item) => refView(item).line)].join(', ');

/** Every ref object in a part, in order: a roster's or spawn table's creatures, loot's items, a map part's map. */
export function partRefs(part: Part): KitRef[] {
  switch (part.part) {
    case 'roster':
      return part.creatures;
    case 'spawn-table':
      return byDifficulty(part.rows).flatMap(({ row }) => row.creatures);
    case 'loot':
      return byDifficulty(part.rows).flatMap(({ row }) => row.items ?? []);
    case 'map':
      return [part.map];
    default:
      return [];
  }
}

/**
 * The refs a part shows as cards, after it, each target once in the order the part first lists
 * it: a spawn table that shows a creature's card in two rows shows it once.
 */
export function partCards(part: Part): KitRefView[] {
  const seen = new Set<string>();
  return partRefs(part)
    .map(refView)
    .filter((view) => view.show === 'card' && !seen.has(view.entry) && seen.add(view.entry));
}

/** What every kit part component takes: how to render text and refs, and the entries the page embeds. */
export interface KitContext {
  refs: TextRefs;
  /** `<type>/<id>` → the loaded entry a part shows as a card or thumbnail. */
  shown: Map<string, LoadedEntry>;
  mode: TemplateMode;
  /** The part's heading level; a stage or an embedded card sits one below it. */
  level: number;
  /** A map's diagram source, by its key. */
  diagram: (key: string) => string;
}
