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
- [Arrangements](../../docs/content-model.md#arrangements),
  [The kit](../../docs/content-model.md#the-kit), and
  [Refs in arrangements](../../docs/content-model.md#refs-in-arrangements):
  the layers, `stats.parts`, inventory refs and `show`, and containment.
- [Encounters](../../docs/rulesets.md#encounters): the `encounter` type, its
  parts' data (roster, spawn table, sequence, loot, map), `environment`,
  and `setIn`, and their checks.

## Design

### Difficulty

Difficulty compares the party against the encounter:

- **The encounter's side,** derived: f(Roster) × E. f(Roster) is the sum of
  each creature's XP by its CR times its count. For a spawn table, each row
  has its own, with a minimum, average, and maximum from its dice.
- **E,** the environment multiplier (`stats.environment`,
  [Encounters](../../docs/rulesets.md#encounters)). Any E is a warning for
  the reviewer, as `adjust` is.
- **The party's side,** g(Party): the sum of each character's XP budget for
  their level, from SRD 5.2's XP Budget per Character table, for each of Low,
  Moderate, and High. For a party at one level it equals the SRD's budget
  times the party's size. This area adds the table to `tables.json`.
- **The result:** an encounter whose XP is at or under the Low budget reads
  Low; up to Moderate, Moderate; up to High, High; above it, Beyond High.

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

The parts' data is built ([Encounters](../../docs/rulesets.md#encounters));
the page renders each by its shared component:

- **Sequence:** a structured one as its trigger, its stages in order (name,
  turn loop, transition), and its victory condition; an example as prose.
  Event string formats wait for the v2.0.0 builder (#370).
- **Loot:** each row's coins (`4d6 × 10 GP`) and items with their counts.
- **Setting:** a `map` part shows the map on the page; `setIn` alone
  doesn't. The map's page lists the encounter under its zone.

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
