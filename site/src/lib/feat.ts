// Text for a dnd-5e-2024 feat (docs/rulesets.md#feats): the category line under its name, with
// its prerequisite, and the sentences around its benefits, from the phrase book.

import type { FeatStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import { joinWith, markdown, name, say, sayText, toMarkdown, type Phrase } from './wording.ts';

/** The sentence every SRD feat with titled benefits opens with. */
export const FEAT_BENEFITS_INTRO = sayText('feat.benefits');

/** The title of the closing "Repeatable." paragraph. */
export const FEAT_REPEATABLE = sayText('feat.repeatable');

/**
 * "Origin Feat", or "General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)", as markdown:
 * the prerequisite is rules text and may hold tokens.
 */
export function featHeading(s: FeatStats): string {
  const category = name('featCategory', s.category);
  const parts: Phrase[] = [
    ...(s.level === undefined ? [] : [say('feat.level', { level: String(s.level) })]),
    ...(s.prerequisite === undefined ? [] : [markdown(s.prerequisite)]),
  ];
  return toMarkdown(
    parts.length === 0 ? say('feat.heading', { category }) : say('feat.headingWithPrerequisite', { category, prerequisite: joinWith(parts, ', ') }),
  );
}
