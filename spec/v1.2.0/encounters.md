---
issue: 374
depends: []
---

# Encounters

## Goal

An **encounter** is a runnable scene a DM picks up for prep: who's in it,
how it plays, what it yields, and how hard it is for the reader's party. It's
the first **arrangement**: an entry that puts typed content together for
play, rather than a new kind of content. Encounters and modules share one
**kit** of parts, and this area builds the kit and the parts encounters use.
It serves P3 (difficulty is derived, never written), P6 (the kit gives
every arrangement a standard look), and P7 (generation writes rosters and
choices, not arithmetic).

## Current

- [References](../../docs/content-model.md#references): ref objects,
  tokens, and labeled back-references.
- [Tables in text](../../docs/content-model.md#tables-in-text): pipe tables
  in markdown-subset fields.
- [Inputs and derived values](../../docs/rulesets.md#inputs-and-derived-values):
  `adjust` and its warning.
- [Creatures](../../docs/rulesets.md#creatures): `cr`, and XP by CR in
  `tables.json`.
- [Arrangements](../../docs/content-model.md#arrangements): layers, the
  kit, inventory refs and `show`, and containment.
- [Encounters](../../docs/rulesets.md#encounters): the `encounter` type, its
  parts, rosters and spawn tables, and `setIn`.
- [Encounter difficulty](../../docs/rulesets.md#encounter-difficulty):
  f(Roster) × E per roster and spawn table row, E's warning, the XP budgets,
  and the result.

## Design

### The calculator

The encounter page holds a calculator, a Preact island:

- **The reader enters the party:** each character's level, added and
  removed. It starts at four characters of level 1, and the party is kept in
  local storage, wrapped as the cart is ([`ui.md`](ui.md)), so it carries to
  the next encounter.
- **It shows** the party's three budgets, the encounter's XP, and the
  result: one line for a roster, one per row for a spawn table, with each
  row's minimum, average, and maximum.
- **Without JavaScript,** the page shows the encounter's XP and E.

### Parts on the page

The kit's parts and their data are built
([Arrangements](../../docs/content-model.md#arrangements),
[Encounters](../../docs/rulesets.md#encounters)); the encounter page is the
generic detail page until these are:

- **Each part renders in order** by its shared component, so every
  arrangement reads alike, and each ref object as its `show` says: `link`
  prints its name linked, `card` embeds the target's card, and `thumbnail`
  a small form (a map's diagram, an entry's art).

### Sequence

- **Structured:** the trigger, then each stage's name, turn loop, and
  transition, then the victory condition, in order.
- **Or the example,** as one prose text.
- Every node is markdown-subset text with `{ref:…}` tokens, rendered as
  links. Event string formats wait for the v2.0.0 builder (#370).

### Loot

- **`loot`:** its rows in difficulty order, low to high, each with its coins
  (`4d6 × 10 GP`) and its items with counts.
- **`table`:** under its title, as a table in text renders.

### Setting

A `map` part shows the map, or its zone, on the page as its `show` says.
`setIn` alone doesn't; the map's page already lists the encounter under the
zone, labeled "Set here".

### In the Library

- **Facets:** XP (a range of the encounter's f(Roster) × E; a spawn table's
  value is the span of its rows, minimum to maximum, and matches a range
  filter it overlaps), and creature type (the roster's creatures' types).
  A range facet over a span is new, and serves any type.
- **Card:** name, XP, creature types, and summary.
- **Print** follows the page: parts shown as cards print as cards, and
  links print as names.

### Generation

`generate`'s encounter procedure assembles a roster or spawn table, and the
batch adds any custom creature or item it needs, as a batch may today. It
writes counts, dice, and E; never XP.

## Cases

- **Bandit attack, variable:** no map. A description, a DM guide,
  `creature/bandit-captain` and `creature/bandit` with a custom lookout made
  in the same batch, a spawn table with low, moderate, and high rows and a
  `1d6` roll, a prose example sequence, and loot by difficulty.
- **SRD budget examples:** a roster of one `creature/bugbear-warrior` is 200
  XP, Low for four level 1 characters; two `creature/druid` and nine
  `creature/stirge` are 1,125 XP, Moderate for five level 3 characters.
- **Boss fight, fixed:** `creature/goblin-warren-king` with
  `creature/goblin-hexer` and `creature/goblin-boss`, set in a zone of a
  dungeon map, with a structured sequence (trigger, three stages, victory),
  a loot table, and E 1.25 for the room's hazards.
- **A mixed party:** levels 2, 3, and 5, whose budgets are summed per
  character.

## Done when

- The `encounter` type validates its parts, roster or spawn table, and
  environment, and derives XP per roster and per row.
- The calculator gives the cases' results, and keeps the party across
  pages.
- The kit's shared components render each encounter part, with `show`
  honored on screen and in print.
- Back-references label inventory refs apart from rules refs.
- The Library filters encounters by an XP span and creature type.
- The docs describe arrangements, the kit, difficulty, and the calculator.

## Out of scope

- Encounter builders and in-app authoring (v2.0.0, #370).
- Dependency strength and filter propagation: refs leave room for it.
- Event string formats in sequences.
