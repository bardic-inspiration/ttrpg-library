# Background guideline (dnd-5e-2024)

How to write a `background` entry. The schema is
`schemas/background.schema.json` and
[Backgrounds](../../../docs/rulesets.md#backgrounds) describes it. This file
covers what the schema can't: what makes a background, names, the package,
prose, and links.

These rules are for custom backgrounds. An SRD background is reproduced
faithfully ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A background is the place or occupation that shaped a character before
  adventuring: "Lamplighter", "Ferry Hand". `summary` is one plain sentence
  naming the life and its skills and feat.
- SRD backgrounds print no lore, so a custom one's story goes in
  `description`: two or three sentences on that life and what it taught,
  with no mechanics.

Exemplar (summary and description):

> **Ferry Hand.** A background of river work: Athletics, Nature, and the
> Alert feat.
>
> You poled flatboats across a wide, slow river, reading the current and the
> weather for passengers who never noticed either.

## Naming

- A short noun for the occupation or upbringing, in title case.
- Original: no SRD background's name or a near collision with one, and no SRD
  entry's exact name of any type.
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number.

## Balance targets

Every SRD background has the same parts, and a custom one matches them:

- **Three abilities** that fit the life, as the SRD's Acolyte has
  Intelligence, Wisdom, and Charisma.
- **One origin feat**, from the SRD or the library (the validator rejects
  any other category). A feat taken with a choice carries it as the ref's
  `note`, "Cleric" for Magic Initiate (Cleric).
- **Two skills** and **one tool** that fit the life. A tool with variants or
  a group of tools takes `choose` ("Choose one kind of Gaming Set").
- **Equipment:** a package worth about 50 GP, its coins included, then 50 GP
  as the other option. The validator warns on any other amount.

## Prose style

- Abilities and skills are keys (`int`, `sleight-of-hand`); the template
  prints their names. Don't write "(see “Feats”)"; the template adds it.
- Equipment items are refs to equipment or items, with a `count` for "2
  Daggers" and a `note` for "Parchment (10 sheets)". Write a variant, or
  equipment whose SRD name reads differently in a list, as text ("20 Arrows",
  "Traveler's Clothes").
- Put coins in `gp`, never in an item.

## Dependencies and SRD references

- **The feat** must be in the library. A new custom origin feat it grants is
  added in the same batch, following `feat.md`.
- **The tool and the equipment** are SRD equipment, linked by ref
  (`equipment/<id>`), or items (`item/<id>`).
