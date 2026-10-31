// The contract every ruleset folder's index.ts meets (SPEC.md §6.2). The
// validator, index builder, and site load a ruleset through it, so each
// derived value is computed in exactly one place.

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
}

/** How a detail page labels a reference, from each end: "Casts: Frost Lance", "Cast by: Wand of Frost Lances". */
export interface RefLabels {
  forward: string;
  back: string;
}

export interface RulesetModule {
  definition: RulesetDefinition;
  /** Derived values for one entry's schema-valid `stats`; `{}` for a type with no formulas. */
  derive(type: string, stats: unknown): Record<string, unknown>;
  /** Consistency checks for one entry's schema-valid `stats` (§6.8). */
  check(type: string, stats: unknown): Issue[];
  /** Labels for a ref at `path` (such as `stats.spells[0].spell`) in an entry of `type` (§5.7). */
  refLabels(type: string, path: string): RefLabels;
}
