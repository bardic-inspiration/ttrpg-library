---
issue: 116
depends: [export, types]
---

# Translators

## Goal

Move content between this library and the open TTRPG formats, in both
directions: export entries for VTTs and other content sites, and import
openly licensed content from them. Only open sources are covered; no
licensed content is imported. It serves the data lane of the export design
([`export.md`](export.md)), P5 and P9 (licensing), and P7 (every import is a
reviewed PR).

This area and export (#115) can be combined.

## Current

- [Exporter interface](../../docs/export.md#exporter-interface): format
  translators are planned as further exporters that read `derived`.
- [Requests](../../docs/generation.md#requests): the issue kinds routines
  take.

## Design

### Two-way modules

Each translator is one module for one target format, with two sides:

- **Export** maps an entry and its derived values to the target format. It
  is an exporter, offered in Download's format menu ([`export.md`](export.md))
  for card entries and sets of them.
- **Import** maps a file in the target format to library entries.

### Targets

In build order, each an open, documented format with openly licensed data:

1. **Open5e.**
2. **Foundry VTT's dnd5e system.**
3. **The 5e.tools homebrew format**, for its schema only; the site's own
   content isn't openly licensed and isn't imported.

Fantasy Grounds, Roll20, and D&D Beyond are left out: their formats are
closed, or they import nothing.

### Import flow

1. The owner attaches a file in a target format to an import issue.
2. A routine runs the translator's import side, as a script within the
   `generate` workflow, and opens a content PR with the entries. Every
   content rule applies to them: validation, the blocklist, inputs instead
   of derived values, and links to library entries the content names.
3. The owner reviews and merges the PR like any other.

For now the importer is a skill-assisted script. Authors translating and
publishing their own content on the platform comes in a later version.

### What doesn't translate

What one side can't represent is skipped and reported, never guessed:

- **Import** lists everything skipped in the content PR.
- **Export** lists everything dropped on the site after the download, such
  as a link that became plain text or a field the target has no place for.

### Testing

- **Round trip, in CI:** for every library entry a translator covers,
  export then import returns the same entry, apart from what the export
  reported as dropped.
- **Target schemas, in CI:** exported files validate against each target's
  published schema, where one exists.
- **Real importers, by hand:** loading the files into each target is a
  Testing backlog issue.

## Cases

- `creature/lich`, `spell/fireball`, and `magic-item/boots-of-levitation`:
  each round-trips through every translator, with links and derived values
  as the cases to watch.

## Done when

- Each target has a translator whose export appears in Download's format
  menu and whose import a routine runs from an import issue.
- The round-trip test passes for every entry each translator covers.
- Exported files pass each target's published schema where one exists.
- Export and import both report what they skipped.

## Open questions

- **Each target's mapping:** which types each target covers, and how links,
  text tokens, and derived values map to its model. Settled per target in
  its build's pilot, here before that target is built.
- **The import issue:** its template and label, and its place in the
  routine run order, which today takes only `request` and `revise` issues.

## Out of scope

- Licensed content from any source.
- Closed formats: Fantasy Grounds, Roll20, and D&D Beyond.
- Authors publishing their own content through the importer: a later
  version (#118).
