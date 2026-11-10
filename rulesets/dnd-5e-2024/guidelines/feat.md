# Feat guideline (dnd-5e-2024)

How to write a `feat` entry. The schema is `schemas/feat.schema.json` and
[Feats](../../../docs/rulesets.md#feats) describes it. This file covers what
the schema can't: category, names, power, prose, and links.

These rules are for custom feats. An SRD feat is reproduced faithfully
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A feat is a talent or a piece of training a character takes, named for
  what it lets them do. `summary` is one plain sentence naming its category
  and its main benefit: "An origin feat: you spot hidden doors and traps."
- `description` says who learns it and how it looks in play, in two or three
  sentences, with no mechanics.
- Benefits are written in the SRD's second person and present tense: "You
  have Advantage on…", "When you hit a creature…".

Exemplar (summary and stats):

> **Lantern Sense.** An origin feat: you notice hidden things in dim light.
>
> *Origin Feat.* You gain the following benefits.
> *Dim Light Eyes.* You don't have Disadvantage on Wisdom (Perception) checks
> in Dim Light.
> *Quick Search.* You can take the Search action as a Bonus Action.

## Naming

- A short noun phrase in title case for the talent ("Lantern Sense", "Shield
  Breaker"), not a sentence or a class name.
- Original: no SRD feat's name or a near collision with one, and no SRD
  entry's exact name of any type. "Boon of …" names are the SRD's epic boons;
  a custom epic boon may use the pattern with its own words.
- No real-world trademarks, brands, or people, and no proper noun that isn't in
  SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number.

## Balance targets

A custom feat sits in the category whose power it matches, and is balanced
against that category's SRD feats.

| Category | Like | Prerequisite | Power |
|---|---|---|---|
| `origin` | Alert, Savage Attacker | None: a background grants it at level 1 | One or two small benefits, usable from level 1 |
| `general` | Grappler, Ability Score Improvement | `level` 4, sometimes an ability score | An ability score increase of 1 plus two or three benefits, or a larger single benefit |
| `fighting-style` | Archery, Defense | "Fighting Style Feature" | One narrow combat bonus |
| `epic-boon` | Boon of Fate | `level` 19 | An ability score increase of 1, to a maximum of 30, plus one strong benefit |

- The validator warns on an origin feat with a prerequisite, a general feat
  below level 4, and an epic boon below level 19. Follow the SRD unless the
  request says otherwise, and say why in the PR.
- A benefit that recurs is limited the SRD's way: once per turn, or a number
  of uses equal to your Proficiency Bonus regained on a Long Rest.
- A feat that can be taken again has a `repeatable` paragraph saying how:
  "You can take this feat more than once."

## Prose style

- More than one benefit: titled `benefits`, each a short title and its text.
  Don't write "You gain the following benefits."; the template adds it. Don't
  end a title with a period.
- One benefit: a single `text`, with no title.
- An ability score increase is a titled benefit worded as the SRD's:
  "Increase your Strength or Dexterity score by 1, to a maximum of 20."
- `level` holds the prerequisite's level; `prerequisite` holds the rest, as
  the SRD words it ("Strength or Dexterity 13+"). Don't write "Level 4+" or
  "Prerequisite:"; the template does.
- Rules text uses the markdown subset only. Numbers are written as they read;
  feats derive nothing.

## Dependencies and SRD references

- **A spell** the feat grants is linked with a token, `*{ref:spell/misty-step}*`,
  italic as the SRD prints spell names. A custom spell it grants is added in
  the same batch.
- **Conditions, equipment, and glossary terms** are linked where the text
  names them exactly ([Mentions in text](../../../docs/content-model.md#references)).
- A feat never needs its backgrounds: a background links the feat it grants.
