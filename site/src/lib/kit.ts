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
import { link, name, say, sayText, toMarkdown, withNote } from './wording.ts';

/** A ref object in a part: its target, an optional zone, count, and how it shows. */
export interface KitRef {
  ref: string;
  zone?: string;
  count?: number | string;
  /** A hook's ref: who or what it is to the hook ("the party's contact"). */
  note?: string;
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

/** A ref object as its line: its count, when it has one, then its name linked, then its note, when it has one. */
export function refView(value: KitRef): KitRefView {
  const key = refObjectKey(value);
  const target = link(key);
  const counted = value.count === undefined ? target : say('kit.count', { count: String(value.count), target });
  const line = toMarkdown(withNote(counted, value.note));
  return { key, entry: value.ref, ...(value.zone !== undefined && { zone: value.zone }), line, show: value.show ?? 'link' };
}

/**
 * A part's heading, or none: a prose part without a title, a table, whose title is its caption, and
 * an arrangement, which its contained entry's name heads. A DM guide names its arrangement's type:
 * "Running the Encounter", "Running the Module".
 */
export function partHeading(part: Part, arrangement = 'encounter'): string | undefined {
  switch (part.part) {
    case 'prose':
      return part.title;
    case 'table':
    case 'arrangement':
      return undefined;
    case 'dm-guide':
      return sayText('kit.heading.dm-guide', { arrangement: name('arrangement', arrangement) });
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

/**
 * Every ref object in a part, in order: a roster's or spawn table's creatures, loot's items, a map
 * part's map, a hook's refs, and an arrangement part's arrangement.
 */
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
    case 'hook':
      return part.refs ?? [];
    case 'arrangement':
      return [part.arrangement];
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
  /** Diagram sources the caller has to hand, by map key, passed on to the cards a part embeds. */
  diagrams?: Map<string, string>;
  /** The arrangement's type, for the headings that name it ("Running the Module"). Default `encounter`. */
  arrangement?: string;
}
