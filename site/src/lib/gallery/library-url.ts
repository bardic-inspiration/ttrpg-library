// Where an old gallery route now leads (docs/site.md#redirects): the Library with the route's
// filter set, so `/<ruleset>/` and `/<ruleset>/<type>/` keep working (P9: stable URLs).

import { RULESET, TYPE, galleryConfig, type Registry } from './config.ts';
import { toQuery, type FilterValue } from './state.ts';

/**
 * The Library's query string for an old gallery route: the ruleset filter, the type filter on
 * a type's route, and that type's registry `defaultSort`, which its gallery started on.
 */
export function libraryQuery(registry: Registry, ruleset: string, type?: string): string {
  const config = galleryConfig(registry);
  const filters = new Map<string, FilterValue>([[RULESET, { kind: 'enum', values: [ruleset] }]]);
  if (type !== undefined) filters.set(TYPE, { kind: 'enum', values: [type] });
  const sort = (type !== undefined && config.types.get(`${ruleset}/${type}`)?.defaultSort) || config.defaultSort;
  return toQuery({ q: '', sort, filters }, config);
}
