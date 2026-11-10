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
  label: string;
  srdVersion: string;
  attribution: string;
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

/** An entry or component of the library, for values derived from other entries. */
export interface LinkedEntry {
  type: string;
  id: string;
  name: string;
  stats: unknown;
}

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
   * with the ruleset's rules data and whether the entry is an SRD entry.
   */
  check(type: string, stats: unknown, rules?: RulesData, context?: { srd: boolean }): Issue[];
  /**
   * Checks that read what an entry's refs point to (docs/rulesets.md#consistency-checks), such as a
   * background's feat being an origin feat. They run after every ref resolves; `target` gives a
   * resolved target's type and stats, or undefined for one whose stats failed their schema. Optional.
   */
  checkLinks?(type: string, stats: unknown, target: LinkTarget): Issue[];
  /**
   * Derived values that read other entries, such as a class's spell list from the spells that name
   * it. `key` is the entry's `<type>/<id>`, and `entries` every entry and component of its ruleset.
   * The site merges them into the entry's derived values. Optional.
   */
  deriveLinked?(type: string, key: string, stats: unknown, entries: readonly LinkedEntry[]): Record<string, unknown>;
  /** The ruleset's phrase book (docs/site.md#wording): its fixed sentences and the display names of its enum values. */
  phrases: PhraseBook;
  /** Labels for a ref at `path` (such as `stats.spells[0].spell`) in an entry of `type` (docs/content-model.md#references). */
  refLabels(type: string, path: string): RefLabels;
}
