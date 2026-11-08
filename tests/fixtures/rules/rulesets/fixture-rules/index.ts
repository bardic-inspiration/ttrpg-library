// A small ruleset for testing rules data (docs/rulesets.md#rules-data): one content type, `note`;
// a primitive-only rules type, `term`; and a rules type with groups and
// extensions, `gear`.

import type { RulesetModule } from '../../../../../rulesets/module.ts';
import definition from './ruleset.json' with { type: 'json' };

export const ruleset: RulesetModule = {
  definition,
  derive: () => ({}),
  check: () => [],
  refLabels: (type, path) =>
    type === 'note' && path.startsWith('stats.gear[') ? { forward: 'Uses', back: 'Used by' } : { forward: 'References', back: 'Referenced by' },
};
