# Module guideline (dnd-5e-2024)

How to write a `module` entry. The schema is `schemas/module.schema.json`,
and [Modules](../../../docs/rulesets.md#modules) describes it; its parts are
the kit's ([Arrangements](../../../docs/content-model.md#arrangements)). This
file covers what the schema and the checks can't: what a module is for,
names, and prose.

Every module is custom: the SRD prints none
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A module is an adventure a DM runs across one or more sessions. `summary`
  is one plain sentence saying where it goes and what's at stake ("Five
  rooms under a mill, ending at a goblin king's flooded court").
- `description` is left out: the parts hold the module's text, in story
  order.

## Naming

- What the table calls the adventure, in title case: "The Stilled Mill",
  "The Sunken Cistern Delve".
- Original: no SRD entry's exact name of any type, and no proper noun that
  isn't in SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).

## Balance targets

- `levels` are the party levels the module is written for, and its
  encounters' difficulties should read as intended for a party in that
  span. Difficulty is each encounter's own, derived from its creatures;
  a module writes no XP.
- `length` says how long it runs: `one-shot` for a single session,
  `delve` for a short dungeon, `multi-session` for longer.

## Prose style

- A good module reads in story order: how the party is drawn in (a
  `prose` background, `hook` parts), the place (a `map` part before the
  encounters set in it), the scenes (its `arrangement` parts, each an
  encounter or a contained module as a chapter), and a `dm-guide` for the
  whole. A five-room dungeon is a dungeon map of five zones and five
  encounters, one set in each, rising to a climax in the last or the one
  before it. A longer module adds hooks, a town map, its characters, and
  its chapters as contained modules.
- A `table` part holds what's used across scenes, such as a random
  encounter or rumor table; a scene's own table belongs to its encounter.
- A `description` part is player-facing: what the party sees and hears.
- A `hook` part is one way to draw the party in, in two or three sentences.
  The entries it brings in, such as pregenerated characters or a contact,
  are its `refs`, each with the `show` the page should give it.
- A `dm-guide` part says how to run the whole: the order the parts can
  play in, and what changes when the party skips one.

## Dependencies and SRD references

- **Every encounter, module, map, character, creature, and item** a module
  names is in the library or written by the same request, before the
  module. Its `arrangement` parts list the encounters and modules it
  contains, in story order.
- A module adds content as ordinary library entries, never rule additions
  (conditions, variant rules, types).
- A module doesn't name a module it's part of: the container lists it, and
  no module contains itself, directly or through others.
