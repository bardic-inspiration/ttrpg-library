# Encounter guideline (dnd-5e-2024)

How to write an `encounter` entry. The schema is
`schemas/encounter.schema.json`, and
[Encounters](../../../docs/rulesets.md#encounters) describes it; its parts are
the kit's ([Arrangements](../../../docs/content-model.md#arrangements)). This
file covers what the schema and the checks can't: what an encounter is for,
names, and prose.

Every encounter is custom: the SRD prints none
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- An encounter is a scene a DM picks up for prep. `summary` is one plain
  sentence saying who's in it and where ("Bandits waylay travelers on a
  forest road").
- `description` is left out: the parts hold the encounter's text, in the
  order the page reads.

## Naming

- What the table calls the scene, in title case: "Bandit Ambush", "The
  Warren King's Court".
- Original: no SRD entry's exact name of any type, and no proper noun that
  isn't in SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).

## Balance targets

- Difficulty is derived from the roster's creatures and counts; never
  write XP. A spawn table's rows are designed one per difficulty, each
  reading as its name says.

## Prose style

- A `description` part is player-facing: what the party sees and hears, in
  two to four sentences, read aloud or paraphrased.
- A `dm-guide` part says how to run it: what the creatures want, and when
  they flee or surrender.
- A sequence's stages each say what the creatures do on their turns, then
  what moves play on.

## Dependencies and SRD references

- **Every creature, item, and map** an encounter names is in the library or
  written by the same request, before the encounter. A roster names its
  creatures by ref; a character in the scene is a `{ref:…}` in its text, not
  a roster line.
- An encounter doesn't name the module it's part of: the module lists it.
