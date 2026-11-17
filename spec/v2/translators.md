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

- [Exporter interface](../../docs/export.md#exporter-interface): format
  translators are planned as further exporters that read `derived`.
- [Requests](../../docs/generation.md#requests): the issue kinds routines
  take.

## Design

### Two-way modules

Each translator is one module for one target format, with two sides:

- **Export** maps an entry and its derived values to the target format. It
  is an exporter, offered in Download's format menu ([Controls](../../docs/export.md#controls))
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

### Open5e mapping

- **Types:** creature, spell, item, condition, and equipment (weapons and
  armor). Page types (class, subclass, species) and rules pages aren't
  covered. Export doesn't offer them, and import skips and lists them.
- **Links, on export:** a `{ref:type/id}` token in text becomes the entry's
  plain name. A structured ref becomes the name or key in Open5e's field for
  it, such as a spell's class list or a creature's condition immunities.
  Each ref that becomes plain text is reported.
- **Links, on import:** a name in a structured field becomes a ref when it
  exactly matches the name of a library entry in the target ruleset. Names in
  prose stay plain text, since linking prose would mean guessing. Each
  unresolved name is listed.
- **Derived values, on export:** export reads `derived` to fill Open5e's
  numeric fields: AC, hit points and the hit dice string, save and skill
  bonuses, attack bonus, save DC, and CR and XP. Tokens in prose render as
  their numbers.
- **Derived values, on import:** import writes inputs only:
  - A hit dice string such as `42d8+126` becomes `hitDice: 42`.
  - Each save or skill bonus becomes `proficient` or `expertise`, worked
    out from the ability modifier and PB.
  - An attack line ("+N to hit, reach X ft.") becomes a structured action.
  - A number in prose becomes a token.

  The last two apply only where the parsed number matches the derived value
  exactly. Anything else stays as it is and is listed as a mismatch.
- **Meta:** `meta` isn't exported. The round trip compares `stats`, the
  names, and the text fields.
- **Field names:** the build checks them against a live Open5e response, or
  against fixture files taken from the API by hand, since a routine session
  may not reach `api.open5e.com`.

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
- **Licensing:** only Creative Commons content is imported. An issue whose
  source isn't under a Creative Commons license is rejected: the routine
  comments why, removes `in-progress`, and makes no entries. Importing an
  author's own work on their written consent is a later version (#118).
- **Custom entries only:** imported entries are custom
  ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)).
  An entry that reuses an SRD entry's exact name or an SRD proper noun is
  skipped and listed.
- **Docs to update when built:** `docs/generation.md` (Requests, Labels,
  Run order), `docs/routines.md`, and `AGENTS.md` "Content rules", which
  today says routines take only `request` and `revise` issues.

### What doesn't translate

What one side can't represent is skipped and reported, never guessed:

- **Import** lists everything skipped in the content PR.
- **Export** lists everything dropped on the site after the download, such
  as a link that became plain text or a field the target has no place for.
- **Mismatched numbers:** when an imported number disagrees with what the
  ruleset derives from the imported inputs, the ruleset wins. Import writes
  no `adjust`, and the PR lists the mismatch. `adjust` is kept for deliberate
  deviations, and an upstream number isn't one.

### Testing

- **Round trip, in CI:** for every library entry a translator covers,
  export then import returns the same entry, apart from what the export
  reported as dropped.
- **Target schemas, in CI:** exported files validate against each target's
  published schema, where one exists.
- **Real importers, by hand:** loading the files into each target is a
  Testing backlog issue.

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
- **Which Creative Commons licenses:** the library's content is CC-BY-4.0,
  and NC, ND, and SA works can't be relicensed under it. Are only CC0 and
  CC-BY accepted, or do the others come in under their own license?
- **Where an imported entry records its source:** the license, author, and
  source an imported entry credits, as `meta` fields or an `ATTRIBUTION.md`
  line, and whether its `meta.source.kind` stays `routine`.

## Out of scope

- Licensed content from any source.
- Closed formats: Fantasy Grounds, Roll20, and D&D Beyond.
- Authors publishing their own content through the importer, and imports of
  an author's own non-CC work on their written consent: a later version
  (#118).
- SRD content from any target: SRD entries come from the official PDF.
