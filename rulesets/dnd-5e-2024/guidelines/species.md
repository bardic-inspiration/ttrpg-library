# Species guideline (dnd-5e-2024)

How to write a `species` entry and its `species-trait` components. The
schemas are `schemas/species.schema.json` and `schemas/species-trait.schema.json`,
and [Species](../../../docs/rulesets.md#species) describes them. This file
covers what the schemas can't: what makes a species, names, power, prose, and
links.

These rules are for custom species. An SRD species and its traits are
reproduced faithfully ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A species is a people with its own physiology or magic: not a culture, a
  nation, or a class. `summary` is one plain sentence naming what sets it
  apart: "Small, quick-footed folk who see in the dark and slip through
  crowds."
- `description` says where the people come from and how they look, in two or
  three sentences, with no mechanics. SRD species print no lore, so the story
  goes here.
- Traits are written in the SRD's second person and present tense: "You have
  Darkvision with a range of 60 feet."

## Naming

- The species: a plural-friendly noun in title case ("Duskling"), not an
  adjective or a place.
- Each trait: a short title for what it does ("Stone Sense"), unique within
  the species. A trait's `id` is the species' id, a hyphen, and the slug of
  its name: `duskling-stone-sense`.
- Original: no SRD species' name or a near collision with one, and no SRD
  entry's exact name of any type. A trait may share a common SRD trait name
  where it is the same rule ("Darkvision").
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- Ids never change. On a collision, pick a different name; never add a number.

## Balance targets

A custom species is balanced against the SRD species.

- **Creature type:** Humanoid, unless the request says otherwise, as every SRD
  species is.
- **Size and speed:** Medium or Small (or both, chosen at selection), and a
  Speed of 30 feet; 35 feet only in place of another trait, as the Goliath
  has.
- **Traits:** four or five, like the SRD's: usually a sense (Darkvision 60 or
  120 feet), a defense (a Resistance, or Advantage on saves against one
  condition), and one or two signature traits. A trait used more than once
  per rest is limited the SRD's way: a number of uses equal to your
  Proficiency Bonus, regained on a Long Rest.
- A trait that grows with level says so in its text, as Draconic Flight does
  ("When you reach character level 5, …").

## Prose style

- List traits in `traits` in the order the page should print them: the
  signature traits first if the species is built around them, as the
  Dragonborn's ancestry is, otherwise the SRD's usual order.
- A trait is its title and text. Don't end the name with a period, and don't
  write the opening sentence ("As a Duskling, you have these special
  traits."); the template words it. Set `intro` only to reproduce an SRD
  species that words it otherwise.
- A choice among options is titled paragraphs in the trait's text,
  `***Option.*** Text`, as Giant Ancestry's boons are. A table is a titled
  table in the text.
- Rules text uses the markdown subset only. Numbers are written as they read;
  species derive nothing but their sizes.

## Dependencies and SRD references

- **Spells** a trait grants are linked with tokens, `*{ref:spell/misty-step}*`,
  in its text and its tables. A custom spell it grants is added in the same
  batch.
- **Conditions, glossary terms, and equipment** are linked where the text
  names them exactly ([Mentions in text](../../../docs/content-model.md#references)).
- **Traits** are added in the same batch as their species, each listed once
  in its `traits`.
