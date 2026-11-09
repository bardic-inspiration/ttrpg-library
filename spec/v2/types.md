---
issue: 112
depends: [linking]
---

# Types

## Goal

Ruleset completeness: the library holds every SRD 5.2 component a character
or a game draws on, and user content builds on that base and extends it. Every
relationship between them is data, made of links with references tracked
automatically ([`linking.md`](linking.md)). It serves P3 (one source per fact),
P4 (a new type or extension is data, not code), and P5 (SRD fidelity).

## Current

- The library has three types, `creature`, `spell`, and `item`, all
  authored as entries ([Entry envelope](../../docs/content-model.md#entry-envelope)),
  registered in `config/types.json`, and shown as cards and detail pages
  ([Pages and navigation](../../docs/site.md#pages-and-navigation)).
- Damage types, skills, creature types, sizes, and abilities are closed
  lists in `rulesets/dnd-5e-2024/tables.json` and the `common.schema.json`
  enums. Glossary terms, conditions, and equipment are rules types
  ([Glossary](../../docs/rulesets.md#glossary), [Conditions](../../docs/rulesets.md#conditions),
  [Equipment](../../docs/rulesets.md#equipment)), on rules pages.
- Adding a type: [Extending](../../docs/rulesets.md#extending).

## Design

### Rules and content

The ruleset splits into two layers.

- **Rules** are the ruleset's definitions: the basis everything else is
  built on. The rules types are glossary terms, conditions, and equipment.
- **Content** is everything else: the authorable library. The content types
  are spells, items, creatures, feats, backgrounds, species, classes, and
  subclasses.

Within the rules, the line falls between the basis, **ruleset primitives**
shown on rules pages, and the custom additions, **ruleset extensions** shown
as cards. That mechanism is built ([Rules data](../../docs/rulesets.md#rules-data));
extensions are authored like any content entry (a request, the `generate`
skill, a content PR).

Abilities, damage types, skills, creature types, and sizes stay closed lists
in v2. User content can't extend them.

### Content: cards and pages

Content types fall into two tiers by complexity:

- **Card types** are single entries shown as a card: spells, items,
  creatures, feats, and backgrounds.
- **Page types** are assembled from **components**, hidden sub-entries
  linked to their parent, and shown as a page: classes, subclasses, and
  species. In v3, encounters, dungeons, and similar types are page types
  too.

A component is stored as its own entry, linked to its parent, and hidden
from the library: it has no card and no page of its own, and is viewed
through its parent's page. The components are:

- **Class:** class features by level, and option lists such as Metamagic
  and Eldritch Invocations.
- **Subclass:** subclass features by level. A subclass is its own page,
  linked to its class.
- **Species:** species traits.

The card is v1's format; the page is a new one, richer than a card, which
the UI redesign lays out (#113).

### Components

The component mechanism is built
([Components](../../docs/content-model.md#components)). Three component types
serve the three page types:

| Component | Parent lists it in | Is |
|---|---|---|
| `class-feature` | a class's or a subclass's `features` | A feature gained at a level: "Level 1: Rage", "Level 3: Frenzy" |
| `class-option` | a class's `optionLists[].options` | One option of an option list: a Metamagic option, an Eldritch Invocation |
| `species-trait` | a species' `traits` | One special trait: "Breath Weapon" |

Class and subclass features share one type, because their shape is the same
and the parent already says which one a feature is. Each is generated with
its parent, under the parent's guideline. A subclass is not a component: it
names its class ([Subclass](#subclass)), so a custom subclass of an SRD class
leaves the class unchanged.

- **Ids:** `class-feature/barbarian-rage`,
  `class-feature/path-of-the-berserker-frenzy`,
  `class-option/sorcerer-careful-spell`,
  `species-trait/dragonborn-breath-weapon`. The Barbarian's "Improved Brutal
  Strike" at levels 13 and 17 is `class-feature/barbarian-improved-brutal-strike`
  and `class-feature/barbarian-improved-brutal-strike-17`.
- **In the SRD manifest** by type, exact name, and parent key
  (`"parent": "class/barbarian"`), without tiers, so `srd-coverage` proves
  each parent's components complete.

### Extension scope

v2 extension only adds: new content entries, custom conditions, and custom
equipment. Anything that modifies or replaces a rule, or adds a new
mechanic, waits for v3's house rules system.

### Fields

Each type's stored inputs, derived values, consistency checks, guideline,
link fields and labels, registry facets, and gap buckets. A field that takes
a link to one type takes a typed ref
([Shared definitions](../../docs/rulesets.md#shared-definitions)): the new
`FeatRef`, `ClassRef`, and one per component type join `ConditionRef` and
`EquipmentRef`.

#### Creature

- **`immunities.conditions`** holds typed refs to conditions (built:
  [Conditions](../../docs/rulesets.md#conditions)). It becomes an enum
  facet, valued by key and shown by name (the UI's Creature › Immunities ›
  Conditions), with the filter tree (#235).

#### Spell

- **`classes`** takes typed refs to classes (`ClassRef`) in place of the
  class enum, once the SRD classes are in the library. The level line prints
  the same words, each linked: "Level 1 Evocation (Sorcerer, Wizard)". The
  labels are "Classes" / "Spells", and the facet becomes an enum facet
  valued by key and shown by name, like condition immunities. A class's spell
  list is derived from these refs ([Class](#class)), so it's stored once, on
  the spells.

#### Feat

- **Inputs:**
  - `category`: `origin`, `general`, `fighting-style`, or `epic-boon`,
    printed under the name as "Origin Feat", "General Feat", "Fighting Style
    Feat", or "Epic Boon Feat".
  - `level`: the minimum character level of the prerequisite, printed
    first in it as "Level 4+". Optional.
  - `prerequisite`: the rest of the prerequisite as printed, `Text`:
    "Strength or Dexterity 13+", "Fighting Style Feature", "Spellcasting
    Feature". Optional. The heading line reads "General Feat (Prerequisite:
    Level 4+, Strength or Dexterity 13+)".
  - Exactly one of `benefits`, a list of at least one `{ name, text }`, and
    `text`, `Text`. With `benefits`, the template opens with "You gain the
    following benefits.", the sentence every SRD feat with titled benefits
    opens with, and prints each as a bold-titled paragraph, as a condition's
    effects print. A feat without titled benefits (Savage Attacker, Archery,
    Ability Score Improvement) is one `text`.
  - `repeatable`: the "Repeatable" paragraph's text, `Text`, printed last
    as "**Repeatable.** You can take this feat more than once." Optional.
- **Derived:** `repeatable`, true when the input is present, for the facet.
- **Checks** (warnings, since every SRD feat follows them and a custom one
  that doesn't needs a reason): an origin feat has no `level` or
  `prerequisite`; a general feat's `level` is 4 or more, and an epic boon's
  19 or more.
- **Guideline:** `feat.md`: a custom feat sits in the category whose power
  it matches, and is balanced against that category's SRD feats; an origin
  feat is usable at level 1 and takes no prerequisite, because a background
  grants it; titled benefits where there is more than one; an ability score
  increase is a titled benefit worded as the SRD's ("Increase your Strength
  or Dexterity score by 1, to a maximum of 20.").
- **Links and labels:** tokens in text read "References" / "Referenced by".
  A ref to a feat may carry a `note` for the choice it's taken with, which
  prints in parentheses: "Magic Initiate (Cleric)".
- **Registry facets:** `stats.category` (in the order above), `stats.level`
  (range), and `derived.repeatable`. The card shows the category and level,
  and the default sort is category.
- **Gap buckets:** one axis, `stats.category`, valued `origin`, `general`,
  `fighting-style`, and `epic-boon`.

#### Background

- **Inputs:**
  - `abilities`: exactly three different abilities, printed as "Ability
    Scores: Intelligence, Wisdom, Charisma".
  - `feat`: a `FeatRef`, a typed ref to a feat, with an optional `note`:
    "Feat: Magic Initiate (Cleric) (see “Feats”)". The template adds the
    "(see “Feats”)" the SRD prints.
  - `skills`: exactly two different skills, printed as "Skill
    Proficiencies: Insight and Religion".
  - `tool`: an `EquipmentRef` with an optional `choose: true`, which prints
    "Choose one kind of" before the name: "Tool Proficiency: Choose one kind
    of Gaming Set (see “Equipment”)", the parenthetical being the ref's
    `note`.
  - `equipment`: [Starting equipment](#starting-equipment).
- **Derived:** nothing.
- **Checks** (errors): `feat` names an origin feat; the last equipment
  option is coins only. Warning: that option isn't 50 GP, the amount every
  SRD background offers.
- **Guideline:** `background.md`: a background is a place or occupation
  before adventuring; its three abilities, two skills, and tool fit it; its
  feat is an origin feat, from the SRD or the library; its package is worth
  about 50 GP, with 50 GP as the other option. SRD backgrounds print no
  lore, so a custom one's story goes in `description`.
- **Links and labels:** `feat` reads "Grants" / "Granted by"; `tool` reads
  "Tool proficiency" / "Backgrounds"; equipment refs read "Starting
  equipment" / "Starting equipment of".
- **Registry facets:** `stats.abilities`, `stats.skills` (enums over
  lists), and `stats.feat` (valued by key, shown by name). The card shows the
  abilities and the feat, and the default sort is name.
- **Gap buckets:** none. Backgrounds come by request.

#### Starting equipment

Classes and backgrounds share the shape: a list of two or more options, each
`{ items, gp }`, `items` a list of at least one item and `gp` a coin amount,
at least one of the two present. An item is a ref to equipment or an item,
with an optional `count` of 2 or more and `note`, or `Text` for anything
else ("Musical Instrument of your choice", with a token for the
instrument). A counted item prints its count first and adds an "s": "4
Handaxes", "2 Pouches". The template letters the options and words the list:
"Choose A or B: (A) Greataxe, 4 Handaxes, Explorer’s Pack, and 15 GP; or (B)
75 GP", and "Choose A, B, or C" with three. A class's list joins its last
item with "and", and a background's doesn't ("Robe, 8 GP"), as the SRD's
two chapters print them. Variants aren't link targets
([Equipment](../../docs/rulesets.md#equipment)), so "20 Arrows" is text, and "Arcane Focus
(Quarterstaff)" is the Arcane Focus ref with a note.

#### Species

- **Inputs:**
  - `creatureType`: a creature type from the closed list. Every SRD species
    is Humanoid.
  - `sizes`: one or two `{ size, height }`, printed as "Medium (about 5–7
    feet tall)"; with two, joined by "or" and followed by ", chosen when you
    select this species", as the SRD prints them.
  - `speed`: feet, printed "30 feet".
  - `traits`: typed refs to its species traits, in printed order, at least
    one.
  - `intro`: the sentence that opens the traits, `Line`. Optional. The
    template writes "As a Dragonborn, you have these special traits.", with
    "an" before a vowel; the Tiefling's "you have the following special
    traits" sets `intro`.
- **Derived:** `sizes`, the list of sizes, for the facet.
- **Checks:** speed is a multiple of 5 (error).
- **Guideline:** `species.md`: a species is a people with its own physiology
  or magic, not a culture or a class; it's Humanoid unless the request says
  otherwise; its traits are balanced against the SRD species' (most have a
  sense, a defense, and one or two signature traits); a trait that grows
  with level says so in its text, as Draconic Flight does.
- **Links and labels:** structural links to traits aren't listed; tokens in
  trait text, such as the spells in the Elven Lineages table, read
  "References" / "Referenced by".
- **Registry facets:** `derived.sizes` (enum, in size order), `stats.speed`
  (range), and `stats.creatureType`. The card shows sizes and speed, and the
  default sort is name.
- **Gap buckets:** none.

##### Species trait

- **Inputs:** `text`, `Text`. A choice among options (Giant Ancestry's
  boons, Gnomish Lineage) is titled paragraphs in the text, and a table
  (Draconic Ancestors, Fiendish Legacies) is a table in the text, with tokens
  for its spells.
- The page prints each trait as a bold-titled paragraph, in the species'
  order: "**Darkvision.** You have Darkvision with a range of 60 feet."

#### Class

**Inputs.** The Core Traits table:

| Field | Shape and printing |
|---|---|
| `primaryAbility` | `{ abilities, join }`, `join` (`and` or `or`) required with two or more: "Strength or Dexterity", "Dexterity and Wisdom" |
| `hitDie` | `d6`, `d8`, `d10`, or `d12`: "D12 per Barbarian level" |
| `savingThrows` | Exactly two abilities: "Strength and Constitution" |
| `skills` | `{ choose, from }`: "Choose 2: Animal Handling, Athletics, … or Survival"; without `from`, "Choose any 3 skills (see “Playing the Game”)" |
| `weapons` | `Text`: "Simple and Martial weapons" |
| `tools` | `Text`. Optional: "Choose 3 Musical Instruments" |
| `armor` | `Text`: "Light and Medium armor and Shields", or "None" |
| `equipment` | [Starting equipment](#starting-equipment) |
| `multiclass` | `Text`: the bullets under "As a Multiclass Character", as printed. The template writes the "As a Level 1 Character" bullets, which every class shares |

The Features table and what feeds it:

| Field | Shape |
|---|---|
| `features` | Typed refs to its class features, in printed order: by level, and in table order within a level |
| `subclassLevels` | The levels that grant subclass features, ascending: `[3, 6, 10, 14]`. The first is the level of the class's "<Class> Subclass" feature; the table prints "Subclass feature" at the others |
| `columns` | The table's class-specific columns, in order: `{ name, values }`, `values` 20 `Line`s as printed ("2", "+2", "1d6", "+10 ft.", "—"). Optional |
| `spellcasting` | `{ ability, progression, cantrips, prepared }`. Optional. `progression` is `full`, `half`, or `pact`; `cantrips` (optional) and `prepared` are 20 numbers each |
| `optionLists` | Optional: each `{ name, text, options }`, a heading ("Metamagic Options"), its intro `Text`, and typed refs to its class options in printed order |
| `spells` | Typed refs to existing spells that join its spell list. Optional, and only on a custom class (below) |

**Derived**, per level 1–20, from `tables.json`: the proficiency bonus (the
Character Advancement table); the Class Features column, each feature's name
at each of its levels, "Subclass feature" at the later subclass levels, and
"—" at a level with none; and the spell slots, from `progression`. Full
casters read the Multiclass Spellcaster table at their level, and half
casters at half their level rounded up, which reproduces the Paladin's and
Ranger's slots and prints levels 1–5 only. Pact casters read a Pact Magic
table, the Warlock's Spell Slots and Slot Level columns, kept in
`tables.json` so a custom pact caster derives the same way. The table's
columns read Level, Proficiency Bonus, Class Features, then `columns`, then
Cantrips, Prepared Spells, and the slots.

**The spell list** is derived: every spell whose `classes` names the class,
grouped by level, each with its school and the Special column (C for
Concentration, R for a ritual, M for a material component with a cost), under
the template's "<Class> Spell List" intro, which every SRD class shares.
An SRD spell's `classes` can't change, so a custom class that uses SRD spells
lists them in its own `spells`, which join its derived list; a spell's card
still prints only its own `classes`, so an SRD card reads as printed. An SRD
class has no `spells` (error). The build checks each SRD class's derived list
against the SRD's.

**The page** prints, in the SRD's order: the Core Traits table, "Becoming a
<Class> …", the Features table, "<Class> Class Features" with each feature
as "Level 1: Rage", the option lists, and the spell list, then the class's
subclasses (its back-links from subclasses).

**Checks** (errors):

- `features` are in level order, and each feature's levels are within 1–20.
- `subclassLevels` ascend, and the first is the level of a feature in
  `features`.
- `columns[].values` and `spellcasting.cantrips` and `prepared` have 20
  values each.
- Warning: no feature at level 1, or a level other than 1 with neither a
  feature nor a subclass level.

**Guideline:** `class.md`: a class covers levels 1–20, with its subclass at
level 3 and Ability Score Improvement at 4, 8, 12, and 16 and Epic Boon at
19, as every SRD class has; its features, columns, and casting are balanced
against the SRD class nearest it; its spell list is mostly existing spells.

**Links and labels:** `spells` reads "Spells" / "Classes", matching the spell
field; equipment refs read "Starting equipment" / "Starting equipment of";
tokens in text read "References" / "Referenced by"; structural links to
features and options aren't listed.

**Registry facets:** `stats.primaryAbility.abilities`, `stats.hitDie`, and
`stats.spellcasting.progression` (enums). The card shows the primary ability
and hit die, and the default sort is name.

**Gap buckets:** none. A class is too large for gap fill.

##### Class feature

- **Inputs:** `levels`, the levels it appears at in the Features table,
  ascending: the first is the one it's described at ("Level 4: Ability Score
  Improvement"), and the rest repeat it (8, 12, 16). A level may be `{ level,
  note }`, the note printed in parentheses after the name in that row:
  Mystic Arcanum is `[{ "level": 11, "note": "level 6 spell" }, …]`, and
  reads "Mystic Arcanum (level 6 spell)". `text`, `Text`, as printed: its
  titled paragraphs ("Cantrips.", "Spellcasting Ability."), and its tables,
  with tokens, such as Oath of Devotion Spells and Circle of the Land Spells.
- The same field serves a subclass's features, whose levels must be in its
  class's `subclassLevels`.

##### Class option

- **Inputs:** `prerequisite`, `Text`, printed under the name as
  "Prerequisite: Level 5+ Warlock, Pact of the Blade Invocation", with a token
  for an option it names. Optional. `cost`, `Line`, printed as "Cost: 1
  Sorcery Point". Optional. `text`, `Text`. `repeatable`, `Text`, printed
  last as "**Repeatable.** …", as a feat's. Optional.

#### Subclass

- **Inputs:**
  - `class`: a `ClassRef` to its class.
  - `tagline`: the line under its name, `Line`: "Create Explosive Elemental
    Effects".
  - `text`: its intro, `Text`.
  - `features`: typed refs to its class features, in level order.
- The page's heading is "<Class> Subclass: <Name>", as the SRD's: "Wizard
  Subclass: Evoker".
- **Derived:** nothing.
- **Checks** (errors): each feature's levels are in the class's
  `subclassLevels`, and each subclass level has a feature.
- **Guideline:** `subclass.md`: a subclass specializes its class, with a
  feature at each of the class's subclass levels; its power is balanced
  against the class's SRD subclass; an always-prepared spell list is a table
  in its first feature, as the SRD's are.
- **Links and labels:** `class` reads "Subclass of" / "Subclasses"; tokens
  read "References" / "Referenced by".
- **Registry facets:** `stats.class` (valued by key, shown by name). The card
  shows the class, and the default sort is class.
- **Gap buckets:** none. Subclasses come by request, like classes.

### SRD fidelity

The new types' templates word the SRD's fixed sentences (a feat's "You gain
the following benefits.", a species' trait intro, a class's "Becoming a
<Class> …" bullets and spell list intro, "(see “Feats”)"), so entries store
only what varies. Numbers in their text are authored and exempt from the
literal-number check, as spell and item text is. The SRD manifest gets one
tier for each new type: feats and backgrounds are `simple`, and species,
classes, and subclasses are `complex`.

## Cases

The hardest SRD cases, which become the build's fixtures:

- **The Sorcerer:** an option list (Metamagic Options, with costs), a feature
  that repeats in the table (Metamagic at 10 and 17), a class column
  (Sorcery Points), full-caster slots, a derived spell list, and a subclass
  with "Subclass feature" at 6, 14, and 18.
- **The Warlock:** Eldritch Invocation Options, with prerequisites that name
  other options and Repeatable paragraphs; pact slots and slot level; and
  Mystic Arcanum's noted rows.
- **The Barbarian:** "Improved Brutal Strike" printed at two levels, and
  three columns.
- **The Paladin:** half-caster slots, and Oath of Devotion Spells as a table
  in a subclass feature.
- **The Druid:** Circle of the Land Spells, four tables in one feature.
- **The Soldier and the Acolyte:** a chosen tool kind with a note, and a
  feat with a note (Magic Initiate (Cleric)).
- **The Human and the Tiefling:** two sizes, and the Tiefling's own trait
  intro; the Elf's and Tiefling's tables of spells.
- **Magic Initiate and Grappler:** benefits with a Repeatable paragraph, and
  a prerequisite of level and abilities.

## Migration

Spell `classes` move from the enum to class refs in the SRD import stage
for classes (#234), once the classes exist; every entry keeps its classes and
its words.

## Done when

- Each new type validates against its schema, with fixtures for its
  errors.
- Each SRD class's derived Features table and spell list match the SRD's.

## Out of scope

- Modifying or replacing a rule, and new mechanics: v3's house rules system
  (#118).
- Authoring glossary terms, and extending abilities, damage types, skills,
  creature types, or sizes.
- Locations, encounters, dungeons, a character sheet builder, and character
  presets (#118).
- The layout of pages and rules pages: the UI redesign (#113).
- Links to the Equipment page's prose sections, custom equipment groups,
  variants as link targets, and items that derive stats from their base.
