// The source allowlist (docs/licensing.md#source-allowlist): config/licenses.json, the one list of
// licenses the library accepts outside material under, by the kind of material. Pure, so the
// validator, the import script, and the site share it.

export interface License {
  name: string;
  /** The legal code. */
  url: string;
}

/** config/licenses.json. */
export interface Licenses {
  /** Every license by id: an SPDX id, or `public-domain`. */
  licenses: Record<string, License>;
  /** The license ids accepted for each kind of material, such as `import` and `art`. */
  kinds: Record<string, string[]>;
}

const ID = /^([A-Za-z0-9.+-]+)$/;

/** Problems with a licenses object, one message per problem; empty when it is valid. */
export function checkLicenses(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['must be an object with `licenses` and `kinds`'];
  const problems: string[] = [];
  const { licenses, kinds, ...rest } = data as Record<string, unknown>;
  for (const key of Object.keys(rest)) problems.push(`${key}: unknown key`);
  const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObject(licenses)) problems.push('licenses: must be an object');
  if (!isObject(kinds)) problems.push('kinds: must be an object');
  if (!isObject(licenses) || !isObject(kinds)) return problems;
  for (const [id, license] of Object.entries(licenses as Record<string, unknown>)) {
    if (!ID.test(id)) problems.push(`licenses.${id}: an id is an SPDX id or "public-domain"`);
    const { name, url, ...extra } = (license ?? {}) as Record<string, unknown>;
    if (typeof name !== 'string' || name === '') problems.push(`licenses.${id}.name: must be a non-empty string`);
    if (typeof url !== 'string' || !/^https:\/\/\S+$/.test(url)) problems.push(`licenses.${id}.url: must be an https URL`);
    for (const key of Object.keys(extra)) problems.push(`licenses.${id}.${key}: unknown key`);
  }
  for (const [kind, ids] of Object.entries(kinds as Record<string, unknown>)) {
    if (!Array.isArray(ids) || ids.length === 0) {
      problems.push(`kinds.${kind}: must be a non-empty list of license ids`);
      continue;
    }
    for (const id of ids) if (typeof id !== 'string' || !(id in (licenses as object))) problems.push(`kinds.${kind}: "${String(id)}" isn't in licenses`);
    if (new Set(ids).size !== ids.length) problems.push(`kinds.${kind}: lists a license twice`);
  }
  return problems;
}

/** Whether `id` is accepted for `kind` of material. */
export const accepts = (data: Licenses, kind: string, id: string): boolean => data.kinds[kind]?.includes(id) ?? false;
