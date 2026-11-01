// Gap buckets (SPEC.md §7.1): counts library records per bucket of a type's
// `gapBuckets` axes and builds each bucket's label. Ruleset-independent, with
// no dependencies, so the gap-fill picker and any future analytics share it.

/** One axis of a type's `gapBuckets` (§7.1). */
export type GapAxis = { path: string; bins: [number, number][] } | { path: string; enum: string[] };

/** One value of an axis: a numeric bin or a categorical value. */
type AxisValue = { bin: [number, number] } | { value: string };

/** The parts of a library.json record (§9.1) bucket counting reads. */
export interface GapRecord {
  ruleset: string;
  type: string;
  facets: Record<string, unknown>;
}

export interface Bucket {
  /** The §7.1 label, such as `stats.level=1..3&stats.school=evocation`. */
  label: string;
  count: number;
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
