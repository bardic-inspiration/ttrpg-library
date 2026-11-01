// The gap-fill picker (SPEC.md §8.2 step 5): chooses the type and gap bucket
// (§7.1) a gap-fill run generates for. Counting lives in lib/buckets.ts.

import { countBuckets, type Bucket, type GapAxis, type GapRecord } from '../../lib/buckets.ts';

/** The parts of config/types.json (§7) the picker reads. */
export type GapRegistry = Record<string, { types: Record<string, { gapBuckets?: GapAxis[] }> }>;

export interface GapPick {
  ruleset: string;
  type: string;
  bucket: Bucket;
  /** Entries of the type overall, in any bucket or none. */
  typeCount: number;
}

/**
 * The type and bucket with the fewest entries in a ruleset (§8.2 step 5).
 * Ties between types go to the type with the fewest entries overall, then to
 * the first in config/types.json; ties within a type go to the first bucket in
 * `gapBuckets` order. Undefined when no type of the ruleset has gap buckets.
 */
export function pickGap(records: GapRecord[], registry: GapRegistry, ruleset: string): GapPick | undefined {
  const types = registry[ruleset]?.types ?? {};
  let best: GapPick | undefined;
  for (const [type, config] of Object.entries(types)) {
    const ofType = records.filter((record) => record.ruleset === ruleset && record.type === type);
    const buckets = countBuckets(config.gapBuckets ?? [], ofType);
    if (buckets.length === 0) continue;
    const bucket = buckets.reduce((min, b) => (b.count < min.count ? b : min));
    const pick = { ruleset, type, bucket, typeCount: ofType.length };
    if (
      !best ||
      bucket.count < best.bucket.count ||
      (bucket.count === best.bucket.count && pick.typeCount < best.typeCount)
    ) {
      best = pick;
    }
  }
  return best;
}
