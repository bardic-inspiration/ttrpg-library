# Changelog

Notable changes to the library, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers
take [Semantic Versioning](https://semver.org/)'s form as
[Releases](docs/workflow.md#releases) reads it.

## [1.1.0] - Unreleased

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

[1.1.0]: https://github.com/bardic-inspiration/ttrpg-library/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/bardic-inspiration/ttrpg-library/releases/tag/v1.0.0
