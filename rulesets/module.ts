// The contract every ruleset folder's index.ts meets (docs/rulesets.md#the-ruleset-module). The
// validator, index builder, and site load a ruleset through it, so each
// derived value is computed in exactly one place.

import type { RulesData } from '../lib/rules.ts';
import type { PhraseBook } from '../lib/wording/book.ts';

export interface Issue {
  level: 'error' | 'warning';
  /** Where in the entry, such as `stats.actions[0].text`. */
  path: string;
  message: string;
}

export interface RulesetDefinition {
  id: string;
  /** Who publishes the ruleset; an entry whose `author` is `"publisher"` is theirs (docs/rulesets.md#the-ruleset-module). */
  publisher: string;
  types: string[];
  /** Rules types, whose primitives are kept in rules/ (docs/rulesets.md#rules-data). Omitted for none. */
  rules?: { type: string; extensions: boolean }[];
  /**
   * Component types: hidden sub-entries a page type lists and shows on its page
   * (docs/content-model.md#components), each with the types that may list it. Omitted for none.
   */
  components?: { type: string; parents: string[] }[];
}

/** A resolved ref target's type and stats, or undefined for one whose stats failed their schema. */
export type LinkTarget = (key: string) => { type: string; stats: unknown } | undefined;

/** The key (`<type>/<id>`) of the entry or component of `type` with exactly this name in the same ruleset, if any. */
export type NameLookup = (type: string, name: string) => string | undefined;

/** An entry or component of the library, for values derived from other entries. */
export interface LinkedEntry {
  type: string;
  id: string;
  name: string;
  stats: unknown;
  /** Who wrote it; `"publisher"` marks official content (docs/content-model.md#source-and-author). */
  author?: string;
}

/** The `author` that names the ruleset's publisher (docs/content-model.md#source-and-author). */
export const PUBLISHER = 'publisher';

/**
 * Whether an entry is official content: written by its ruleset's publisher, as opposed to homebrew
 * (docs/content-model.md#source-and-author). The one place official and homebrew are told apart.
 */
export const isOfficial = (entry: object): boolean => (entry as { author?: unknown }).author === PUBLISHER;

/** How a detail page labels a reference, from each end: "Casts: Frost Lance", "Cast by: Wand of Frost Lances". */
export interface RefLabels {
  forward: string;
  back: string;
}

export interface RulesetModule {
  definition: RulesetDefinition;
  /**
   * Derived values for one entry's or primitive's schema-valid `stats`; `{}` for a type with no
   * formulas. `rules` is the ruleset's rules data, for values that read it (an equipment's category).
   */
  derive(type: string, stats: unknown, rules?: RulesData): Record<string, unknown>;
  /**
   * Consistency checks for one entry's or primitive's schema-valid `stats` (docs/rulesets.md#consistency-checks),
   * with the ruleset's rules data and whether the entry is official content.
   */
  check(type: string, stats: unknown, rules?: RulesData, context?: { official: boolean }): Issue[];
  /**
   * Checks that read what an entry's refs point to (docs/rulesets.md#consistency-checks), such as a
   * background's feat being an origin feat. They run after every ref resolves; `target` gives a
   * resolved target's type and stats, or undefined for one whose stats failed their schema. Optional.
   */
  checkLinks?(type: string, stats: unknown, target: LinkTarget, named: NameLookup): Issue[];
  /**
   * Derived values that read other entries, such as a class's spell list from the spells that name
   * it. `key` is the entry's `<type>/<id>`, and `entries` every entry and component of its ruleset.
   * The site merges them into the entry's derived values. Optional.
   */
  deriveLinked?(type: string, key: string, stats: unknown, entries: readonly LinkedEntry[]): Record<string, unknown>;
  /**
   * Renders the ruleset's text tokens (docs/rulesets.md#text-tokens) in one text of an entry of `type`,
   * from the entry's derived values, so a token shows only what the module derives. `{ref:…}` is left
   * as written. Throws on a bad token; `check` reports bad tokens first. Optional: without it, or for a
   * type with no tokens, text shows as written.
   */
  renderTokens?(type: string, text: string, derived: Record<string, unknown>): string;
  /** The ruleset's phrase book (docs/site.md#wording): its fixed sentences and the display names of its enum values. */
  phrases: PhraseBook;
  /** Labels for a ref at `path` (such as `stats.spells[0].spell`) in an entry of `type` (docs/content-model.md#references). */
  refLabels(type: string, path: string): RefLabels;
}
