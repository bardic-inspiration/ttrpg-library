// Text for a dnd-5e-2024 condition (docs/rulesets.md#conditions): the opening sentence every SRD
// condition prints, worded from the name and the number of effects.

import type { ConditionStats } from '../../../rulesets/dnd-5e-2024/types.ts';

/** "While you have the Poisoned condition, you experience the following effect." */
export const conditionIntro = (name: string, s: ConditionStats): string =>
  `While you have the ${name} condition, you experience the following ${s.effects.length === 1 ? 'effect' : 'effects'}.`;
