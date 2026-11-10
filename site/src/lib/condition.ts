// Text for a dnd-5e-2024 condition (docs/rulesets.md#conditions): the opening sentence every SRD
// condition prints, from the phrase book, worded from the name and the number of effects.

import type { ConditionStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { nounFor, sayText } from './wording.ts';

/** "While you have the Poisoned condition, you experience the following effect." */
export const conditionIntro = (name: string, s: ConditionStats): string =>
  sayText('condition.intro', { name, effects: nounFor(s.effects.length, 'effect') });
