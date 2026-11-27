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

### The module type

`module` is an arrangement type in `dnd-5e-2024`, at
`content/dnd-5e-2024/module/<id>.json`. Its `stats` hold:

- **`parts`:** the ordered kit parts below.
- **`length`:** a label, one of `one-shot`, `delve`, or `multi-session`.
- **`levels`:** the party levels it's written for, a minimum and maximum
  (authored, since nothing derives them).

There is no tier between an encounter and a module: a dungeon is a module
that uses fewer parts.

### Module parts

A module allows the shared parts `prose`, `description`, `dm-guide`,
`sequence`, `table`, and `map`
([Encounters](../../docs/rulesets.md#encounters)), and two of its own:

| Part | Holds |
|---|---|
| `hook` | A way to draw the party in: text, with refs |
| `arrangement` | An encounter or module ref, with `show`, in story order |

Characters and creatures appear as refs in any part's text or as `show:
"card"` refs, as any entry may; there is no NPC part.

### Containment

- **A module contains encounters and other modules** through its
  `arrangement` parts, in order. A five-room dungeon is a small module and
  can be one chapter of a larger one.
- **An arrangement may be in several modules.** None owns it; each piece
  stays standalone.
- **No cycles:** a module can't contain itself, directly or through others
  (error).
- **"Part of"** shows on each contained entry's page as a back-reference.

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

- The `module` type validates its parts, containment, and the no-cycle rule.
- The module page renders every part, the structured summary, and each
  ref's `show`, on screen and in print.
- Contained entries show "Part of" their modules.
- `generate` makes a module and its new entries in one batch.
- The docs describe modules and containment.

## Out of scope

- Sourcebooks and rule additions, and how far a sourcebook's rule additions
  reach (#374's second open question).
- Filter propagation through containment (#374's first open question).
- In-app authoring and publishing (v2.0.0, #370).
