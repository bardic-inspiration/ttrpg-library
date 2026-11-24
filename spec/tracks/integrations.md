---
issue: 116
depends: []
---

# Integrations

## Goal

Move content between this library and the open TTRPG formats, in both
directions, so an author can write homebrew once and publish it on several
platforms. Export sends entries to VTTs and other content sites. Import brings
an author's Creative Commons homebrew in from those formats. SRD content isn't
imported: the library transcribes it from the official SRD PDF
([SRD import](../../docs/generation.md#srd-import)). It serves the data lane of the export design
([export.md](../../docs/export.md)), P5 and P9 (licensing), and P7 (every import is a
reviewed PR).

The Integrations track (#315) carries this on from the translator framework,
the Open5e translator, and the import flow, which are built.

## Current

- [Translators](../../docs/export.md#translators): the two-way module
  interface, skip reports, and the round-trip, schema, and field-name tests.
- [Open5e](../../docs/export.md#open5e): the first translator, export and
  import, built.
- [Imports](../../docs/generation.md#imports): the import flow, built. An
  import issue's file runs through `npm run import` in the `generate`
  skill, and one content PR holds the batch with its skip list. Each new
  translator's import side joins it by its id in the import script and the
  import issue's format dropdown.
- [Source allowlist](../../docs/licensing.md#source-allowlist) and
  [Imported works](../../docs/licensing.md#imported-works): the licenses
  imports take, and how imported works are credited.

## Design

### Targets

In build order, each an open, documented format with openly licensed data:

1. **Open5e.**
2. **Foundry VTT's dnd5e system.**
3. **The 5e.tools homebrew format**, for its schema only; the site's own
   content isn't openly licensed and isn't imported.

Fantasy Grounds, Roll20, and D&D Beyond are left out: their formats are
closed, or they import nothing.

## Cases

- `creature/lich`, `spell/fireball`, and `item/boots-of-levitation`:
  each round-trips through every translator, with links and derived values
  as the cases to watch.

## Done when

- Each target has a translator whose export appears in Download's format
  menu and whose import a routine runs from an import issue.
- The round-trip test passes for every entry each translator covers.
- Exported files pass each target's published schema where one exists.
- Export and import both report what they skipped.

## Open questions

- **Foundry's and 5e.tools' mappings:** which types each target covers, and
  how links, text tokens, and derived values map to its model. Each is
  settled in its build's spec PR, before that target is built (#248, #249).

## Out of scope

- Licensed content from any source.
- Closed formats: Fantasy Grounds, Roll20, and D&D Beyond.
- Authors publishing their own content through the importer, and imports of
  an author's own non-CC work on their written consent: in-app publishing,
  earmarked for v2.0.0 (#370).
- SRD content from any target: SRD entries come from the official PDF.
