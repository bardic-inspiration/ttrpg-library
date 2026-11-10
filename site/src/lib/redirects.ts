// Former type keys (docs/site.md#type-registry `formerly`, docs/site.md#redirects): a renamed type's old
// URLs, print keys, and type filters keep working (P9: stable URLs).

import type { Registry } from '../../../scripts/build-index/index.ts';

/** One former key of a registered type. */
export interface FormerType {
  ruleset: string;
  /** The old type key, such as `magic-item`. */
  from: string;
  /** The current type key, such as `item`. */
  to: string;
}

/** Every former type key in the registry, in registry order. */
export function formerTypes(registry: Registry): FormerType[] {
  return Object.entries(registry).flatMap(([ruleset, config]) =>
    Object.entries(config.types).flatMap(([to, type]) =>
      ((type.formerly as string[] | undefined) ?? []).map((from) => ({ ruleset, from, to })),
    ),
  );
}

/** Old type key to current type key, for one ruleset or every ruleset. */
export function typeAliases(registry: Registry, ruleset?: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const former of formerTypes(registry)) if (!ruleset || former.ruleset === ruleset) aliases[former.from] = former.to;
  return aliases;
}

/** An entry key (`<type>/<id>`) with a former type replaced by the current one; any other key is returned as is. */
export function currentKey(key: string, aliases: Record<string, string>): string {
  const slash = key.indexOf('/');
  if (slash < 0) return key;
  const type = aliases[key.slice(0, slash)];
  return type === undefined ? key : `${type}${key.slice(slash)}`;
}

/**
 * The inline script a redirect page runs (docs/site.md#redirects): it sends the reader to
 * `to`, adding the page's own query after any query `to` carries, so a parameter the reader
 * brought wins, and keeping the fragment.
 */
export function redirectScript(to: string): string {
  return `var t=${JSON.stringify(to)},s=location.search;location.replace(t+(s?(t.indexOf("?")<0?s:"&"+s.slice(1)):"")+location.hash);`;
}
