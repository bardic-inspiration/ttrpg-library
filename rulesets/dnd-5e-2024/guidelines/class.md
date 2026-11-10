# Class guideline (dnd-5e-2024)

How to write a `class` entry and its `class-feature` and `class-option`
components. The schemas are `schemas/class.schema.json`,
`schemas/class-feature.schema.json`, and `schemas/class-option.schema.json`,
and [Classes](../../../docs/rulesets.md#classes) describes them. This file
covers what the schemas can't: what makes a class, names, power, prose, and
links.

These rules are for custom classes. An SRD class and its components are
reproduced faithfully ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A class is a calling with its own way of fighting, casting, or getting by:
  not a culture, a species, or a single trick. `summary` is one plain sentence
  naming its role and its signature: "A spellcaster who bargains with spirits
  for a handful of powerful spells."
- `description` says who takes up the class and how it looks at the table, in
  two or three sentences, with no mechanics. SRD classes print no lore in
  their entries, so the story goes here.
- Features are written in the SRD's second person and present tense: "You
  can take a Bonus Action to…".

## Naming

- The class: a singular noun for its practitioner, in title case
  ("Wayfinder"), not an adjective or a place.
- Each feature and option: a short title for what it does ("Trail Sense"),
  unique within the class. Its `id` is the class's id, a hyphen, and the slug
  of its name: `wayfinder-trail-sense`. A feature printed again at a later
  level, as Improved Brutal Strike is, is one feature with several `levels`,
  unless the later printing is described on its own; then its id adds the
  level: `wayfinder-trail-sense-13`.
- Original: no SRD class's name or a near collision with one, and no SRD
  entry's exact name of any type. A feature may share a common SRD feature
  name where it is the same rule ("Extra Attack", "Ability Score
  Improvement").
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- Ids never change. On a collision, pick a different name; never add a number.

## Balance targets

A custom class is balanced against the SRD class nearest it in role.

- **Levels:** it covers levels 1–20, as every SRD class does: its "<Class>
  Subclass" feature at level 3, with later subclass levels the class's own
  (usually three more, by level 14 or 18); Ability Score Improvement at 4, 8,
  12, and 16; and Epic Boon at 19. Every level has a feature or a subclass
  level.
- **Core traits:** a Hit Point Die and saving throws like the nearest SRD
  class's; one strong save (Constitution, Dexterity, or Wisdom) and one weak
  one (Strength, Intelligence, or Charisma), as every SRD class has.
- **Columns:** a resource the class spends grows with level like the SRD's
  (Rages, Sorcery Points, Focus Points); its values are written as printed.
- **Casting:** a full, half, or pact caster takes the matching
  `progression`; its slots derive from it. Cantrips and prepared spells
  follow the nearest SRD caster's numbers.
- **Spell list:** mostly existing spells, listed in `spells`; a new spell
  only where the class's theme needs one, added in the same batch and listed
  in `spells` too. Keep the list near the size of the nearest SRD caster's.
- **Option lists:** enough options to choose from at every level that grants
  one, with prerequisites for the stronger ones.

## Prose style

- List features in `features` in printed order: by level, then table order
  within a level. The template prints each as "Level 1: <Name>" and builds
  the Features table from their `levels`; don't write either.
- Don't write the sentences the template words: "Becoming a <Class> …", the
  "As a Level 1 Character" bullets, the class features' intro, and the spell
  list's intro. `multiclass` is the bullets under "As a Multiclass
  Character", as a list.
- A feature's sub-rules are titled paragraphs in its text ("***Cantrips.***
  …"), and a table is a titled table in it.
- An option that takes a resource puts it in `cost` ("1 Focus Point"); an
  option that can be taken more than once says how in `repeatable`.
- Rules text uses the markdown subset only. The numbers in feature text are
  authored; the proficiency bonus and spell slots in the table are derived.

## Dependencies and SRD references

- **Spells** a feature names are linked with tokens, `*{ref:spell/misty-step}*`.
- **Feats** it grants ("the Ability Score Improvement feat") are linked with
  a token where the feat is in the library.
- **Equipment** in its starting equipment is a ref, as a background's is
  ([Starting equipment](../../../docs/rulesets.md#starting-equipment)).
- **Options** a prerequisite names are linked with a token:
  `{ref:class-option/wayfinder-far-step}`.
- **Features and options** are added in the same batch as their class, each
  listed once.
