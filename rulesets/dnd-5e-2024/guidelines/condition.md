# Condition guideline (dnd-5e-2024)

How to write a `condition` entry: a custom condition, a ruleset extension
([Rules data](../../../docs/rulesets.md#rules-data)). The schema is
`schemas/condition.schema.json` and [Conditions](../../../docs/rulesets.md#conditions)
describes it. This file covers what the schema can't: when a condition is
warranted, names, power, prose, and links to the SRD conditions.

These rules are for custom conditions only. The SRD conditions are ruleset
primitives in `rulesets/dnd-5e-2024/rules/condition/`, reproduced faithfully
and never authored as entries. A custom condition is always a custom entry:
it never sets `meta.source.srd`.

## Tone and voice

- A condition is a state a creature is in, named for what it feels like from
  inside: "Mired", "Hexed", "Frostbitten". `summary` is one plain sentence
  saying what the condition does, in words a player would use at the table.
- `description` says where the condition comes from and how it looks to an
  onlooker, in two or three sentences, with no mechanics.
- A condition is warranted only when several entries share the state: a
  creature's touch, a spell, and an item that all inflict it. A one-off effect
  stays in the entry that causes it.

Exemplar (summary, description, and effects):

> **Mired.** Thick mud or magic drags at your legs, slowing you and spoiling
> your footing.
>
> Bog spirits and swamp witches leave their victims knee-deep in mud that
> clings long after the ground is dry. Onlookers see a creature fighting
> every step.
>
> *Slowed.* Your Speed is halved.
> *Unsteady.* You have Disadvantage on Dexterity saving throws.

## Naming

- One word or a short phrase, in title case, describing the state:
  an adjective or a past participle, as the SRD's are ("Mired", not "Mud
  Trap").
- Original: no SRD condition's name or a near collision with one ("Poisned",
  "Grapple"), and no SRD entry's exact name of any type.
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number. A condition's id is unique across the
  SRD conditions too, since they share keys.

## Balance targets

A custom condition is measured against the SRD conditions it sits between.

| Weight | Like | Effects |
|---|---|---|
| Light | Poisoned, Deafened | One effect: Disadvantage on one kind of roll, or one sense lost |
| Moderate | Restrained, Frightened | Two or three effects: a Speed change plus a roll penalty |
| Heavy | Stunned, Paralyzed | Builds on Incapacitated, adds automatic failures or Critical Hits |

- Match the weight to what inflicts it: a heavy condition needs a save, a
  short duration, or a high cost to inflict.
- A condition never deals damage on its own each turn; damage over time
  belongs to the effect that inflicts the condition.

## Prose style

- Each effect is a short title and its rules text, written in the SRD's
  second person and present tense: name "Speed 0", text "Your Speed is 0 and
  can't increase." Don't end the name with a period; the template adds it.
- Don't write the opening sentence ("While you have the … condition, you
  experience the following effects."); the template words it from the name.
- Two to four effects. Order them as the SRD does: what you can't do, then
  rolls against you, then your own rolls, then how the condition ends if it
  ends on its own.
- Rules text uses the markdown subset only. Numbers are written as they read;
  conditions derive nothing.

## Dependencies and SRD references

- **An SRD condition** is in the library as a primitive: link it with a
  token, `{ref:condition/incapacitated}`, which renders its name. "You have
  the {ref:condition/incapacitated} condition" builds on it rather than
  restating its effects. Link it wherever the text names it exactly.
- **Another custom condition** is linked the same way, by its key.
- A condition never needs a dependency entry. The creatures, spells, and items
  that inflict it link to it from their own text.
