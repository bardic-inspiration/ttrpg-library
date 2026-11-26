# Character guideline (dnd-5e-2024)

How to write a `character` entry. The schema is
`schemas/character.schema.json` and
[Characters](../../../docs/rulesets.md#characters) describes it. This file
covers what the schema can't: who the character is, names, the build,
prose, and links.

Every character is custom: the SRD prints no pregenerated characters
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).

## Tone and voice

- A character is a ready-made build a DM can run or a player can copy:
  "Brannoc Ashguard", a dwarf soldier who took up a spellbook. `summary` is
  one plain sentence naming the species, the classes, and the role.
- Who the character is goes in `description`: two or three sentences on
  their past and what drives them, with no mechanics.

## Naming

- A personal name, optionally with an epithet, in title case.
- Original: no SRD entry's exact name of any type, and no proper noun that
  isn't in SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number.

## Balance targets

- A character is one legal build at one level. Buy the base scores with
  point buy (27 points, each score 8 to 15), and place the background's
  increases among its three abilities.
- Write choices only: the refs and picks the build makes. The ruleset
  derives the level, scores, saves, skills, Hit Points, Armor Class,
  attacks, and spellcasting, so none of them is ever written.

## Prose style

- Abilities and skills are keys (`int`, `sleight-of-hand`); the profile
  prints their names.
- List `classes` in the order taken; the first is the starting class.
- Each feat names its `source`: the background, the species, or the class
  and class level whose feature grants it.
- Each group of `choices` names the entry that offers it, and holds only
  its picks.
- Fill every pick a source gives, exactly
  ([Grants](../../../docs/rulesets.md#grants)): each feat a feature or trait
  grants, each skill, Expertise, tool, and language pick, and each option
  list's count. The two origin languages, beside Common, go under the
  background.

## Dependencies and SRD references

- **The species, background, classes, subclasses, feats, options, and
  spells** must be in the library, linked by ref.
- **What's equipped** is SRD equipment (`equipment/<id>`) or items
  (`item/<id>`). An item whose base item could be several pieces of
  equipment names the one it is in `base`.
