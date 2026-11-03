// References between entries (SPEC.md §5.7, §6.8 "Every ref resolves"):
// `{ "ref": "<type>/<id>" }` objects at `RefOrText` fields, and `{ref:<type>/<id>}`
// tokens in text. Pure functions with no Node imports, so the validator, the
// index builder, and the site all link entries the same way.

/** A ref found in an entry: a `{ "ref": … }` object, or a `{ref:…}` token in a string. */
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
  /** Searched for `{ref:…}` tokens, before `stats`. */
  description?: string;
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

/** The keys a `Ref` object may have (§5.7): `ref`, and an optional `note`. */
const REF_KEYS = new Set(['ref', 'note']);

export const isRef = (value: unknown): value is { ref: string; note?: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => REF_KEYS.has(key)) &&
  typeof (value as { ref?: unknown }).ref === 'string';

/**
 * A link written in text (§5.7): `{ref:<type>/<id>}`. It renders as the
 * target's current name, linked to its page. The validator allows it only in
 * markdown-subset fields.
 */
export const REF_TOKEN = /\{ref:([^{}]*)\}/g;

/** What a `{ref:…}` token must hold: a type and an id. */
const REF_KEY = /^[a-z][a-z0-9-]*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A `{ref:…}` token whose inside isn't `<type>/<id>`. */
export interface MalformedRef {
  path: string;
  raw: string;
}

/** The `{ref:…}` tokens in one string, in order. */
export function textRefs(text: string, path: string): { refs: FoundRef[]; malformed: MalformedRef[] } {
  const refs: FoundRef[] = [];
  const malformed: MalformedRef[] = [];
  for (const match of text.matchAll(REF_TOKEN)) {
    const key = match[1] ?? '';
    if (REF_KEY.test(key)) refs.push({ path, ref: key });
    else malformed.push({ path, raw: match[0] });
  }
  return { refs, malformed };
}

/**
 * Every ref in schema-valid `stats`, in document order: `{ ref }` objects
 * and `{ref:…}` tokens in its strings. The schemas allow the `Ref` shape only
 * at `RefOrText` fields, so any object that is `{ ref: string }`, with an
 * optional `note`, is a reference.
 */
export function collectRefs(stats: unknown, path = 'stats', malformed: MalformedRef[] = []): FoundRef[] {
  if (isRef(stats)) return [{ path, ref: stats.ref }];
  if (typeof stats === 'string') {
    const found = textRefs(stats, path);
    malformed.push(...found.malformed);
    return found.refs;
  }
  if (Array.isArray(stats)) return stats.flatMap((item, i) => collectRefs(item, `${path}[${i}]`, malformed));
  if (typeof stats === 'object' && stats !== null) {
    return Object.entries(stats).flatMap(([key, value]) => collectRefs(value, `${path}.${key}`, malformed));
  }
  return [];
}

/**
 * Resolves every ref against the library and computes back-references. A ref
 * fails when no entry of its type has its id (IDs are unique per type,
 * §5.2), or when the target is in another ruleset (not allowed in v1). Links
 * are keyed by `<type>/<id>`; only resolved refs become links.
 */
export function linkEntries(entries: RefEntry[]): { links: Map<string, Links>; issues: RefIssue[] } {
  const byKey = new Map<string, RefEntry>();
  const byId = new Map<string, RefEntry>();
  for (const entry of entries) {
    if (!byKey.has(entryKey(entry))) byKey.set(entryKey(entry), entry);
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
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
    const malformed: MalformedRef[] = [];
    const found = [
      ...(entry.description === undefined ? [] : collectRefs(entry.description, 'description', malformed)),
      ...collectRefs(entry.stats, 'stats', malformed),
    ];
    for (const { path, raw } of malformed) {
      issues.push({ file: entry.file, message: `${path}: ref token ${raw} is malformed; write {ref:<type>/<id>}, such as {ref:spell/fireball}` });
    }
    for (const { path, ref } of found) {
      const slash = ref.indexOf('/');
      const [type, id] = [ref.slice(0, slash), ref.slice(slash + 1)];
      const target = byKey.get(ref);
      const other = byId.get(id);
      let problem: string | undefined;
      if (!target && other) problem = `no ${type} has id "${id}"; "${id}" is a ${other.type}`;
      else if (!target) problem = `no ${type} has id "${id}"`;
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
