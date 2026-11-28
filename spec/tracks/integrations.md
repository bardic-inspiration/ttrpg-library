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

### Foundry VTT

The second target maps `dnd-5e-2024` entries to and from documents of
Foundry VTT's dnd5e system, using its 2024-rules ("modern") data model: dnd5e
6.1 on Foundry v14. Each exported document writes `_stats.systemId:
"dnd5e"` and the `systemVersion` it was built against.

- **Types:** creature to an `npc` Actor; spell to a `spell` Item; feat to a
  `feat` Item with `system.type.value: "feat"`; equipment and magic items to
  the Item type of their category: `weapon`, `equipment` (armor, shields,
  worn and wondrous items), `consumable` (potions, scrolls, ammunition),
  `tool`, `container`, or `loot`. Conditions aren't covered: Foundry's are
  status effects in the system's config, not documents. Every other type
  isn't covered, and a set export skips and lists it, as with Open5e.
- **The file.** Entry scope downloads `<id>.foundry.json`, one document that
  Foundry's **Import Data** reads as is. Set scope downloads
  `library-<YYYYMMDD>.foundry.zip`, one document file per entry in a folder
  per document type (`Actor/`, `Item/`), each importable the same way.
  Import takes one document, a list of documents, or that zip.
- **IDs.** A document's `_id` (16 alphanumeric characters) is derived from
  `<type>/<id>`, so re-exporting an entry overwrites the same document. It
  also writes `flags["ttrpg-library"].id: "<type>/<id>"`. On import, a
  document with that flag keeps its id; any other's id is its name's slug.
- **Links, on export:** a structured ref becomes the value in Foundry's field
  for it: a creature's condition immunities (`system.traits.ci`), damage
  resistances, immunities, and vulnerabilities (`dr`, `di`, `dv`), and
  languages; a weapon's properties and mastery (`system.properties`,
  `system.mastery`); and a spell's school. A spell's classes have no field in
  the 2024 model and are reported. A creature's Spellcasting spells become
  embedded spell Items, each the spell's own export. A `{ref:…}` token in
  text becomes its display text and is reported, except a link to a
  condition, which becomes `&Reference[<condition>]`, the system's own
  enricher.
- **Links, on import:** `@UUID[…]{Name}` and `&Reference[…]` become their
  display name. A name in a structured field, or an embedded spell's name,
  becomes a ref when it exactly matches one entry or rule of that type in the
  ruleset; names in prose stay plain text, and each unresolved name is
  listed.
- **Derived values.** Foundry derives most of what the ruleset derives, so
  both sides carry inputs: abilities, save proficiencies
  (`abilities.<a>.proficient`), skill ranks (`skills.<s>.value`: 0, 1, or 2),
  `details.cr`, `attributes.hp.max` and its `formula`, `attributes.ac`
  (`calc: "natural"` with `flat`, or `default` with armor), speeds, senses,
  size, type, and alignment. Proficiency bonus, XP, and save and skill totals
  aren't exported. On import, where a stored value disagrees with what the
  ruleset derives, the ruleset wins and the difference is listed. Tokens in
  prose render as numbers, as with Open5e.
- **Creature traits and actions** export as embedded `feat` Items
  (`system.type.value: "monster"`), each described by its SRD 5.2 stat
  block text as the site composes it. A structured attack also gets an
  `attack` activity (ability, melee or ranged, reach or range, damage
  parts), and a structured save a `save` activity (ability, DC from the
  creature's ability, damage); anything else is description only, reported.
  Legendary actions carry: `resources.legact.max` holds the uses, and each
  action gets `activation.type: "legendary"` and its cost. Lair actions are
  reported. Import reads activities back into structured attacks and saves;
  a feat without one becomes text and is listed.
- **Schema.** Foundry publishes no JSON schema (its data models are
  JavaScript classes), so the schema test doesn't apply. The field-name test
  checks exports against documents from the system's own SRD 5.2 packs,
  `packs/_source/` in the dnd5e repository at the targeted release
  (`spells24/3rd-level/fireball.yml`, and Lich and Boots of Levitation from
  `actors24` and `equipment24`), converted to JSON in
  `tests/fixtures/foundry/`. They're CC-BY-4.0 SRD content and are credited
  as the Open5e fixtures are.
- **Import issues.** `foundry` joins the import script and the import issue's
  format dropdown. A document's `system.source.license` that disagrees with
  the issue's license is a `needs-info` question, and one with
  `system.source.rules: "2014"` is rejected as a ruleset mismatch.

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

- **5e.tools' mapping:** which types it covers, and how links, text tokens,
  and derived values map to its model, settled in its build's spec PR before
  it's built (#249).

## Out of scope

- Licensed content from any source.
- Closed formats: Fantasy Grounds, Roll20, and D&D Beyond.
- Foundry classes, subclasses, class features and options, backgrounds,
  species, and species traits, which need its Advancement model
  (level-by-level grants, choices, and scale values); and encounters, maps,
  and modules, which would be scenes and adventures. Each would be a design
  of its own in this track.
- Authors publishing their own content through the importer, and imports of
  an author's own non-CC work on their written consent: in-app publishing,
  earmarked for v2.0.0 (#370).
- SRD content from any target: SRD entries come from the official PDF.
