# Subclass guideline (dnd-5e-2024)

How to write a `subclass` entry and its `class-feature` components. The
schemas are `schemas/subclass.schema.json` and
`schemas/class-feature.schema.json`, and
[Subclasses](../../../docs/rulesets.md#subclasses) describes them. This file
covers what the schemas can't: what makes a subclass, names, power, prose, and
links.

These rules are for custom subclasses. An SRD subclass and its features are
reproduced faithfully ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A subclass specializes its class: a tradition, an oath, a patron, or a
  school within it. `summary` is one plain sentence naming the class and the
  specialty: "A Sorcerer subclass whose magic comes from storms."
- `tagline` is the SRD's short imperative line under the name: "Channel the
  Fury of the Sky".
- `text` is the intro, in two to four sentences of the SRD's second person:
  where the power comes from and what it looks like. `description` adds lore
  only if the intro doesn't already carry it.

## Naming

- The subclass: a name in title case that reads after "<Class> Subclass: "
  ("Storm Sorcery", "Oath of the Tide").
- Each feature: a short title, unique within the subclass. Its `id` is the
  subclass's id, a hyphen, and the slug of its name:
  `storm-sorcery-tempest-step`.
- Original: no SRD subclass's name or a near collision with one, and no SRD
  entry's exact name of any type.
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- Ids never change. On a collision, pick a different name; never add a number.

## Balance targets

A custom subclass is balanced against its class's SRD subclass.

- **Levels:** a feature at each of the class's `subclassLevels` and at no
  other level; two features at the first is common.
- **Power:** each feature about as strong as the SRD subclass's feature at
  that level. A once-per-rest feature can usually be restored by spending
  the class's resource, as Dragon Wings is.
- **Spells:** an always-prepared spell list is a titled table in the first
  feature, with a spell level or class level column and tokens for the
  spells, as the SRD's are ("Draconic Spells").

## Prose style

- List features in `features` in level order. The template prints the
  heading "<Class> Subclass: <Name>" and each feature as "Level 3: <Name>";
  don't write either.
- A feature's sub-rules are titled paragraphs in its text, and a table is a
  titled table in it.
- Rules text uses the markdown subset only. Numbers are written as they read;
  subclasses derive nothing.

## Dependencies and SRD references

- **Class:** `class` names an existing class; a subclass of a new class is
  added in the same batch as the class.
- **Spells** are linked with tokens, `*{ref:spell/fly}*`, in the text and the
  tables.
- **Features** are added in the same batch as their subclass, each listed
  once.
