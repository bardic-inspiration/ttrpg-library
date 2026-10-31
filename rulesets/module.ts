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

export interface RulesetModule {
  definition: RulesetDefinition;
  /** Derived values for one entry's schema-valid `stats`; `{}` for a type with no formulas. */
  derive(type: string, stats: unknown): Record<string, unknown>;
  /** Consistency checks for one entry's schema-valid `stats` (§6.8). */
  check(type: string, stats: unknown): Issue[];
}
