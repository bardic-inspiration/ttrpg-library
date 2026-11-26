---
issue: 374
depends: [maps]
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

## Design

### Layers

| Layer | Holds | Refs mean |
|---|---|---|
| **Ruleset** | How things work: derivations, rules data, rules pages | n/a |
| **Content** | Typed entries: creatures, items, spells, characters… | Rules: "casts", "grants", "requires" |
| **Arrangements** | Encounters, modules, (later) sourcebooks | Inventory: what's included, where it is, how it shows |

The library stays organized by type. Arrangements put typed entries together;
content never lives inside them. Every piece is a standalone entry that a DM
may lift out and adapt.

### The kit

An arrangement's `stats.parts` is an ordered list of kit parts, each
`{ "part": "<kind>", … }`. The page renders them in order, each by the
part's shared component, so every arrangement reads alike. Each arrangement
type's schema allows its own subset.

| Part | Holds | Encounter | Module |
|---|---|---|---|
| `prose` | A titled or untitled text section | ✓ | ✓ |
| `description` | Player-facing text, read aloud or paraphrased | ✓ | ✓ |
| `dm-guide` | Instructions for running it | ✓ | ✓ |
| `roster` | Creature refs with counts | ✓ | |
| `spawn-table` | Rosters by difficulty | ✓ | |
| `sequence` | How it plays out | ✓ | ✓ |
| `table` | A titled pipe table (random, loot, cross-cutting) | ✓ | ✓ |
| `loot` | Coins and items by difficulty | ✓ | |
| `map` | A map, or a zone of one | ✓ | ✓ |

The module parts are in [`modules.md`](modules.md).

### Refs in arrangements

- **Inventory, not rules.** A ref in a part says what's included and how it
  shows. Its back-reference reads "Appears in", or "Part of" for a module's
  contents, apart from rules refs.
- **Each ref says how it shows:** `"show": "link"` (the default) prints its
  name linked; `"card"` embeds the target's card; `"thumbnail"` embeds a
  small form (a map's diagram, an entry's art). How the parts are assembled
  is the entry's design choice.
- **Room to grow.** A ref in a part is an object, so a dependency strength
  (#374's first open question) can be added as a key later with no migration.
- **Containment is listed by the container only.** A module lists the
  encounters in it; an encounter doesn't name its module, and its page shows
  "Part of" as a back-reference (P3).

### Rosters and spawn tables

An encounter has exactly one `roster` or one `spawn-table` (error otherwise).

- **`roster`:** creature refs, each with a `count` (1 or more) and `show`.
  A character in an encounter is a ref in its text, not a roster line, since
  characters have no XP.
- **`spawn-table`:** rows keyed by difficulty, `low`, `moderate`, or
  `high`, each at most once, each a roster whose counts may be dice
  (`1d6+2`). The author designs each row; the DM chooses one, or rolls for it
  when the table gives each row a range on a die (`1d6`: 1–2 low, 3–5
  moderate, 6 high).

### Difficulty

Difficulty compares the party against the encounter:

- **The encounter's side,** derived: f(Roster) × E. f(Roster) is the sum of
  each creature's XP by its CR times its count. For a spawn table, each row
  has its own, with a minimum, average, and maximum from its dice.
- **E,** the environment multiplier: an authored input,
  `stats.environment`, with `multiplier` (above 0, not 1) and a `note` saying
  why ("difficult terrain and a collapsing floor"). Without it, E is 1. Any
  E is a warning for the reviewer, as `adjust` is.
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

### Sequence

- **Structured:** a `trigger`, then `stages`, each with a name, a turn loop
  saying how the DM runs the creatures, and a transition to the next, then
  a `victory` condition.
- **Or an example:** one prose text showing how it might play.
- Every node is markdown-subset text with `{ref:…}` tokens. Event string
  formats wait for the v2.0.0 builder (#370).

### Loot

- **`loot`:** rows keyed by difficulty, as a spawn table's are, each with
  coins (a dice expression and a unit, `4d6 × 10 GP`) and item refs with
  counts.
- **`table`:** any other table, such as a random loot table.

### Setting

An encounter may be set in a map, or in a zone of one, with
`stats.setIn`, a map ref with an optional zone
([Pointing into a map](maps.md#pointing-into-a-map)). The map's page then
lists it under the zone. A `map` part shows the map on the page; `setIn`
alone doesn't.

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
