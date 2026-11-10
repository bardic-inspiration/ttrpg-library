// A small ruleset for testing rules data (docs/rulesets.md#rules-data) and page types: content types
// `note` and `manual` (a page type with `chapter` components);
// a primitive-only rules type, `term`; and a rules type with groups and
// extensions, `gear`.

import type { RulesetModule } from '../../../../../rulesets/module.ts';
import definition from './ruleset.json' with { type: 'json' };

export const ruleset: RulesetModule = {
  definition,
  phrases: { sentences: {}, vocabulary: {}, plurals: {}, articles: {} },
  derive: () => ({}),
  check: () => [],
  refLabels: (type, path) =>
    type === 'note' && path.startsWith('stats.gear[') ? { forward: 'Uses', back: 'Used by' } : { forward: 'References', back: 'Referenced by' },
};
