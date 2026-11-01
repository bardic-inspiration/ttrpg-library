import { join } from 'node:path';
import { buildIndex, loadRegistryFile } from '../../../scripts/build-index/index.ts';
import type { LibraryRecord, Registry } from '../../../site/src/lib/gallery/config.ts';
import { FIXTURES } from '../../helpers.ts';

/** The §6.9 fixtures as library.json records: Cinder Hound, Frost Lance, Wand of Frost Lances. */
export async function fixtureRecords(): Promise<LibraryRecord[]> {
  const { errors, records } = await buildIndex(join(FIXTURES, 'library/valid'));
  if (errors.length > 0) throw new Error(errors.map((e) => e.message).join('\n'));
  return records;
}

export const registry = (): Promise<Registry> => loadRegistryFile();

/** A record with only what a test sets; the rest is filler. */
export function record(overrides: Partial<LibraryRecord> & { id: string }): LibraryRecord {
  return {
    ruleset: 'dnd-5e-2024',
    type: 'creature',
    name: overrides.id,
    summary: 'A filler summary for tests.',
    url: `/ttrpg-library/dnd-5e-2024/${overrides.type ?? 'creature'}/${overrides.id}/`,
    image: null,
    facets: {},
    tags: {},
    createdAt: '2026-01-01',
    refs: [],
    refBy: [],
    search: '',
    ...overrides,
  };
}
