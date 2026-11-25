---
issue: 398
depends: [ui]
---

# Characters

## Goal

A **character** is a ready-made build: a pregenerated character a module
offers, or one a DM runs. v1.2.0 adds the type, its presets, and a profile
page. Its values come from refs to library entries plus a few inputs, and
the ruleset derives the rest. It serves P3 (derived values are never
stored), P2 (only legal builds validate), and P7 (generation writes choices,
not arithmetic).

The character sheet builder, user-owned characters, and editing are v2.0.0
(#370). A preset has the shape a v2.0.0 user character will have; v2.0.0
adds owners and editing, not a second type.

## Current

- [Inputs and derived values](../../docs/rulesets.md#inputs-and-derived-values)
  and [Consistency checks](../../docs/rulesets.md#consistency-checks).
- [Classes](../../docs/rulesets.md#classes): class data (proficiencies,
  `multiclass`, `spellcasting`, features by level) and `deriveLinked`, the
  one derivation today that reads other entries.
- [Species](../../docs/rulesets.md#species),
  [Backgrounds](../../docs/rulesets.md#backgrounds),
  [Feats](../../docs/rulesets.md#feats), and
  [Equipment](../../docs/rulesets.md#equipment).
- [Creatures](../../docs/rulesets.md#creatures): the stat block type, which
  stays apart.
- [The generate skill](../../docs/generation.md#the-generate-skill).

## Design

### Character and creature

Two types, kept apart:

| Type | Is | Values come from |
|---|---|---|
| **Character** | A build | Refs to library entries plus inputs; the ruleset derives the rest |
| **Creature** | A stat block | Its own fields, as today |

The site stores no PC or NPC role. Characters and creatures are each
referenced anywhere a ref may name them, as any entry is; there is no NPC
type or NPC part.

### A snapshot

A character is one build at one level: its current state, not a record of
choices level by level.

### Stats

`character` is a content type in `dnd-5e-2024`, at
`content/dnd-5e-2024/character/<id>.json`. Its `stats` hold only inputs:

- **`species`**, **`background`:** refs.
- **`classes`:** in the order taken, each a class ref, its level, and its
  subclass ref once the class's subclass level is reached. The first is the
  starting class, whose saving throws and level 1 hit points apply.
- **`abilities`:** the six base scores, bought with point buy, and the
  background's increases: +2 and +1, or +1 to all three, among the
  background's three abilities.
- **`feats`:** each a feat ref with where it came from (the background, or a
  class level whose feature grants a feat) and any choice the feat asks for,
  such as an Ability Score Improvement's increases.
- **`options`:** class option refs, under each option list the class levels
  allow.
- **`choices`:** the skill, tool, language, and expertise picks the species,
  background, and classes offer.
- **`equipped`:** refs to the armor, shield, and weapons the character
  wears and wields, each an SRD equipment primitive or an item. There is no
  inventory.
- **`spells`:** spell refs: cantrips and the spells prepared, which the
  profile lists.

The envelope's `summary` and `description` hold who the character is.

### Derived

The ruleset derives, from the inputs and the entries they reference:

- the total level, proficiency bonus, final ability scores and modifiers,
  saving throws, skills, and Passive Perception;
- Hit Points at the fixed value per level (the Hit Point Die's maximum at
  level 1, then its fixed average), plus the Constitution modifier per
  level;
- Initiative and Speed;
- Armor Class from the equipped armor and shield and the Dexterity rule of
  the armor's category, and attacks from the equipped weapons (bonus, damage,
  and properties);
- spellcasting: each class's ability, save DC, and attack bonus, and spell
  slots from the Multiclass Spellcaster or Pact Magic table;
- the features each class and subclass gives at its level, the species'
  traits, and the proficiencies each source grants.

This generalizes `deriveLinked`: a derivation may read the entries an entry
references, and the build resolves them before deriving. Encounters use it
too ([`encounters.md`](encounters.md)).

The point costs and the XP budgets aren't in `tables.json` yet; this area
adds the point costs, from SRD 5.2's "Character Creation".

### Validation

Only legal builds under `dnd-5e-2024` validate. New consistency checks
(errors unless noted):

| Check |
|---|
| Each base score is 8 to 15, and the point costs total 27 or less |
| The background's increases are +2/+1 or +1/+1/+1, only among its three abilities |
| No final score above 20 |
| Class levels total 1 to 20; no class repeats |
| With more than one class, each class's multiclass prerequisite is met by the final scores, the starting class's included |
| A subclass belongs to its class and is present exactly when the class's level reaches its subclass level |
| One feat from the background, which is its origin feat; each other feat comes from a class level that grants one, meets its prerequisite, and only a repeatable feat repeats |
| Options and choices fill exactly the counts their sources allow at the character's levels |
| Each spell is on a list of one of its classes, at a level its slots can cast, and cantrips and prepared spells are within each class's counts |
| Equipped armor and weapons the character lacks proficiency with (warning) |
| Any `adjust` (warning), as on creatures |

`adjust` covers a deliberate deviation, as elsewhere.

### The profile

A character's page is a **profile**, not a play sheet: what a DM needs to
run the character, or a player needs to copy a preset onto their own sheet.
It has no fill-in boxes and nothing tracked at the table (current HP, spent
slots, inventory).

- **Identity:** name, species, background, and class levels with subclasses
  ("Fighter 3 (Champion) / Wizard 2").
- **Abilities:** each score, modifier, and saving throw.
- **Combat:** Armor Class, Hit Points, Initiative, Speed, proficiency bonus,
  and Passive Perception.
- **Skills and proficiencies:** skills with their bonuses, expertise
  marked; armor, weapons, tools, and languages.
- **Attacks:** one line per equipped weapon.
- **Spellcasting:** per class, ability, save DC, and attack bonus; spell
  slots; and the spell list by level, each spell linked.
- **Features:** the class, subclass, species, and feat features by name,
  each linked to its section.
- **Equipment:** what's equipped, linked.
- **Description:** the character's lore.

It's built from the shared components ([`ui.md`](ui.md)) and laid out at
390, 820, and 1440px, and in print.

### In the Library

- **Facets:** class, background, and species (ref facets), and level (a
  range, of the derived total level).
- **Card:** name, class levels, species, background, and summary.
- **Exports:** Print, PNG, and JSON, as for any type. No translator takes
  characters.

### Generation

`generate` becomes an **umbrella**: the shared steps (inputs, collisions,
validation, the PR) stay in the skill, which routes each type to a
**procedure**. Today's types keep the one procedure they have. Characters
get the first new one: choose the build's refs, buy the scores, and fill the
choices the build allows, writing choices only. Encounters and modules add
theirs ([`encounters.md`](encounters.md), [`modules.md`](modules.md)).
Characters come only by request, with no gap buckets, and every preset is
custom ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)).

## Cases

- A fighter-wizard multiclass: `class/fighter` 3 with `subclass/champion`
  and `class/wizard` 2, `species/dwarf`, `background/soldier` with its
  origin feat `feat/savage-attacker`, wearing `item/armor-1-2-or-3`, with
  `spell/shield` and `spell/magic-missile` prepared.
- The same build with Intelligence 12: fails the Wizard's multiclass
  prerequisite.
- A build whose point costs total 28: fails.
- A single-class `class/cleric` with `subclass/life-domain` and
  `spell/cure-wounds`, on `species/human` with `background/acolyte`: the
  simplest profile.

## Done when

- The `character` type validates, derives, and renders its profile, with
  the checks above, against the cases.
- Derivations can read referenced entries, and classes use the same path.
- The Library filters characters by class, background, species, and level.
- `generate` routes by type, and makes a preset from an inline request.
- The docs describe the type, its derivations, and the umbrella skill.

## Open questions

- **Features that change derived values,** such as Unarmored Defense,
  Fighting Style feats, and Jack of All Trades: which ones the derivations
  model, and how a feature declares its effect, rather than an `adjust` on
  each character.

## Out of scope

- The character sheet builder, in-app authoring, and user-owned characters
  (v2.0.0, #370).
- Inventory and other state tracked at the table.
- Live composition of equipment from library search (v2.0.0).
