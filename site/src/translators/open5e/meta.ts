// What the site needs to offer the Open5e format before loading the translator itself
// (docs/export.md#open5e).

export const OPEN5E = {
  id: 'open5e',
  label: 'Open5e',
  ruleset: 'dnd-5e-2024',
  /** The library types it covers, in the file's order. */
  types: ['creature', 'spell', 'item', 'condition', 'equipment'],
  extension: 'open5e.json',
} as const;
