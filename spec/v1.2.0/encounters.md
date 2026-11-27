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
- [Difficulty calculator](../../docs/site.md#difficulty-calculator): the
  encounter page's party, budgets, and result, and its XP and E without
  JavaScript.
- [Kit parts](../../docs/site.md#kit-parts): the encounter page's parts in
  order, each ref as its `show` says, the sequence, loot, tables, and the
  `map` part, on screen and in print.
- [Type registry](../../docs/site.md#type-registry): a range facet over a
  span, and [Encounters](../../docs/rulesets.md#encounters): the XP and
  creature type facets and the card.

## Design

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
