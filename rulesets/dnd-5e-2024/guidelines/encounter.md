# Encounter guideline (dnd-5e-2024)

How to write an `encounter` entry. The schema is
`schemas/encounter.schema.json` and
[Encounters](../../../docs/rulesets.md#encounters) describes it; its parts
are the kit's ([The kit](../../../docs/content-model.md#the-kit)). This file
covers what the schema and the checks can't: what an encounter is for,
names, and prose.

Every encounter is custom: the SRD prints none
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- An encounter is a scene a DM runs at the table: an ambush, a boss's
  court, a chase. `summary` is one plain sentence saying who's there and
  what happens ("Outlaws spring an ambush on a lonely stretch of road").
- A `description` part is what the players see and hear, read aloud or
  paraphrased, in present tense and second person or plain description.
  A `dm-guide` part speaks to the DM: what the creatures want and how they
  fight.

## Naming

- The scene's name, in title case: "Bandit Attack", "Warren Throne".
- Original: no SRD entry's exact name of any type, and no proper noun that
  isn't in SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).

## Balance targets

- Write counts, dice, and an environment multiplier; never XP or a
  difficulty, which the ruleset derives from the roster.
- A spawn table's rows are designed apart: the low row is a lighter fight,
  not the high row with creatures struck out.
- An environment multiplier says why the place makes the fight harder or
  easier, in its `note`. Leave it out when the place is neutral.

## Prose style

- Keep each text part to what its kind holds: the scene in `description`,
  tactics in `dm-guide`, how the fight unfolds in `sequence`.
- A structured sequence's stages each say how the DM runs the creatures
  that round, and what moves the fight to the next stage.

## Dependencies and SRD references

- **Creatures and items** are refs to library entries: SRD entries where
  they fit, and any custom creature or item the encounter needs, written
  by the same batch first.
- A character in the scene is a `{ref:…}` token in a part's text, never a
  roster line.
- **A map** the encounter is set in, or shows in a `map` part, is in the
  library; `setIn` names the map and, optionally, one of its zones.
