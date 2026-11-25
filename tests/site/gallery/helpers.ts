import { join } from 'node:path';
import { buildIndex } from '../../../scripts/build-index/index.ts';
import { loadRegistry } from '../../../scripts/validate/schema.ts';
import type { LibraryRecord, Registry } from '../../../site/src/lib/gallery/config.ts';
import { FIXTURES } from '../../helpers.ts';

/** The example fixtures as library.json records: Cinder Hound, Frost Lance, Wand of Frost Lances. */
export async function fixtureRecords(): Promise<LibraryRecord[]> {
  const { errors, records } = await buildIndex(join(FIXTURES, 'library/valid'));
  if (errors.length > 0) throw new Error(errors.map((e) => e.message).join('\n'));
  return records;
}

export const registry = (): Promise<Registry> => loadRegistry();

/** A record with only what a test sets; the rest is filler. */
export function record(overrides: Partial<LibraryRecord> & { id: string }): LibraryRecord {
  return {
    ruleset: 'dnd-5e-2024',
    source: null,
    author: 'bardic-inspiration',
    type: 'creature',
    name: overrides.id,
    summary: 'A filler summary for tests.',
    url: `/ttrpg-library/dnd-5e-2024/${overrides.type ?? 'creature'}/${overrides.id}/`,
    image: null,
    facets: {},
    createdAt: '2026-01-01',
    refs: [],
    refBy: [],
    ...overrides,
  };
}

/**
 * A query with the whole `dnd-5e-2024` ruleset in the ruleset set, unless it sets the set itself
 * (docs/site.md#gallery "Filters"), so a test of the other filters sees homebrew fixtures too.
 */
export function whole(query = ''): string {
  const bare = query.replace(/^\?/, '');
  if (/(^|&)f\.(ruleset|source|author)=/.test(bare)) return `?${bare}`;
  return `?f.ruleset=dnd-5e-2024${bare === '' ? '' : `&${bare}`}`;
}
