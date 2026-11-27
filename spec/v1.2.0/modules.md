---
issue: 374
depends: []
---

# Modules

## Goal

A **module** is an adventure a DM runs across one or more sessions: story
order, hooks, maps, encounters, characters, and cross-cutting tables. It's a
**structured document** built from the kit
([Arrangements](../../docs/content-model.md#arrangements)),
not open-ended markdown or HTML, so every module reads with the site's
standard look while holding a range of content. It serves P6 (the kit owns
presentation) and P3 (each piece is one standalone entry, included by ref).

## Design

The type, its parts, and containment are described in
([Modules](../../docs/rulesets.md#modules)).

### Content a module introduces

A module's batch may add any content entry it needs (a creature, item,
spell, character, even a class or species) as an ordinary library entry,
referenced from the module. It never adds rule additions (conditions,
variant rules, types); those belong to sourcebooks.

### The module page

- **The structured summary** ([`ui.md`](ui.md)) opens the page: its parts
  in order, with each contained arrangement listed under it.
- **Each part** renders by its shared component, and each ref as its `show`
  says: a contained encounter or map shown as a card embeds it; one shown as
  a link is its name.
- **Derived lines:** the counts of encounters and maps it contains,
  through nested modules too.
- **Print** follows the page: what's embedded prints, and links print as
  names.

### In the Library

- **Card:** name, length, levels, and summary.
- **Facets:** none yet. They're judged once modules exist.

### Generation

`generate`'s module procedure outlines the module, then fills its parts:
it refs existing entries where they fit, and adds the encounters, maps,
characters, and content it needs to the same batch, each by its own
procedure.

## Cases

Names are stand-ins.

- **Five-room dungeon:** a small module with a dungeon map of five zones,
  a few prose sections, and five encounters in order, each set in its zone.
- **Nested module:** the five-room dungeon as one chapter of a
  multi-session module with hooks, a town map, two pregenerated characters
  shown as cards, `creature/guard-captain` as a linked contact, and a
  cross-cutting random table.
- **A cycle:** a module that contains a module containing the first fails.

## Done when

- The module page renders every part, the structured summary, and each
  ref's `show`, on screen and in print.
- `generate` makes a module and its new entries in one batch.
- The docs describe modules and containment.

## Out of scope

- Sourcebooks and rule additions, and how far a sourcebook's rule additions
  reach (#374's second open question).
- Filter propagation through containment (#374's first open question).
- In-app authoring and publishing (v2.0.0, #370).
