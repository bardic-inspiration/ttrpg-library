// References between entries (SPEC.md §5.7, §6.8 "Every ref resolves").
// Pure functions with no Node imports, so the validator, the index builder,
// and the site all link entries the same way.

/** A `{ "ref": "<type>/<id>" }` found in an entry's `stats`. */
export interface FoundRef {
  /** Where in the entry, such as `stats.spells[0].spell`. */
  path: string;
  /** The ref value, `<type>/<id>`. */
  ref: string;
}

/** The fields of an entry that linking needs. */
export interface RefEntry {
  file: string;
  ruleset: string;
  type: string;
  id: string;
  /** Omitted for an entry that failed its `stats` schema: it can be a target but contributes no refs. */
  stats?: unknown;
}

/** One link from one entry to another, as both ends see it. */
export interface Link {
  /** Where the ref sits in the referring entry, such as `stats.spells[0].spell`. */
  path: string;
  /** The other end, `<type>/<id>`: the target of a forward link, the referrer of a back-link. */
  key: string;
}

export interface Links {
  refs: Link[];
  refBy: Link[];
}

export interface RefIssue {
  file: string;
  message: string;
}

export const entryKey = (entry: { type: string; id: string }): string => `${entry.type}/${entry.id}`;

const isRef = (value: unknown): value is { ref: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  typeof (value as { ref?: unknown }).ref === 'string';

/**
 * Every ref in schema-valid `stats`, in document order. The schemas allow the
 * `Ref` shape only at `RefOrText` fields, so any object that is exactly
 * `{ ref: string }` is a reference.
 */
export function collectRefs(stats: unknown, path = 'stats'): FoundRef[] {
  if (isRef(stats)) return [{ path, ref: stats.ref }];
  if (Array.isArray(stats)) return stats.flatMap((item, i) => collectRefs(item, `${path}[${i}]`));
  if (typeof stats === 'object' && stats !== null) {
    return Object.entries(stats).flatMap(([key, value]) => collectRefs(value, `${path}.${key}`));
  }
  return [];
}

/**
 * Resolves every ref against the library and computes back-references. A ref
 * fails when no entry has its id, when that entry's type differs from the
 * ref's prefix, or when it is in another ruleset (not allowed in v1). Links
 * are keyed by `<type>/<id>`; only resolved refs become links.
 */
export function linkEntries(entries: RefEntry[]): { links: Map<string, Links>; issues: RefIssue[] } {
  const byId = new Map<string, RefEntry>();
  for (const entry of entries) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  const links = new Map<string, Links>();
  const linksOf = (key: string): Links => {
    let found = links.get(key);
    if (!found) links.set(key, (found = { refs: [], refBy: [] }));
    return found;
  };
  for (const entry of entries) linksOf(entryKey(entry));

  const issues: RefIssue[] = [];
  for (const entry of entries) {
    if (entry.stats === undefined) continue;
    const from = entryKey(entry);
    for (const { path, ref } of collectRefs(entry.stats)) {
      const slash = ref.indexOf('/');
      const [type, id] = [ref.slice(0, slash), ref.slice(slash + 1)];
      const target = byId.get(id);
      let problem: string | undefined;
      if (!target) problem = `no entry has id "${id}"`;
      else if (target.type !== type) problem = `"${id}" is a ${target.type}, not a ${type}`;
      else if (target.ruleset !== entry.ruleset) problem = `"${id}" is in ${target.ruleset}; refs can't cross rulesets in v1`;
      if (problem || !target) {
        issues.push({ file: entry.file, message: `${path}: ref "${ref}" does not resolve: ${problem}` });
        continue;
      }
      linksOf(from).refs.push({ path, key: ref });
      linksOf(ref).refBy.push({ path, key: from });
    }
  }
  return { links, issues };
}
