---
issue: 116
depends: []
---

# Translators

## Goal

Move content between this library and the open TTRPG formats, in both
directions, so an author can write homebrew once and publish it on several
platforms. Export sends entries to VTTs and other content sites. Import brings
an author's Creative Commons homebrew in from those formats. SRD content isn't
imported: the library transcribes it from the official SRD PDF
([SRD import](../../docs/generation.md#srd-import)). It serves the data lane of the export design
([export.md](../../docs/export.md)), P5 and P9 (licensing), and P7 (every import is a
reviewed PR).

This area and export (#115) can be combined.

## Current

- [Translators](../../docs/export.md#translators): the two-way module
  interface, skip reports, and the round-trip, schema, and field-name tests.
- [Open5e](../../docs/export.md#open5e): the first translator, export and
  import, built. Its import side runs as a script in the import flow below.
- [Requests](../../docs/generation.md#requests): the issue kinds routines
  take.

## Design

### Targets

In build order, each an open, documented format with openly licensed data:

1. **Open5e.**
2. **Foundry VTT's dnd5e system.**
3. **The 5e.tools homebrew format**, for its schema only; the site's own
   content isn't openly licensed and isn't imported.

Fantasy Grounds, Roll20, and D&D Beyond are left out: their formats are
closed, or they import nothing.

### Import flow

1. The owner attaches a file in a target format to an import issue
   ([The import issue](#the-import-issue)).
2. A routine runs the translator's import side, as a script within the
   `generate` workflow, and opens a content PR with the entries. Every
   content rule applies to them: validation, the blocklist, inputs instead
   of derived values, and links to library entries the content names.
3. The owner reviews and merges the PR like any other.

For now the importer is a skill-assisted script. Authors translating and
publishing their own content on the platform comes in a later version.

### The import issue

- **Template:** `.github/ISSUE_TEMPLATE/import-request.yml`, with these
  fields:
  - **format:** a dropdown of the targets that are built.
  - **file:** an attached file, or a URL to one.
  - **source and license:** required.
  - **ruleset:** defaults to `config/defaults.json`.
  - **notes:** optional.
- **Label:** `import`. `in-progress`, `needs-info`, and `priority:high` work
  as they do for `request` issues.
- **Run order:** a new step after revise requests and before content
  requests. Import issues are picked like content requests (`priority:high`
  first, then oldest) and batched into one content PR. The PR's skip list
  is grouped by issue.
- **Licensing:** an import's license must be on the source allowlist
  ([Source allowlist](#source-allowlist)) for imported entries: CC0 or
  CC-BY, any version. NC, ND, and SA works can't be relicensed under the
  library's CC-BY-4.0, so they're rejected like any other license. A
  rejected issue gets a comment from the routine saying why, loses
  `in-progress`, and makes no entries. Importing an author's own work on
  their written consent is a later version (#118).
- **Source and attribution:** each imported entry sets
  `meta.source.kind: import` (a new kind beside `routine`, `revise`, and
  `manual`) and a `meta.source.license` block with the license's allowlist
  id, the author, and the source URL. The validator requires the block on
  `import` entries and checks the id against the allowlist. Each source
  also gets one line in `ATTRIBUTION.md` naming the work, author, license,
  and URL, and noting it was adapted, as CC-BY requires. The content PR
  adds that line. The detail page's provenance line credits the author and
  license.
- **Custom entries only:** imported entries are custom
  ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)).
  An entry that reuses an SRD entry's exact name or an SRD proper noun is
  skipped and listed.
- **Docs to update when built:** `docs/generation.md` (Requests, Labels,
  Run order), `docs/routines.md`, `docs/content-model.md` (Meta),
  `docs/licensing.md` (the source allowlist and imported sources'
  attribution), and `AGENTS.md` "Content rules", which today says routines
  take only `request` and `revise` issues.

### Source allowlist

`config/licenses.json` is the one list of licenses the library accepts
outside material, keyed by the kind of material. Licensing questions are
settled by editing it, not case by case. It starts with two kinds:

- **`import`** (imported entries): `CC0-1.0` and `CC-BY` in any version
  (`CC-BY-2.0`, `CC-BY-3.0`, `CC-BY-4.0`).
- **`art`** (images, [art.md](art.md#sources-and-rights)): public domain,
  `CC0-1.0`, and `CC-BY` in any version.

Licenses use SPDX ids, with `public-domain` as the one non-SPDX id. Each one
lists its name and its legal-code URL, which the import issue's license field
and `ATTRIBUTION.md` both use. Adding a kind or a license is a dev PR that
adds a row to `docs/decisions.md`. The import routine and the validator read
the file (#247), and the art checks do too (#251).

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
  an author's own non-CC work on their written consent: a later version
  (#118).
- SRD content from any target: SRD entries come from the official PDF.
