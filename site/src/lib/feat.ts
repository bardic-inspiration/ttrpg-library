// Text for a dnd-5e-2024 feat (docs/rulesets.md#feats): the category line under its name, with
// its prerequisite, and the sentence that opens titled benefits.

import type { FeatStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { formatTitle } from './format.ts';

/** The sentence every SRD feat with titled benefits opens with. */
export const FEAT_BENEFITS_INTRO = 'You gain the following benefits.';

/**
 * "Origin Feat", or "General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)", as markdown:
 * the prerequisite is rules text and may hold tokens.
 */
export function featHeading(s: FeatStats): string {
  const prerequisite = [...(s.level === undefined ? [] : [`Level ${s.level}+`]), ...(s.prerequisite === undefined ? [] : [s.prerequisite])];
  const category = `${formatTitle(s.category)} Feat`;
  return prerequisite.length === 0 ? category : `${category} (Prerequisite: ${prerequisite.join(', ')})`;
}
