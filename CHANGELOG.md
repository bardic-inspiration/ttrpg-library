# Changelog

Notable changes to the library, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers
take [Semantic Versioning](https://semver.org/)'s form as
[Releases](docs/workflow.md#releases) reads it.

## [1.2.0] - 2026-11-27

### Added

- Characters: a character profile page and card, built from a class, species,
  background, and feats, with checks for a legal build, and Library facets
  (#477, #482, #487). Features, traits, feats, and items declare the modifiers
  and grants they give a character, and the SRD's do (#478, #480, #489, #491,
  #493).
- Maps: a map page with its zone diagram, and a card; entries can point to a
  map's zones (#496, #497, #498).
- Encounters: an encounter type built from a shared kit, with a page, a card,
  Library facets for XP span and creature type, and a difficulty calculator
  with budgets and an environment multiplier (#502, #504, #505, #506, #507).
- Modules: a structured document that contains encounters and other modules,
  with a page, a card, and a structured summary; contained entries show the
  modules they're part of (#511, #512).
- Content requests for characters, maps, encounters, and modules, which the
  routines fulfil with the new entries they need in one batch (#492, #499,
  #508, #513).
- A print cart that collects entries from the Library for printing or
  downloading together (#465).
- Shared interaction components and a style guide for text roles, spacing,
  and underlines (#455, #458).
- A preview site built from `main`, with a notice saying it isn't the
  release (#447, #449).

### Changed

- The Library is one page per ruleset, with Sources and Types filters (#471).
- Search filters the Library by name (#453).
- Search and the set export sit in the page header (#466).
- Cards show filter chips from each type's fields, chips name their field,
  range filters keep their inputs, and a card's source sits on its own line
  below its summary (#462, #463, #464).
- SRD equipment and conditions show as Library cards (#468).
- Rules pages read as text with a structured summary, and the class page
  fits its Features table (#473).
- Reference lists collapse, list each reference once, and entry pages no
  longer link to issues (#469).
- Production deploys from the latest release tag instead of `main` (#449).

### Removed

- Tags, including the `source: SRD` tag; the Sources filter replaces it
  (#452, #471).

### Fixed

- Stat block section headings and the current navigation link's underline
  (#461), and heading sizes in print (#460).
- The Filters toggle stays hidden on desktop (#474).

## [1.1.0] - 2026-11-22

### Added

- The full SRD 5.2 rules base, as linked data that custom entries build on:
  glossary terms, conditions, and equipment (with weapon and mastery
  properties) as rules pages, and feats, backgrounds, species, classes, and
  subclasses, with their features and options, alongside spells, items, and
  creatures.
- Custom conditions and equipment, which extend the ruleset's own.
- Class, subclass, and species pages as accordions with a table of contents
  (#294).
- One Library page with a nested filter tree built from each type's fields, in
  a sidebar on desktop and a collapsible panel on phones and tablets, including
  weapon property and mastery filters (#292, #324), and a Rulesets page (#293).
- Print and Download controls with a format menu (#308), and print layouts
  chosen by printed page width (#307).
- Import and export with Open5e: creatures, spells, magic items, conditions,
  and equipment download as Open5e records, and Open5e files import through
  `import` issues (#311, #314), from allowlisted sources with attribution
  (#313).
- A Homebrew section on SRD pages, listing the custom entries that link to
  them (#355).
- An SRD filter: every SRD entry that takes tags is tagged `source: SRD`
  (#343).
- Validation rejects a creature spell written as text when the library has
  that spell as an entry (#363).

### Changed

- The `magic-item` type is now `item`. Every ID is kept, and the old URLs
  redirect.
- A spell's classes link to the class pages (#283).
- The separate galleries are replaced by the Library page, and their URLs
  redirect to it (#293).
- Filters keep their URL form, so bookmarked views still work.

### Fixed

- Class pages and pages with long slash-separated names fit a 320px phone
  screen (#300, #301).
- Screen readers read filter values as a list (#304).
- Filter tree nodes open and close only from their own disclosure controls
  (#347).
- An Open5e export of a tool, mount, or vehicle says it won't import back
  (#361).

## [1.0.0] - 2026-11-04

### Added

- A browsable library of D&D 5e creatures, spells, and magic items on the
  SRD 5.2, with SRD entries reproduced as published and original entries
  alongside.
- Stat blocks and spell cards rendered as the SRD 5.2 prints them, with
  derived values computed from each entry's inputs.
- A gallery per type with search, sort, and filters kept in the URL, and a
  list that works without JavaScript.
- Export as JSON, PNG, and print, for one entry or a filtered set.
- Content requests and revisions through GitHub issues, fulfilled by
  scheduled routines as reviewed pull requests.

[1.2.0]: https://github.com/bardic-inspiration/ttrpg-library/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/bardic-inspiration/ttrpg-library/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/bardic-inspiration/ttrpg-library/releases/tag/v1.0.0
