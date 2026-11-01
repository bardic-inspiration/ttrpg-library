// The gap-fill picker (SPEC.md §7.1, §8.2 step 5): counts library entries per
// gap bucket and chooses the type and bucket to fill.

/** One axis of a type's `gapBuckets` (§7.1). */
export type GapAxis = { path: string; bins: [number, number][] } | { path: string; enum: string[] };

/** One value of an axis: a numeric bin or a categorical value. */
type AxisValue = { bin: [number, number] } | { value: string };

/** The parts of a library.json record (§9.1) the picker reads. */
export interface GapRecord {
  ruleset: string;
  type: string;
  facets: Record<string, unknown>;
}

/** The parts of config/types.json (§7) the picker reads. */
export type GapRegistry = Record<string, { types: Record<string, { gapBuckets?: GapAxis[] }> }>;

export interface Bucket {
  /** The §7.1 label, such as `stats.level=1..3&stats.school=evocation`. */
  label: string;
  count: number;
}

export interface GapPick {
  ruleset: string;
  type: string;
  bucket: Bucket;
  /** Entries of the type overall, in any bucket or none. */
  typeCount: number;
}

const axisValues = (axis: GapAxis): AxisValue[] =>
  'bins' in axis ? axis.bins.map((bin) => ({ bin })) : axis.enum.map((value) => ({ value }));

const valueLabel = (value: AxisValue): string => ('bin' in value ? `${value.bin[0]}..${value.bin[1]}` : value.value);

/**
 * Whether a facet value falls in a bin or equals a categorical value. A
 * missing value matches nothing; an array value (a multi-valued enum facet)
 * matches each value it holds.
 */
function matches(facet: unknown, value: AxisValue): boolean {
  if (facet === undefined || facet === null) return false;
  if (Array.isArray(facet)) return facet.some((item) => matches(item, value));
  if ('bin' in value) return typeof facet === 'number' && facet >= value.bin[0] && facet <= value.bin[1];
  return String(facet) === value.value;
}

/** Every combination of one value per axis, first axis outermost (§7.1). */
function combinations(axes: GapAxis[]): { path: string; value: AxisValue }[][] {
  return axes.reduce<{ path: string; value: AxisValue }[][]>(
    (combos, axis) => combos.flatMap((combo) => axisValues(axis).map((value) => [...combo, { path: axis.path, value }])),
    [[]],
  );
}

/** Each bucket of a type with its entry count, in `gapBuckets` order. */
export function countBuckets(axes: GapAxis[], records: GapRecord[]): Bucket[] {
  if (axes.length === 0) return [];
  return combinations(axes).map((combo) => ({
    label: combo.map(({ path, value }) => `${path}=${valueLabel(value)}`).join('&'),
    count: records.filter((record) => combo.every(({ path, value }) => matches(record.facets[path], value))).length,
  }));
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
