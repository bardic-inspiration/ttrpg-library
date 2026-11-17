// The translator interface (docs/export.md#translators). A translator is one module for one target
// format, with two sides: export maps library entries and their derived values to the target, and
// import maps a file in the target format to library entries. Both report what they skip, never
// guessing a mapping. Export is offered through an exporter (site/src/exporters/); import is run
// as a script by the import flow.

/** A library entry as a translator reads it: the envelope keys it maps. */
export interface TranslatorEntry {
  ruleset: string;
  type: string;
  id: string;
  name: string;
  summary?: string;
  description?: string;
  stats: unknown;
  tags?: Record<string, unknown>;
  image?: string;
  meta?: unknown;
}

/** One entry to export: the entry, its derived values, and the names of the entries and rules it links to, by `<type>/<id>`. */
export interface TranslatorItem {
  entry: TranslatorEntry;
  derived: Record<string, unknown>;
  names: Record<string, string>;
}

/** Something one side couldn't represent: a field dropped, a link made plain text, a number that didn't match. */
export interface Skip {
  /** The library entry, `<type>/<id>`, or on import the source record's name. */
  entry: string;
  /** Where in the entry, such as `stats.actions[2].onHit`; empty for the whole entry. */
  path: string;
  reason: string;
}

export interface ExportResult {
  /** The file's text. */
  data: string;
  /** Every entry that exported, as `<type>/<id>`. */
  exported: string[];
  skipped: Skip[];
}

/** An imported entry: inputs only, without `summary` or `meta`, which the import flow writes. */
export interface ImportedEntry {
  ruleset: string;
  type: string;
  id: string;
  name: string;
  description?: string;
  stats: Record<string, unknown>;
}

export interface ImportResult {
  entries: ImportedEntry[];
  skipped: Skip[];
}

/** What import resolves names against: the target ruleset's entries and rules. */
export interface ImportContext {
  ruleset: string;
  /** Names of the ruleset's entries and rules primitives, by `<type>/<id>`. */
  names: Map<string, string>;
}

export interface Translator {
  id: string;
  /** The format's name in Download's menu. */
  label: string;
  /** The ruleset it maps. */
  ruleset: string;
  /** The library types it covers. */
  types: string[];
  /** The downloaded file's extension, after the entry id or the dated library name. */
  extension: string;
  export(items: TranslatorItem[]): ExportResult;
  import(file: unknown, context: ImportContext): ImportResult;
}
