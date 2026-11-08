# Equipment guideline (dnd-5e-2024)

How to write an `equipment` entry: custom equipment, a ruleset extension
([Rules data](../../../docs/rulesets.md#rules-data)). The schema is
`schemas/equipment.schema.json` and [Equipment](../../../docs/rulesets.md#equipment)
describes it. This file covers what the schema can't: when equipment is
warranted, names, prices and stats, prose, and links.

These rules are for custom equipment only. The SRD's weapons, armor, tools,
adventuring gear, and mounts and vehicles are ruleset primitives in
`rulesets/dnd-5e-2024/rules/equipment/`, reproduced unmodified and never
authored as entries. Custom equipment is always a custom entry: it never sets
`meta.source.srd`.

## Tone and voice

- Equipment is mundane: a tool of a trade, a piece of kit, a weapon a
  culture favors. Magic belongs in an `item`, which can name equipment as
  its base.
- `summary` is one plain sentence saying what the equipment is and what it's
  for, in words a player would use at the table.
- `description` says who makes or carries it and what it looks like, in two
  or three sentences, with no mechanics.
- `text`, when the equipment does something beyond its stats, reads like SRD
  5.2 gear: second person, present tense, plain.

Exemplar (summary, description, and text):

> **Tidewater Net.** A weighted fishing net that sinks fast and holds what it
> catches.
>
> Coastal villages weave these nets from tarred cord and hang them from
> every doorway to dry. A good one outlasts the fisher who made it.
>
> When you take the Attack action, you can replace one of your attacks with
> throwing a Tidewater Net at a creature you can see within 10 feet of
> yourself. The target must succeed on a Dexterity saving throw (DC 8 plus
> your Dexterity modifier and Proficiency Bonus) or have the
> {ref:condition/restrained} condition until it escapes.

## Naming

- An object, named as a shopkeeper would: "Tidewater Net", "Surveyor's
  Chain", "Boarding Axe". Title case, at most 80 characters.
- Original: no SRD equipment's name or a near collision with one ("Long
  Sword", "Lantern, Shuttered"), and no SRD entry's exact name of any type.
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number. Its id is unique across the SRD
  equipment and groups too, since they share keys.

## Balance targets

Custom equipment sits in the leaf group whose SRD items it matches, and is
priced and statted against them.

| Group | Matches |
|---|---|
| Simple weapons | Damage up to 1d8 (1d6 with Light), at most two properties, cost up to 25 GP |
| Martial weapons | Damage up to 1d12 or 2d6, Heavy or Two-Handed for the biggest dice, cost 5–75 GP (firearms more) |
| Light, Medium, Heavy armor | The AC, Strength, and Stealth of the SRD armor at the same cost |
| Tools | One ability, one or two Utilize uses at DC 10–20, cost 1–50 GP |
| Adventuring gear | An effect no bigger than the SRD's thrown flasks (2d6 at most, a save of DC 8 plus your Dexterity modifier and Proficiency Bonus), cost by usefulness |

- A weapon uses SRD properties and an SRD mastery property; a new property
  is a new mechanic, which waits for v3.
- Equipment is never stronger than SRD equipment of the same cost.

## Prose style

- Name the group in `group`, and fill only the block for its category: a
  weapon's `weapon`, armor's `armor`, a tool's `tool`. The category is
  derived from the group.
- Write numbers as they read; equipment derives only its category and its
  cost in gold pieces. A DC in `text` or `utilize` is written as printed
  ("DC 15").
- Gear that comes in forms sharing one description has `variants`, each with
  its own cost and weight, and no cost or weight of its own.
- Rules text uses the markdown subset only.

## Dependencies and SRD references

- **An SRD condition or equipment** is in the library as a primitive: link it
  with a token wherever the text names it exactly,
  `{ref:condition/restrained}` or `{ref:equipment/rope}`.
- **A weapon's properties and mastery** are typed refs to the primitives on
  the Weapons page, `weapon-property/<id>` and `mastery-property/<id>`.
- Equipment never needs a dependency entry. Items built on it name it as
  their base item.
