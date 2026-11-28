// Where a ruleset's Library is (docs/site.md#pages-and-navigation), and where an old gallery
// route now leads (docs/site.md#redirects): `/<ruleset>/<type>/` opens the ruleset's Library with
// the type checked, and `/` opens the home ruleset's (P9: stable URLs).

import { RULESET, TYPE, galleryConfig, typeKey, type Registry } from './config.ts';
import { toQuery, type FilterValue } from './state.ts';

/** The ruleset whose Library `/` and the top bar's Library link open: the registry's first. */
export const homeRuleset = (registry: Registry): string => Object.keys(registry)[0] ?? '';

/** A ruleset's Library, as a path under the site base. */
export const libraryPath = (ruleset: string): string => `${ruleset}/`;

/** The part of the registry one ruleset's Library offers: that ruleset alone, or the whole registry when it isn't registered. */
export const rulesetRegistry = (registry: Registry, ruleset: string | undefined): Registry =>
  ruleset !== undefined && registry[ruleset] ? { [ruleset]: registry[ruleset] } : registry;

/**
 * The ruleset a page belongs to, from its path under the site base: a ruleset's Library, or one
 * of its entries' or rules pages. Undefined for any other page.
 */
export function pageRuleset(registry: Registry, path: string): string | undefined {
  const first = path.split('/')[0] ?? '';
  return Object.hasOwn(registry, first) ? first : undefined;
}

/**
 * The query string an old type gallery opens its ruleset's Library with: the whole ruleset, the
 * type checked, and that type's registry `defaultSort`, which its gallery started on.
 */
export function libraryQuery(registry: Registry, ruleset: string, type?: string): string {
  const config = galleryConfig(rulesetRegistry(registry, ruleset));
  const filters = new Map<string, FilterValue>([[RULESET, { kind: 'enum', values: [ruleset] }]]);
  if (type !== undefined) filters.set(TYPE, { kind: 'enum', values: [typeKey(ruleset, type)] });
  const sort = (type !== undefined && config.types.get(`${ruleset}/${type}`)?.defaultSort) || config.defaultSort;
  return toQuery({ q: '', sort, filters }, config);
}

/** An old type gallery's new place: its ruleset's Library with the type checked, under the site base. */
export const typeLibrary = (registry: Registry, ruleset: string, type: string): string => `${libraryPath(ruleset)}${libraryQuery(registry, ruleset, type)}`;

/**
 * The inline script `/` runs (docs/site.md#redirects): it opens the Library of the ruleset an old
 * Library link's `f.ruleset` names first, when it's registered, or else the home ruleset's, with
 * the link's query and fragment.
 */
export function homeScript(base: string, registry: Registry): string {
  const rulesets = Object.keys(registry);
  return `var r=${JSON.stringify(rulesets)},h=${JSON.stringify(homeRuleset(registry))},s=location.search,m=/[?&]f\\.ruleset=([^&]*)/.exec(s),v=m?decodeURIComponent(m[1]).split(",")[0].toLowerCase():"",t=r.indexOf(v)<0?h:v;location.replace(${JSON.stringify(base)}+t+"/"+s+location.hash);`;
}
