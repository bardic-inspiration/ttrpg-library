// The Open5e translator (docs/export.md#open5e): dnd-5e-2024 creatures, spells, magic items,
// conditions, and equipment to and from Open5e's API records. A file is one object of record
// lists by Open5e endpoint, `{ "creatures": [...], "spells": [...] }`; import also takes a single
// record, a list of records, or a page of API results.

import type { ItemStats } from '../../../../rulesets/dnd-5e-2024/types.ts';
import type { ImportContext, ImportedEntry, Skip, Translator, TranslatorItem } from '../types.ts';
import { exportCondition, importCondition } from './condition.ts';
import { exportCreature, importCreature } from './creature.ts';
import { DOCUMENT_KEY, type Record5e } from './document.ts';
import { exportEquipment, importEquipment } from './equipment.ts';
import { exportItem, importItem, unexportableItem } from './item.ts';
import type { Open5eKind } from './schema.ts';
import { OPEN5E } from './meta.ts';
import { exportSpell, importSpell } from './spell.ts';
import { Skips } from './text.ts';

interface Mapping {
  /** The Open5e endpoint, the file's key for its records. */
  endpoint: string;
  kind: Open5eKind;
  export(item: TranslatorItem, skips: Skips): Record5e;
  import(record: Record5e, context: ImportContext, skips: Skips): ImportedEntry | undefined;
}

/** The library types Open5e covers, in the file's order. */
export const MAPPINGS: Record<string, Mapping> = {
  creature: { endpoint: 'creatures', kind: 'Creature', export: exportCreature, import: importCreature },
  spell: { endpoint: 'spells', kind: 'Spell', export: exportSpell, import: importSpell },
  item: { endpoint: 'magicitems', kind: 'MagicItem', export: exportItem, import: importItem },
  condition: { endpoint: 'conditions', kind: 'Condition', export: exportCondition, import: importCondition },
  equipment: { endpoint: 'items', kind: 'Item', export: exportEquipment, import: importEquipment },
};

const RULESET = OPEN5E.ruleset;

/** The envelope fields Open5e has no place for. */
const ENVELOPE: [keyof TranslatorItem['entry'], string][] = [
  ['source', 'Open5e\'s document field names Open5e\'s own sources, not the library\'s.'],
  ['author', 'Open5e has no field for an author.'],
  ['summary', 'Open5e has no field for a summary.'],
  ['description', 'Open5e has no field for a description.'],
  ['image', 'Open5e\'s illustrations need credits the library doesn\'t store.'],
];

/** The type a record is, from its endpoint or, when it came alone, its fields. */
function typeOf(record: Record5e, endpoint?: string): string | undefined {
  if (endpoint) return Object.entries(MAPPINGS).find(([, m]) => m.endpoint === endpoint)?.[0];
  if ('challenge_rating' in record) return 'creature';
  if ('school' in record && 'level' in record) return 'spell';
  if ('rarity' in record) return 'item';
  if ('descriptions' in record) return 'condition';
  if ('category' in record) return 'equipment';
  return undefined;
}

/** Every record in an Open5e file, with its endpoint when the file names one. */
function recordsOf(file: unknown): { record: Record5e; endpoint?: string }[] {
  if (Array.isArray(file)) return file.flatMap(recordsOf);
  if (!file || typeof file !== 'object') return [];
  const object = file as Record5e;
  if (Array.isArray(object.results)) return recordsOf(object.results);
  const endpoints = Object.values(MAPPINGS).map((m) => m.endpoint);
  if (Object.keys(object).some((k) => endpoints.includes(k)) && !('name' in object)) {
    return Object.entries(object).flatMap(([endpoint, list]) =>
      Array.isArray(list) ? list.map((record: Record5e) => ({ record, endpoint })) : [],
    );
  }
  return [{ record: object }];
}

export const open5e: Translator = {
  ...OPEN5E,
  types: [...OPEN5E.types],
  export(items) {
    const skipped: Skip[] = [];
    const exported: string[] = [];
    const file: Record<string, Record5e[]> = {};
    for (const item of items) {
      const key = `${item.entry.type}/${item.entry.id}`;
      const skips = new Skips(skipped, key);
      const mapping = item.entry.ruleset === RULESET ? MAPPINGS[item.entry.type] : undefined;
      if (!mapping) {
        skips.add('', `Open5e doesn't cover ${item.entry.ruleset === RULESET ? `the ${item.entry.type} type` : `the ${item.entry.ruleset} ruleset`}, so it isn't exported.`);
        continue;
      }
      const unexportable = item.entry.type === 'item' ? unexportableItem(item.entry.stats as ItemStats) : undefined;
      if (unexportable) {
        skips.add('', unexportable);
        continue;
      }
      for (const [field, reason] of ENVELOPE) if (item.entry[field] !== undefined) skips.add(field, reason);
      (file[mapping.endpoint] ??= []).push(mapping.export(item, skips));
      exported.push(key);
    }
    const ordered = Object.fromEntries(
      Object.values(MAPPINGS)
        .map((m) => m.endpoint)
        .filter((endpoint) => file[endpoint])
        .map((endpoint) => [endpoint, file[endpoint]]),
    );
    return { data: `${JSON.stringify(ordered, null, 2)}\n`, exported, skipped };
  },
  import(file, context) {
    const skipped: Skip[] = [];
    const entries: ImportedEntry[] = [];
    for (const { record, endpoint } of recordsOf(file)) {
      const name = typeof record.name === 'string' && record.name !== '' ? record.name : '(unnamed record)';
      const skips = new Skips(skipped, name);
      const type = typeOf(record, endpoint);
      const mapping = type ? MAPPINGS[type] : undefined;
      if (!mapping) {
        skips.add('', 'It isn\'t a record type the library covers: creatures, spells, magic items, conditions, and equipment.');
        continue;
      }
      const entry = mapping.import(record, context, skips);
      if (!entry) continue;
      // A record this library exported keeps its entry's id, which its key carries; any other takes its name's slug.
      const own = typeof record.key === 'string' && record.key.startsWith(`${DOCUMENT_KEY}_`) ? record.key.slice(DOCUMENT_KEY.length + 1) : '';
      if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(own)) entry.id = own;
      entries.push(entry);
    }
    return { entries, skipped };
  },
};
