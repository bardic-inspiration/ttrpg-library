# Rulesets

## Purpose

Everything specific to a ruleset: its schemas, rules tables, derived values,
text tokens, consistency checks, and how its types print. The library's one
ruleset is `dnd-5e-2024`, aligned with SRD 5.2 (CC-BY-4.0); two fixture
rulesets test the generic code ([Fixture rulesets](#fixture-rulesets)). Its content, rules, and
component types are listed in
[`ruleset.json`](../rulesets/dnd-5e-2024/ruleset.json). What every entry
shares is in [content-model.md](content-model.md).

## Behavior

### Inputs and derived values

An entry stores only the values an author chooses. A value the ruleset defines
by fixed formula or table is never stored. The ruleset module computes it at
build time from the stored inputs.

- **No mismatches.** A derived value can't disagree with its inputs, because it
  is never written down.
- **No arithmetic in generation.** Routines write choices (ability scores, CR,
  hit dice, proficiencies), not computed numbers.
- **One place per rule.** A correction to a table or formula is a one-file
  change in the ruleset, and every entry picks it up on the next build.

**Deviations.** An entry that legitimately departs from a formula, such as a
creature with a +1 weapon, records an explicit non-zero `adjust` on that value,
or a `bonus` on a damage roll. The formula stays authoritative, the adjustment
is visible in the diff, and every adjustment is listed as a warning in the job
summary for the reviewer to confirm.

**Authored values stay stored.** Numbers the rules leave to the author are
inputs: a creature's AC, a spell's damage dice, an item's stated spell
save DC.

### The ruleset module

Everything specific to a ruleset lives in one folder, `rulesets/<ruleset>/`, so
adding a ruleset is adding a folder:

| File | Purpose |
|---|---|
| `ruleset.json` | ID, `publisher` ([Source and author](content-model.md#source-and-author)), list of types, the `rules` types ([Rules data](#rules-data)), and the `components` types with their parent types ([Components](content-model.md#components)) |
| `tables.json` | Rules tables (CR to XP and PB, size to hit die, skill to ability, point-buy costs) and the enums the schemas share |
| `phrases.json` | The phrase book: the fixed sentences templates fill, the display name of each enum value, and irregular plurals and articles ([Wording](site.md#wording)) |
| `derive.ts` | Pure functions, one per type, computing derived values from `stats` (equipment's in `equipment.ts`, classes' in `classes.ts`, characters' in `characters.ts`) |
| `tokens.ts` | Text tokens that render derived values inside prose |
| `checks.ts` | Consistency checks a schema can't express (equipment's and classes' beside their derivations) |
| `refs.ts` | `refLabels(type, path)`: how detail pages name a ref from each end |
| `index.ts` | Exports the module, meeting the `RulesetModule` contract in `rulesets/module.ts` |
| `types.ts` | TypeScript shapes of `stats` and derived values, mirroring the schemas |
| `schemas/` | `common.schema.json` and one `<type>.schema.json` per type |
| `guidelines/<type>.md` | Generation guidance ([generation.md](generation.md#guidelines)) |
| `srd-manifest.json` | Every SRD entry of the ruleset ([content-model.md](content-model.md#srd-manifest-and-coverage)) |
| `rules/` | The ruleset's primitives, groups, and rules pages ([Rules data](#rules-data)) |

`publisher` names who publishes the ruleset: `dnd-5e-2024` is published by
Wizards of the Coast. The validator fails a ruleset without one.

The validator, the index builder, the site templates, and the exporters all
import this module, so each derived value is computed in exactly one place. The
validator loads a ruleset by folder name, so an entry whose `ruleset` has no
folder or registry entry fails as unknown. A type with no formulas derives `{}`.
`derive` and `check` also receive the ruleset's rules data, for values and
checks that read it: equipment's category comes from its group, and an
item's base item is checked against the equipment groups. An optional
`checkLinks` runs once every ref resolves, with a lookup of each target's type
and stats, and a lookup of an entry's key by its type and exact name in the
same ruleset, for checks that read another entry: a background's feat must be
an origin feat. `check` also receives whether the entry is official content,
for a rule that depends on it. An optional `deriveLinked` computes values that read
other entries, given the entry's key and its ruleset's linked library
(`LinkedLibrary` in `rulesets/module.ts`): every entry and component, each
with its `author` so it can tell official content (`isOfficial`), a lookup
that resolves any ref to its entry, component, or primitive, and the rules
data. The build makes it once per ruleset, before deriving, and the site
merges the values into the entry's derived values. A derivation reads the
entries its refs name, as a character reads its classes and species
([Characters](#characters)), or the entries that name it, as a class's spell
list is the spells that name it ([Classes](#classes)). An optional `renderTokens` renders the
ruleset's text tokens in one text of an entry, from the entry's derived
values ([Text tokens](#text-tokens)).

`dnd-5e-2024` ref labels: spell lists (a creature's `spellcasting`, an
item's `spells[].spell`) are "Casts" / "Cast by"; a background's `feat` is
"Grants" / "Granted by", its `tool` "Tool proficiency" / "Backgrounds", and
its equipment "Starting equipment" / "Starting equipment of", as a class's
is; a class's `spells` are "Spells" / "Classes", and a spell's `classes`
"Classes" / "Spells"; a subclass's `class` is
"Subclass of" / "Subclasses"; creature `gear` is "Gear" /
"Carried by"; a creature's condition immunities are "Immune to" / "Immune
creatures"; an item's `baseItem` is "Base item" / "Base of"; a weapon's
`properties` and `mastery` are "Properties" / "Weapons" and "Mastery" /
"Weapons"; any other field, including a `{ref:…}` token in text, is
"References" / "Referenced by". These are the ruleset's generic labels
(`generic` in `RefLabels`): a target listed under a specific label isn't
listed again under them, so Acid Arrow lists the dragons that cast it, and
name it in their text, once, under "Cast by" (`groupRefs` in
`site/src/lib/refs.ts`).

### Rules data

A ruleset splits into rules, its definitions, and content, the authorable
library. A **rules type** is listed in `ruleset.json` under `rules`, separate
from `types`, with whether it takes extensions:
`"rules": [{ "type": "condition", "extensions": true }]`.

- **Primitives** are the SRD's rules, kept with the ruleset: one file per
  primitive at `rules/<type>/<id>.json`, holding `type`, `id`, `name`, and
  `stats` (`schemas/primitive.schema.json`). The path must match, and a
  primitive has no `summary`, `meta`, `description`, or `image`: it
  is an SRD rule, reproduced faithfully ([SRD and custom entries](content-model.md#srd-and-custom-entries)).
- **Extensions** are custom rules: ordinary entries under
  `content/<ruleset>/<type>/`, whose `stats` validate against the same type
  schema as a primitive's. Only a type that takes extensions may have them,
  it needs a registry entry for their cards, and an extension is always
  homebrew, so an extension whose `author` is `"publisher"` is an error.
- **One key space per type.** A key (`<type>/<id>`) is unique across a
  type's primitives, groups, and extensions, and so is a name, ignoring case.
- **Validated like entries:** the type schema, the markdown subset, refs and
  `{ref:…}` tokens, the blocklist, and placeholders; the ruleset's checks run
  with their warnings skipped, as for an SRD entry. A primitive's and a
  group's links count for back-references. Every registered ruleset's rules
  data is validated, whether or not an entry uses it.
- **Link targets.** A primitive or group is linked like an entry, by a ref
  object or a `{ref:…}` token, and the link renders as its name, linked to
  its anchor on its rules page ([References](content-model.md#references)).
- **Rules data links only to rules data.** A primitive's, group's, or page's
  link to a content entry is an error, since the ruleset would depend on the
  library; a mention of an entry in rules prose stays plain text. A page's
  links must resolve to a primitive or group.

The SRD manifest lists every primitive and group, so `npm run srd-coverage`
proves the rules data complete ([SRD manifest and coverage](content-model.md#srd-manifest-and-coverage)).

`lib/rules.ts` places rules data on pages and is shared by the validator
(`scripts/validate/rules.ts`) and the site (`site/src/lib/rules.ts`).

### Rules groups

A rules type may group its primitives in `rules/<type>-groups.json`
(`schemas/rules-groups.schema.json`): a list, in page order, of groups with
an `id`, a `name`, and optionally a `qualifier` (a short form), a `noun` (a
category's singular noun), a `parent`, a `note` printed in parentheses after
the heading, `text`, prose that opens the group's section, and `sortBy`,
paths into each member's stats and derived values that order its members
(by name otherwise). A group's key is `<type>/<id>`, a link target
like a primitive's.

- A group with no `parent` is a category. Parents must exist and never loop.
- A primitive or extension of a grouped type names its **leaf group**, one
  with no groups in it, in `stats.group`, and belongs to that group and every
  ancestor.
- A **union** group lists other groups in `union` and has no members or
  groups of its own. Its members are theirs, and its section lists them as
  links. It may have a `parent`, which places it in that tree.
- Groups are closed: extensions add members, not groups.

### Rules pages

`rules/pages.json` (`schemas/rules-pages.schema.json`) lists the ruleset's
rules pages in order. Each has an `id`, its URL segment, a `title`, and
`blocks` in order:

| Block | Shows |
|---|---|
| `{ "kind": "prose", "title", "text", "sections" }` | SRD chapter text that isn't a primitive, transcribed faithfully, with nested sections; text that opens a page has no title |
| `{ "kind": "primitives", "type", "crossList" }` | Every primitive of a type that has no groups, by name; with `crossList`, other rules types' primitives sit among them as "Name [Type]", linked to their own page, without being placed here |
| `{ "kind": "group", "group": "<type>/<id>" }` | A group's tree: its section, then its members (a leaf) or the groups nested in it, with union groups last |

Every primitive and group appears on exactly one page, and the validator
names any that appear on none or on several. `extensions` is not a page id;
it is the Extensions page's ([site.md](site.md#rules-pages)).

### dnd-5e-2024 derivations

Creatures derive: ability modifiers, proficiency bonus and XP from CR (XP 10 at
CR 0 when any trait or action deals damage, else 0), in-lair XP (the next CR
row's), Initiative bonus and score, the hit die from size and HP from hit dice,
saves, skills, passive Perception, each action's attack bonus, save DC, and
damage (average, modifier, and display), and the Spellcasting DC and attack
bonus. Items derive nothing, except the ability modifiers and saves of an
embedded stat block ([Embedded stat blocks](#embedded-stat-blocks)); spells
derive those too.
Classes derive their proficiency bonus and spell slots by level
([Classes](#classes)), and characters their level, scores, saves, skills, Hit
Points, Armor Class, attacks, and spellcasting ([Characters](#characters)). Feats derive `repeatable`, whether the feat has a
`repeatable` note, and species derive `sizes`, the list of their sizes'
names; both feed the Library's facets.
The formulas are in `derive.ts` and the tables, including the SRD CR table, in
`tables.json`, which cites the SRD section it comes from. The attack bonus and
save DC are one helper each, `attackBonus` and `saveDc`, which actions,
Spellcasting, text tokens, the checks, and the Open5e importer share.

### Shared definitions

`schemas/common.schema.json` holds the definitions the type schemas share:
abilities, dice, damage, proficiency levels, adjustments, damage types, refs
(`Ref`, `RefOrText`, `CountedRefOrText`, whose ref may add a `count`, and the
typed refs, each allowing only its type's keys: `ConditionRef`,
`EquipmentRef`, `FeatRef`, `SpellRef`, `ClassRef`, `SubclassRef`, `SpeciesRef`, `BackgroundRef`, and one per component
type), rules text (`Text`), and the embedded `StatBlock`. Each definition's shape and meaning is in its `description`.

### Text tokens

A text token shows a derived value inside prose, so the number is never
written down. Each ruleset defines its own: its module's `renderTokens`
replaces the tokens in one text of an entry of a given type from the entry's
derived values, leaving `{ref:…}` alone, and throws on a bad token. Its
`check` reports bad tokens, so validation catches them before a build. A
ruleset with no tokens leaves `renderTokens` out, and its text shows as
written. The generic template renders every text in an entry's `stats`
through it ([Templates](site.md#templates)); a ruleset's own templates call
its tokens where they place its prose.

`dnd-5e-2024`'s tokens are in `tokens.ts`, for creatures only.
Creature prose (`text`, `onHit`, `onFailure`, `onSuccess`, `onFailureOrSuccess`,
`spellcasting.note`, `legendaryActions.intro`) may show a derived value only
through a token. `tokens.ts` renders tokens from the same derivations as the
stat block.

| Token | Renders | Example |
|---|---|---|
| `{mod:<ability>}` | Ability modifier | `+2` |
| `{pb}` | Proficiency bonus | `+2` |
| `{atk:<ability>[:<adjust>]}` | PB + modifier (+ adjust) | `+4` |
| `{dc:<ability>[:<adjust>]}` | 8 + PB + modifier (+ adjust) | `DC 12` |
| `{dc=<n>}` | An authored DC, as written | `DC 5` |
| `{dmg:<dice>[+<ability>][:<type>]}` | Average, dice, and type | `7 (2d6) Fire damage` |

- An unknown token, ability, or damage type is a validation error.
- A literal number that looks derived in creature prose is an error, and the
  message names the token to use. The patterns caught are `DC <n>`,
  `+<n> to hit`, and `<n> (<dice>)`.
- A DC the rules leave to the author, such as an ability check's ("a
  {dc=12} Strength (Athletics) check") or a base in a formula ("({dc=5} plus
  the damage taken)"), uses `{dc=<n>}`, which marks the number as authored so
  the literal check stays strict. A save DC from one of the creature's
  abilities always uses `{dc:<ability>}`. Each authored DC is listed as a
  warning for the reviewer.
- `{ref:…}` is not a ruleset token; the token parser leaves it alone
  ([content-model.md](content-model.md#references)).
- Spell and item text is exempt, because its numbers are authored. A
  custom item's text must still not restate `saveDc` or `attackBonus`, since
  the template renders them (warning). An SRD item's text is verbatim and may.

### Creatures

`schemas/creature.schema.json` describes each field. The stat block follows
SRD 5.2:

- **Condition immunities are links.** The Immunities line prints damage
  types, then a semicolon, then each condition immunity as the condition's
  name linked to its section on the Conditions page, with a ref's `note` in
  parentheses: "Poison; Charmed (with Mind Blank), Exhaustion"
  ([Conditions](#conditions)).
- **Gear is links.** Each `gear` item is a ref to equipment or an item,
  printed as its name linked to its section or page, or plain text for gear
  that isn't a link target, such as the Mage's "Wand" (an Arcane Focus
  variant). A ref's `count`, 2 or more, prints after the name with an "s"
  added: `{ "ref": "equipment/javelin", "count": 6 }` reads "Javelins (6)",
  as the SRD prints it; a `note` prints in parentheses.

- **Attack and save lines are generated** from structured fields, never
  written as prose: `*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2)
  Piercing damage plus 3 (1d6) Fire damage.` and `*Dexterity Saving Throw:* DC
  12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage.
  *Success:* Half damage.` Kind-specific requirements (an ability and reach on
  melee attacks, `save` on saves, `text` only on `other`, `attackNote` only on
  attacks) are enforced in the schema.
- **Damage.** The first damage entry is the primary; the rest render as "plus"
  riders. A rider with a `condition` renders ", plus … <condition>": "5 (1d6 +
  2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had
  Advantage." Flat damage prints the number alone ("1 Piercing damage"), and a
  `note` in place of a type prints after "damage".
- **An attack note** prints in parentheses after the bonus: "+4 (with
  Advantage if the target is Grappled by the bugbear), reach 10 ft. or range
  20/60 ft."
- **Spellcasting** renders as the 5.2 "Spellcasting" action: "The
  <shortName> casts one of the following spells, using <Ability> as the
  spellcasting ability (spell save DC <n>):". `shortName` defaults to the last
  word of `name`, lowercased. `noComponents` adds "requiring no <components>
  components and" before "using"; `includeAttack` adds the spell attack bonus;
  `noSaveDc` leaves the DC out, and an empty parenthetical is dropped with the
  colon following "ability". Spellcasting displays under Actions, after the
  other actions.
- **Legendary Actions** open with one paragraph: the italic uses line, then
  `intro`: "*Legendary Action Uses: 3 (4 in Lair).* Immediately after …".
- A creature with only a Reaction (the Shrieker Fungus) has no Actions
  section.

### Creature display forms

- Negative numbers and subtractions print U+2212 (`−`): `−1 (9)`,
  `17 (5d8 − 5)`. Tokens render the same way. This is display only: derived
  values, `library.json`, and export bundles keep numbers and ASCII formulas
  such as `2d6 - 2`.
- The Speed line prints `walk`, then Burrow, Climb, Fly, and Swim, then `note`.
  The Senses line prints Blindsight, Darkvision, Tremorsense, and Truesight,
  separated by commas, then `note` in parentheses, then a semicolon before
  Passive Perception: `Darkvision 120 ft. (unimpeded by magical Darkness);
  Passive Perception 13`. The order is fixed, whatever the JSON key order.
- The Languages line joins, with semicolons, the `spoken` list
  (comma-separated), the `understood` clause, and telepathy, with `note` in
  parentheses after the line. `understood` joins as an English list ("Elvish
  and Sylvan", "Abyssal, Common, and Infernal"). The clause is "Understands …
  but can't speak" when nothing is spoken, and "understands … but can't speak
  it" (or "them") after a spoken list. With nothing at all, the line reads
  "None". Examples: `Common, Giant`; `Understands Infernal but can't speak;
  telepathy 60 ft.`; `Common; understands Giant but can't speak it`.
- A swarm's type line reads "Medium Swarm of Tiny Beasts", with the type plural
  ("Undead" and "Fey" stay as they are).
- The Spellcasting action puts the intro, each spell list, and `note` on lines
  of their own: "At Will:", then "3/Day Each:", "2/Day Each:", "1/Day Each:". A
  level with one spell drops "Each" ("1/Day: Fireball").
- Prose after damage (`onHit`, `onFailure`) that starts lowercase continues the
  damage sentence after a comma; prose starting with a dash (`—`) joins the
  damage directly; anything else follows as a new sentence.
- `uses` is title-cased, including the word after a slash, with minor words
  (`a`, `an`, `and`, `at`, `by`, `for`, `in`, `of`, `on`, `or`, `per`, `the`,
  `to`, `with`) lowercase unless first: "(4/Day, or 5/Day in Lair)". Skill
  names and the alignment follow the same rule ("Sleight of Hand").
- Recharge prints in the name's parentheses as SRD 5.2 does: "Recharge 4–6",
  "Recharge 5–6", "Recharge 6", "Recharge after a Short or Long Rest",
  "Recharge after a Long Rest".

### Items

`schemas/item.schema.json` describes each field. How the card reads:

- The subtitle reads the category, the base item in parentheses for armor
  and weapons, then the rarity in title case ("Very
  Rare"), with `varies` as "Rarity Varies". An item with `rarityVariants`
  prints them instead, as an English list joined by "or": "Uncommon (+1), Rare
  (+2), or Very Rare (+3)". `rarity` stays `varies`, so the gallery facet,
  sort, and card treat it as other `varies` items.
- Charges read "7; regains 1d6 + 1 daily at dawn", or "12" for an item that
  never regains them. A maximum may be a rolled count, printed as written
  ("1d3").
- The spell list renders each spell with its cost ("1 charge", or "1–3
  charges" for a variable cost) and its authored DC or attack bonus.

**Base items.** `baseItem` is links to equipment, and the template words
them, and every base item the SRD prints reads as printed:

- `oneOf` lists items, printed as an English list joined by "or": "Glaive,
  Greatsword, Longsword, or Scimitar", or "Shield" alone.
- `any` lists groups or items with variants, printed "Any", then each
  target's `qualifier` (a group's short form) or name, joined by "or". When
  its only target is a group, the category's `noun` follows: "Any Melee
  Weapon". `except` adds ", Except" and the items it leaves out, joined by
  "and": "Any Medium or Heavy, Except Hide Armor".

Each qualifier and name links to its anchor on the equipment pages; "Any",
"or", and "Except" are plain. The item's detail page lists them as "Base
item", and each group or item lists the items built on it as "Base of" (only
those that name it, not those that name a group it belongs to).

### Equipment

`equipment` is a rules type that takes extensions ([Rules data](#rules-data)).
The SRD's 180 weapons, armor, tools, pieces of adventuring gear, and mounts
and vehicles are primitives in `rules/equipment/`; custom equipment is an
entry under `content/dnd-5e-2024/equipment/`, authored from a request and shown
as a card. Each SRD piece of equipment has a Library card too, which opens its
section ([Gallery](site.md#gallery)). Weapon properties and mastery properties are two primitive-only
rules types, `weapon-property` and `mastery-property`, with keys of their own
so the Ammunition property doesn't collide with the Ammunition gear.

**Groups** (`rules/equipment-groups.json`, [Rules groups](#rules-groups)):

| Category (noun) | Groups (qualifier) |
|---|---|
| Weapons ("Weapon") | Simple Weapons (Simple), with Simple Melee Weapons and Simple Ranged Weapons; Martial Weapons (Martial), with Martial Melee and Martial Ranged Weapons; and the unions Melee Weapons (Melee) and Ranged Weapons (Ranged) |
| Armor ("Armor") | Light Armor (Light), Medium Armor (Medium), Heavy Armor (Heavy), each printed by base AC then cost, and Shields; each with its don and doff time as its note |
| Tools | Artisan's Tools, Other Tools |
| Adventuring Gear | none: the category is its own leaf |
| Mounts and Vehicles | Mounts and Other Animals; Tack, Harness, and Drawn Vehicles; Airborne and Waterborne Vehicles |

The Shield group is "Shields", because the Shield is equipment of the same
type and names are unique.

**Pages.** The Equipment page holds the chapter's general rules (Coins,
Selling Equipment, Lifestyle Expenses, Food, Drink, and Lodging, Hirelings,
Spellcasting, Magic Items, Crafting Nonmagical Items, Brewing Potions of
Healing, and Scribing Spell Scrolls) and links to the five category pages:
Weapons (with Properties and Mastery Properties), Armor, Tools, Adventuring
Gear, and Mounts and Vehicles, each with the chapter's text for it.

**Stats** (`schemas/equipment.schema.json`): every equipment has its leaf
`group`, a `cost` (`{ amount, unit }`), a `weight` in pounds with an optional
`weightNote`, and optional `text`. Its category is derived from the group,
never stored, and the block for its category is present only for it:
`weapon` (damage, properties, mastery, range, ammunition, versatile damage),
`armor` (AC, Dexterity and its cap, Strength, Stealth), `tool` (ability,
Utilize, Craft), `mount` (carrying capacity), or `vehicle` (speed, crew,
passengers, cargo, AC, HP, damage threshold). Equipment that comes in forms
sharing one description, such as Ammunition, the three foci, the Gaming Set,
the Musical Instrument, the Spell Scroll, and the Saddle, has `variants`,
each with its own cost and weight, and none of its own; a variant isn't a
link target.

**How it reads**, on its section and its card: the description, a variants
table, then labeled lines in SRD 5.2 form. Properties read "Ammunition (Range
80/320; Bolt), Loading, Two-Handed" with each property linked, armor "12 +
Dex modifier (max 2)" or a Shield's "+2", weights "1/4 lb." or "1½ lb.", costs
"1,500 GP", and equipment with variants "Varies" where any variant has a
value and "—" where none does.

**Derived:** `category` (the group's root) and `costGp`, the cost in gold
pieces, which the gallery sorts and filters by. Custom equipment has facets
for category, group, cost, and a weapon's damage type, properties, and
mastery, and no gap buckets.

### Glossary

`glossary` is a primitive-only rules type ([Rules data](#rules-data)): the
140 terms of the SRD Rules Glossary are primitives in `rules/glossary/`,
keyed `glossary/<id>`. Terms take no extensions. The SRD glossary's entries
tagged Condition are the condition primitives ([Conditions](#conditions)),
not glossary terms.

`schemas/glossary.schema.json` stores an optional `tag`, one of `action`,
`area-of-effect`, `attitude`, or `hazard`, and `text`, the definition as
printed, including its "See also" sentence, with its lists and tables in the
markdown subset. The name has no tag; the page prints it in brackets after
the name: "Attack [Action]". Terms derive nothing and have no checks, guideline,
registry entry, facets, or gap buckets. A `{ref:…}` token in a term's text is
"References" / "Referenced by".

The Glossary page is the first rules page. It opens with the Glossary
Conventions, abbreviations included, and the Rules Definitions line, then
lists every term by name, with the conditions cross-listed among them as
"Blinded [Condition]", linked to the Conditions page.

### Conditions

`condition` is a rules type that takes extensions
([Rules data](#rules-data)). The 15 SRD conditions are primitives in
`rules/condition/`, shown on the Conditions page (`rules/pages.json`), each
with a Library card that opens its section ([Gallery](site.md#gallery)), and
there is no condition enum or table. A custom condition is an entry under
`content/dnd-5e-2024/condition/`, authored from a request like any content,
shown as a card, and listed on the Conditions page and the Extensions page.

`schemas/condition.schema.json` stores only `effects`, each a `name` and its
rules `text`. The template opens with the sentence every SRD condition
prints, worded from the name and the number of effects ("While you have the
Poisoned condition, you experience the following effect."), then prints each
effect as a bold-italic titled paragraph: "***Speed 0.*** Your Speed is 0 and
can't increase." A condition's text links the other conditions it names
("You have the Incapacitated condition"). Conditions derive nothing and have
no consistency checks, facets, or gap buckets.

A field that takes a condition takes a `ConditionRef`: a creature's
`immunities.conditions`, where a qualifier goes in the ref's `note`
("Charmed (with Mind Blank)").

### Spells

`schemas/spell.schema.json` describes each field. How the card reads:

- The level line words the level as SRD 5.2 does: "Level 1 Evocation
  (Sorcerer, Wizard)", or "Evocation Cantrip (Sorcerer, Wizard)" at level 0.
  `classes` are class refs (`ClassRef`), each printed as its class's name,
  linked.
- A reaction or bonus action with a trigger reads "Reaction, which you take
  …" with the trigger rendered inline as rules text, so a spell name in it can
  be italic. A casting-time `note` prints after the unit: "Action (Overgrowth)
  or 8 hours (Enrichment)".
- Ranges read "60 feet", "1 mile", or "500 miles". Durations read
  "Instantaneous", "Until dispelled", "Until dispelled or triggered",
  "Special", "1 hour", "Up to 8 hours", or "Concentration, up to 1 minute".
- The material component prints `m.text` exactly as written, including any
  cost and "which the spell consumes". `costGp` and `consumed` are data for
  filters and checks, and add no words.

### Feats

`schemas/feat.schema.json` describes each field. A feat derives `repeatable`,
true when it has a `repeatable` paragraph, for the Repeatable filter. How the
card reads:

- The line under the name is the category and any prerequisite: "Origin
  Feat", or "General Feat (Prerequisite: Level 4+, Strength or Dexterity
  13+)", the `level` first as "Level 4+", then the `prerequisite` as written.
- Titled `benefits` print after "You gain the following benefits.", the
  sentence every SRD feat with titled benefits opens with, each as a
  bold-italic titled paragraph. A feat without titled benefits is one `text`.
- A `repeatable` paragraph prints last: "***Repeatable.*** You can take this
  feat more than once."
- A ref to a feat may carry a `note` for the choice it's taken with: "Magic
  Initiate (Cleric)".

Feats fill gaps by category ([generation.md](generation.md#gap-buckets)).

### Backgrounds

`schemas/background.schema.json` describes each field. A background derives
nothing. Its card prints the SRD's lines:

- **Ability Scores:** its three abilities by name, "Intelligence, Wisdom,
  Charisma".
- **Feat:** its origin feat (a `FeatRef`), with any `note`, then "(see
  “Feats”)" as the SRD prints it: "Magic Initiate (Cleric) (see “Feats”)".
- **Skill Proficiencies:** its two skills, "Insight and Religion".
- **Tool Proficiency:** its tool, an equipment ref; with `choose`, "Choose
  one kind of Gaming Set (see “Equipment”)", the parenthetical being the
  ref's `note`.
- **Equipment:** its [starting equipment](#starting-equipment).

Backgrounds come only by request; they have no gap buckets.

### Species

A species is a page type ([Components](content-model.md#components)): its
special traits are `species-trait` components, which it lists in order in
`traits`. `schemas/species.schema.json` and `schemas/species-trait.schema.json`
describe each field. A species derives `sizes`, its list of sizes, for the
Size filter. Its page (`species-page`) prints:

- **Creature Type**, **Size**, and **Speed**, as the SRD does: "Medium (about
  5–7 feet tall)", or two sizes joined by "or" and followed by ", chosen when
  you select this species"; "30 feet".
- The sentence that opens its traits, "As a Dragonborn, you have these special
  traits." ("an" before a vowel), or the species' own `intro` where the SRD
  words it otherwise, as the Tiefling's does.
- Each trait as a bold-italic titled paragraph, in the species' order,
  anchored at `#species-trait-<id>`. A choice among options is titled
  paragraphs in the trait's text, and a table is a table in it, with tokens
  for its spells.

Species come only by request; they have no gap buckets.

### Classes

A class is a page type ([Components](content-model.md#components)): its
features are `class-feature` components, which it lists in printed order in
`features` (by level, then table order), and its options are `class-option`
components, listed under each of its `optionLists`.
`schemas/class.schema.json`, `class-feature.schema.json`, and
`class-option.schema.json` describe each field. A feature lists every level
the Features table names it at, the first being the one it's described at;
a level may carry a note for its row ("Mystic Arcanum (level 6 spell)"). A
feature printed again on its own at a later level is a second feature whose
id adds the level.

A class derives (`classes.ts`), per level 1–20:

- the proficiency bonus, from the Character Advancement table in
  `tables.json`;
- its spell slots from `spellcasting.progression`: a full caster reads the
  Multiclass Spellcaster table at its level, a half caster at half its level
  rounded up (the Paladin's and Ranger's slots), and a pact caster the Pact
  Magic table, the Warlock's slots and slot level;
- from the library (`deriveLinked`): the Class Features column, each
  feature's name at each of its levels with its note, and "Subclass feature"
  at the later `subclassLevels`; its spell list, every spell whose `classes`
  holds its id plus its own `spells`, by level and then name, each with its
  school and Special marks (C for Concentration, R for a ritual, M for a
  material component with a cost); and its subclasses, by name. An SRD
  class's spell list and subclasses take only SRD entries; a custom spell or
  subclass that names it is listed in the page's Homebrew links
  ([Detail page](site.md#detail-page)). A custom class takes every spell and
  subclass that names it.

Its page (`class-page`) prints, in the SRD's order:

- **Core <Class> Traits:** Primary Ability ("Strength or Dexterity"), Hit
  Point Die ("D6 per Sorcerer level"), Saving Throw Proficiencies, Skill
  Proficiencies ("Choose 2: Arcana, Deception, … or Religion", or "Choose any
  3 skills (see “Playing the Game”)"), Weapon Proficiencies, Tool
  Proficiencies when present, Armor Training, and Starting Equipment
  ([Starting equipment](#starting-equipment)).
- **Becoming a <Class> as a Level 1 or Multiclass Character:** the "As a
  Level 1 Character" bullets every class
  shares, from the phrase book, then "As a Multiclass Character" and the
  class's `multiclass` text.
- **The <Class> Features table:** Level, Proficiency Bonus, Class Features
  (each feature linked to its section), the class's `columns`, Cantrips,
  Prepared Spells, and the slots: "Level 1 Slots" up to the highest spell
  level with a slot, or a pact caster's Spell Slots and Slot Level.
- **<Class> Class Features:** the intro sentence, then each feature headed
  "Level 1: Spellcasting", anchored at `#class-feature-<id>`.
- **Each option list:** its heading and intro, then each option under its
  name, anchored at `#class-option-<id>`, with "Prerequisite: …" and
  "Cost: …" lines, its text, and a closing "***Repeatable.***" paragraph.
- **<Class> Spell List:** the intro sentence, then a table per spell level,
  "Cantrips (Level 0 Sorcerer Spells)", "Level 1 Sorcerer Spells", with Spell,
  School, and Special columns.
- **<Class> Subclasses:** a link to each subclass.

An SRD class's spell list comes only from its spells' `classes`; a custom
class adds existing spells through `spells`, which a spell's card doesn't
print. `tests/rulesets/dnd-5e-2024/srd-classes.test.ts` checks that each SRD
class in the library derives its Features table and spell list as the SRD
prints them (`tests/fixtures/srd/class-tables.json`). The SRD's spell entries
and class lists disagree in two places, and the spell entry wins, since its
card is reproduced as printed: *Phantasmal Force* names the Bard, Sorcerer, and
Wizard, and *Mind Spike* the Sorcerer, whose lists omit them.

Classes come only by request; they have no gap buckets.

### Subclasses

A subclass is a page type that names its class (`class`, a `ClassRef`); the
class lists nothing back, so a custom subclass leaves an SRD class unchanged.
Its features are `class-feature` components, listed in level order in
`features`, and each level is one of its class's `subclassLevels`.
`schemas/subclass.schema.json` describes each field. A subclass derives
nothing. Its page (`subclass-page`) prints the heading "<Class> Subclass:
<Name>" ("Sorcerer Subclass: Draconic Sorcery"), its `tagline` under it, its
intro `text`, then each feature headed "Level 3: Draconic Resilience",
anchored at `#class-feature-<id>`. An always-prepared spell list is a titled
table in a feature's text, with spell tokens.

Subclasses come only by request; they have no gap buckets.

### Characters

A character is a ready-made build: a pregenerated character a module
offers, or one a DM runs. It's one build at one level, its current state
rather than a record of choices level by level. It is apart from a creature:
a creature is a stat block whose values are its own fields, and a
character's values come from refs to library entries plus a few inputs. The
site stores no PC or NPC role.

`schemas/character.schema.json` describes each field. A character's `stats`
hold only inputs:

- **`species`** and **`background`:** refs.
- **`classes`:** in the order taken, each a class ref, its `level`, and its
  `subclass` ref. The first is the starting class.
- **`abilities`:** the six `base` scores, bought with point buy, and the
  `background`'s increases by ability (`{ "str": 2, "con": 1 }`).
- **`feats`:** each a feat ref with its `source`, where it came from: the
  background, the species (Human's Versatile grants an origin feat), or a
  class with the class `level` whose feature grants it. A feat's `note` is
  the choice it's taken with ("Magic Initiate (Cleric)"), and `abilities`
  the increases it places, such as an Ability Score Improvement's.
- **`options`:** class option refs. Each is a component of one of its
  classes' option lists, so the list it sits in isn't stored.
- **`choices`:** the `skills`, `expertise`, `tools`, and `languages`
  picked, each group under the `source` that offers it: the species or one
  of its traits, the background, a class, a subclass, a class feature
  (Scholar's Expertise), or a feat. Each source's picks fill exactly what it
  gives ([Grants](#grants)). The two languages every character picks beside
  Common at its origin go under the background.
- **`equipped`:** what the character wears, wields, or attunes to: SRD
  equipment, or any item that can be equipped or attuned to, such as
  armor, weapons, rings, rods, staffs, wands, and wondrous items. An item whose base item could be several pieces of
  equipment names the one it is in `base` (`item/armor-1-2-or-3` with
  `equipment/chain-mail`), and an item with variants names its `variant`
  (`"+1"`). An item the character is attuned to has `attuned`. There is no
  inventory.
- **`spells`:** spell refs, the cantrips and prepared spells.

A character's refs to class features, species traits, and class options are
links: only a class, subclass, or species lists them as components
([Components](content-model.md#components)).

A character derives (`characters.ts`), from its own stats: its total
`level`, its `proficiencyBonus` from the Character Advancement table, and
`pointCost`, the point-buy cost of its base scores from `tables.json`'s
`pointBuy` (SRD 5.2 "Character Creation": 27 points, a score of 8 costing 0
up to 15 costing 9), omitted when a score is outside the table.

From the library (`deriveLinked`, with the entries its refs name), each
with the modifiers of the features, feats, and traits it has
([Modifiers](#modifiers)) and of its equipped items
([Item modifiers](#item-modifiers)):

- the final `scores` (the base, the background's increases, and each
  feat's) and their modifiers;
- `saves`, with the starting class's saving throws proficient;
- every skill's bonus, with the background's two skills and the picked ones
  proficient and Expertise doubling the proficiency bonus, and Passive
  Perception;
- Hit Points at the fixed value per level: the starting class's Hit Point
  Die's maximum at level 1, then half the die plus 1 for each later level,
  plus the Constitution modifier per level;
- Initiative (the Dexterity modifier) and Speed (the species');
- Armor Class: the equipped armor's AC with its Dexterity rule (`dex`, up to
  `dexMax`), or 10 plus the Dexterity modifier with none, then the equipped
  shield's;
- an attack per equipped weapon: Strength for a melee weapon, Dexterity for
  a ranged one, the higher for a Finesse weapon; the attack bonus adds the
  proficiency bonus, and the damage its dice and modifier, with a Versatile
  weapon's two-handed dice, its properties, and its mastery;
- each casting class's spellcasting ability, save DC, and attack bonus, with
  its cantrips and prepared spells at its level; spell slots from the
  Multiclass Spellcaster table at the full caster levels plus half the half
  caster levels, rounded up; and a pact caster's Pact Magic slots apart;
- its `spells` by spell level, cantrips first, each level's in the order
  the build lists them, leaving out a level with none;
- the features each class and subclass gives up to the class's level, each
  with the level it's gained at, and the species' traits;
- the proficiencies by source: the starting class's saving throws, the
  skills and Expertise, weapon and armor training as each class prints it
  (the starting class's Core Traits, a later class's "As a Multiclass
  Character" text), the tools, and the languages.

A character's page is a **profile** (`character-profile`), not a play
sheet: what a DM needs to run the character, or a player needs to copy a
preset onto their own sheet. It has no fill-in boxes and nothing tracked at
the table (current HP, spent slots, inventory). Every value is a derived
one, in this order:

- **Identity:** its class levels with subclasses under its name ("Fighter 3
  (Champion) / Wizard 2"), then its species and background, linked.
- **Combat:** Armor Class, Hit Points, Initiative, Speed (with any Climb,
  Swim, or Fly Speed), Proficiency Bonus, and Passive Perception.
- **Abilities:** each score, modifier, and saving throw, as the creature
  stat block's table.
- **Skills:** every skill with its bonus, alphabetized, in columns, each
  proficiency marked "(Proficient)" or "(Expertise)".
- **Proficiencies:** its saving throws; Armor, Weapons, and any Tools text
  as the starting class prints them; its tool picks, linked; its languages;
  and each later class's "As a Multiclass <Class>" text.
- **Attacks:** a paragraph per equipped weapon, led by its linked name:
  "***Longsword.*** +6 to hit, 1d8 + 3 Slashing damage, or 1d10 + 3
  two-handed; Versatile; Mastery: Sap", with a ranged weapon's range.
- **Spellcasting:** per casting class, its ability, spell save DC, attack
  bonus, and cantrip and prepared counts; its spell slots and Pact Magic
  slots; and its spells by level ("Cantrips", "Level 1", …), linked.
- **Features:** each class's, subclass's, and the species' features by
  source, each linked to its section on its parent's page; its feats, with
  the choice each is taken with and where it came from ("Defense (Fighter
  1)"); and its class options.
- **Equipment:** each equipped item, linked, with its base item, variant,
  and attunement noted ("Armor, +1, +2, or +3 (Chain Mail, +1)").
- **Description:** in print and PNG capture, its lore last. On screen the
  detail page shows it, as for every type.

In the Library, a character's facets are its classes (`stats.classes.class`,
a ref facet through the array), its total level (`derived.level`), its
species, and its background; its card shows the four with its summary. It
exports as any card entry does, to Print, PNG, and JSON; no translator takes
characters.

Characters come only by request; they have no gap buckets.

### Modifiers

A feature that changes a character's derived value declares the effect as
data, so a character needs no `adjust` for it. `class-feature`, `feat`, and
`species-trait` stats take an optional `modifiers` array, each modifier with
a `kind` from a closed vocabulary (`Modifier` in `common.schema.json`, which
describes each kind's fields). A character applies the modifiers of the
class and subclass features up to each class's level, its feats, and its
species' traits.

Fields the kinds share:

- **`value`:** a number, `"proficiency"` for the proficiency bonus, or an
  ability key for that ability's modifier, with an optional `min`.
- **`byLevel`:** in place of `value`, a value from the level each key names
  (`{ "2": 10, "6": 15 }`), read at the level of the feature's class: the
  class whose features, or whose subclass's, list it, or the class a feat
  came from. A species trait's, or a feat's from the background or species,
  reads the total level.
- **`while`:** conditions that must all hold: `unarmored` (no armor
  equipped), `armored`, `no-heavy-armor`, and `no-shield`.
- **`weapon`:** the equipped weapons it applies to: `ranged`, `melee`,
  `one-handed-melee` (a melee weapon without Two-Handed, wielded as the only
  weapon; a Versatile weapon's two-handed damage doesn't take it), or `monk`
  (Simple Melee weapons, and Martial Melee weapons with Light).

| Kind | Example | Derives |
|---|---|---|
| `ability-bonus` | Primal Champion: `"abilities": ["str", "con"], "value": 4, "max": 25`; an Ability Score Improvement's `"total": 2, "max": 20`, which caps the increases the character's feat places | Final scores, each up to `max` |
| `ac-formula` | Unarmored Defense: `"base": 10, "abilities": ["dex", "con"], "while": ["unarmored"]` | Armor Class: the highest formula that applies, the equipped armor's or 10 + Dexterity included |
| `ac-bonus` | Defense: `"value": 1, "while": ["armored"]` | Armor Class, after the shield |
| `save-proficiency` | Slippery Mind: `"abilities": ["wis", "cha"]`; `"all"` | Saving throws |
| `save-bonus` | Aura of Protection: `"value": "cha", "min": 1` | Every saving throw |
| `skill-proficiency` | `"skills": ["history"]`, with `"expertise": true` for Expertise | Skills and Passive Perception |
| `skill-floor` | Jack of All Trades: `"proficiency": "half"` | Skills without proficiency, and Passive Perception; not Initiative, which isn't a skill check |
| `initiative-bonus` | Alert: `"value": "proficiency"` | Initiative |
| `speed-bonus` | Fast Movement: `"value": 10, "while": ["no-heavy-armor"]` | Speed |
| `speed-mode` | Roving: `"modes": ["climb", "swim"]` | Other speeds, each equal to the Speed |
| `hp-per-level` | Dwarven Toughness: `"value": 1`; `"per": "class"` for each level of its class | Hit Points |
| `attack-ability` | Martial Arts: `"abilities": ["dex"], "weapon": "monk"` | The attack's ability, when higher |
| `attack-bonus` | Archery: `"value": 2, "weapon": "ranged"` | Attack bonus |
| `damage-bonus` | Dueling: `"value": 2, "weapon": "one-handed-melee"` | Damage |
| `damage-die` | Martial Arts: `"byLevel": { "1": "1d6", "5": "1d8" }, "weapon": "monk"`, or a fixed `die` | The damage die, when larger than the weapon's |

Bonuses of a kind add together. A choice a feature offers, such as a skill
of the character's choosing, is a pick in `choices`, not a modifier. An
effect that depends on the situation or a choice made in play, such as
Great Weapon Fighting, Rage, or Advantage on Initiative, isn't modeled and
stays text only.

An entry carries `modifiers` when it has an always-on effect the vocabulary
models; its `text` stays as printed. In the library these are Barbarian
and Monk Unarmored Defense, Unarmored Movement, Martial Arts (its attack
ability and die), Fast Movement, Primal Champion, Roving, Draconic
Resilience, Jack of All Trades, Slippery Mind, Aura of Protection, and the
custom Swift Foot; the feats Defense, Archery, Alert, and Ability Score
Improvement; and the species trait Dwarven Toughness. A new entry with such
an effect carries them too.

### Grants

What an entry gives a character to pick or have is data too, so the checks
can count a build's feats, picks, options, and spells
([Consistency checks](#consistency-checks)). `class-feature`,
`species-trait`, and `feat` stats take an optional `grants` array, each grant
with a `kind` from a closed vocabulary (`Grant` in `common.schema.json`). A
feature's grant is given at each of its levels up to its class's level; a
trait's once; a feat's each time it's taken.

| Kind | Example | Gives |
|---|---|---|
| `feat` | Fighting Style: `"categories": ["fighting-style"]`; Versatile: `["origin"]` | One feat of those categories, with the class and that level, or the species, as its `source` |
| `skills` | Skillful: `"count": 1`; Keen Senses: `"count": 1, "from": ["insight", "perception", "survival"]`; Skilled: `"count": 3, "withTools": true` | Skill picks under the entry; with `withTools`, skill and tool picks count together |
| `expertise` | Expertise: `"count": 2`; Scholar: `"count": 1, "from": [...]` | Expertise picks |
| `tools` | `"count": 1, "from": [{ "ref": "equipment/musical-instrument" }]` | Tool picks |
| `languages` | `"count": 2` | Language picks |
| `options` | Eldritch Invocations: `"list": "Eldritch Invocation Options", "column": "Eldritch Invocations"`; Metamagic: `"byLevel": { "2": 2, "10": 4, "17": 6 }` | Options from the class's list of that name: the column's value, or `byLevel`, at the class's level |
| `spells` | Magic Initiate: `"cantrips": 2, "level1": 1, "from": [...]`; an always-prepared list: `"byLevel": { "3": [...], "5": [...] }` | Spells outside the classes' counts |

A `spells` grant's picks come from the class spell list the feat's `note`
names ("Cleric" is `class/cleric`), one of `from` when given; they're at
most its counts, as a class's are. An always-prepared list's spells, from
each key's level on (the class's level for a feature, the total level for a
trait), are the character's without a seat in any count, and the build
lists those it wants on its profile.

A class adds two fields beside its printed text:

- **`grants`:** `start`, the picks it gives as the starting class beside
  its `skills` (the Bard's three instruments), and `multiclass`, those it
  gives as a later class (the Bard's, Ranger's, and Rogue's skill). The
  starting class's `skills` count as a `skills` grant.
- **`training`:** `start`, as its Core Traits print weapons and armor, and
  `multiclass`, as its "As a Multiclass Character" text does: weapon groups
  (`simple-weapons`, `martial-weapons`), each limited to weapons with any of
  `properties` (the Monk's Martial weapons with Light), and armor groups
  (`light-armor`, `medium-armor`, `heavy-armor`, `shields`).

A feat adds `requires`, its ability prerequisite as data beside the printed
`prerequisite`: `"abilities": ["str", "dex"], "min": 13`, any one by
default, or all with `"join": "and"`, read from the final scores.

The background gives its tool pick when it offers a choice, and the two
origin languages (SRD 5.2 "Character Creation": a character's origin is a
background, a species, and two languages). The species and a subclass give
nothing themselves; their traits and features do.

The library's entries get grants, training, and requires in a migration
(#488); until then `tests/fixtures/grants.json` gives them to the entries
the character fixtures use. A class without `training` leaves the
character's unknown, so the training warning waits for every class's.

### Item modifiers

`item` stats take an optional `modifiers` array too (`ItemModifier` in
`common.schema.json`), with the kinds an item has: `ac-bonus`, `save-bonus`,
`check-bonus`, `ability-set`, `attack-bonus`, and `damage-bonus`. An item's
modifiers apply while it's in the character's `equipped`, and, when it
requires attunement, only while it's `attuned`.

- **`value`:** a number. **`byVariant`** in its place gives one per variant,
  keyed as the item names its variants, and the `equipped` entry's
  `variant` picks it; with no variant named, or another, it gives nothing.
- **`while`:** the same conditions as a feature's (Bracers of Defense: no
  armor and no shield).
- **On armor or a weapon,** a modifier applies to that item itself: an
  `ac-bonus` while it's worn, and an `attack-bonus` or `damage-bonus` with
  no `weapon` to that weapon's attack only, its Versatile damage included.

| Kind | Example | Derives |
|---|---|---|
| `ac-bonus` | +1, +2, or +3 Armor: `"byVariant": { "+1": 1, "+2": 2, "+3": 3 }`; Cloak of Protection: `"value": 1` | Armor Class, after the shield |
| `save-bonus` | Ring of Protection: `"value": 1` | Every saving throw |
| `check-bonus` | Stone of Good Luck: `"value": 1` | Every skill, Passive Perception, and Initiative, which is a Dexterity check |
| `ability-set` | Gauntlets of Ogre Power: `"ability": "str", "value": 19`; Belt of Giant Strength by variant (`"hill": 21` … `"storm": 29`) | A final score, raised to the value unless it's already higher, after every other increase |
| `attack-bonus` | +1, +2, or +3 Weapon, by variant | The weapon's attack bonus |
| `damage-bonus` | +1, +2, or +3 Weapon, by variant | The weapon's damage |

In the library these are +1, +2, or +3 Armor and Weapon, Dwarven Plate,
Cloak and Ring of Protection, Bracers of Defense, Stone of Good Luck,
Gauntlets of Ogre Power, Amulet of Health, Headband of Intellect, and Belt
of Giant Strength. An effect used in play, or one that needs a condition the
character's stats don't hold (Boots of Speed, a potion), stays text only.

### Starting equipment

Backgrounds and classes share `StartingEquipment` in
`common.schema.json`: two or more options, each `items`, `gp`, or both. An
item is a ref to equipment or an item, with an optional `count` of 2 or more
and `note`, or text for anything else. The template letters the options and
words the list (`site/src/lib/starting-equipment.ts`):

- "Choose A or B: (A) …; or (B) 50 GP", and "Choose A, B, or C" with three.
- A counted item prints its count first, then its target's name in the
  plural as the link's text, "2 Daggers"; a note prints in parentheses,
  "Parchment (10 sheets)"; coins print last, "8 GP".
- Each option's parts are an English list in the house style, for classes and
  backgrounds alike: "Robe, and 8 GP", "Explorer’s Pack, and 15 GP"
  ([Wording](site.md#wording)).
- A variant isn't a link target, so "20 Arrows" is text. Equipment whose SRD
  name reads differently in a list is a token with display text in a text
  item: `{ref:equipment/clothes-travelers Traveler's Clothes}`.

### Embedded stat blocks

Some spells and items print a creature's stat block. One that also exists in
the SRD as its own creature, such as the Zombie that Animate Dead raises, is a
creature entry, and the spell or item links to it with a `{ref:creature/<id>}`
token. One printed only inside its spell or item, such as Summon Dragon's
Draconic Spirit, goes in `statBlocks`. It isn't an entry: it has no ID, file,
page, or gallery card, so its name never collides with an entry's, and the SRD
manifest doesn't list it. Custom entries follow the same rule.

An embedded block is authored as printed, because its numbers often scale with
the spell's level or depend on the caster ("AC 14 + the spell's level"), which
the creature derivations can't express. Only its ability modifiers and saves
are derived. The card renders each block after the rules text with the creature
stat block's parts ([site.md](site.md#templates)).

### Consistency checks

`checks.ts` runs after schema validation. These are the `dnd-5e-2024` checks;
the checks for every type are in
[content-model.md](content-model.md#validation). The validator skips the
warnings below on an SRD entry.

| Type | Check | Level |
|---|---|---|
| Creature | Every token is known and well-formed | error |
| Creature | No literal derived numbers in prose | error |
| Creature | Speeds are multiples of 5 | error |
| Creature | A damage `condition` only on a rider, not the first damage | error |
| Creature | No `spellcasting` spell written as text that exactly names a spell in the library; it's a ref | error |
| Creature | Any `adjust`, damage `bonus`, or token adjustment | warning |
| Creature | Any authored DC token `{dc=<n>}` | warning |
| Creature | Derived attack bonus above +17 or save DC above 30 | warning |
| Item | `baseItem` present for `armor` and `weapon` | error |
| Item | `baseItem.oneOf` names no group; `any` names groups or items with variants; each `except` item is in an `any` group | error |
| Equipment | The block for its category is present, and no other category's | error |
| Equipment | `cost` and `weight` absent with `variants`; `cost` present without | error |
| Equipment | A weapon's `range` exactly with Ammunition or Thrown, `ammunition` exactly with Ammunition, `versatile` exactly with Versatile; long range above normal | error |
| Equipment | Armor's `dexMax` only with `dex`; a `weightNote` only with a `weight` | error |
| Item | `rarityVariants` only when `rarity` is `varies` | error |
| Item | `attunement.requirement` only when `required` is true | error |
| Item | `spells[].chargeCost` only when `charges` is present | error |
| Item | `spells[].maxChargeCost` only with `chargeCost`, and above it | error |
| Item | `effect` restates a `saveDc` or `attackBonus` value | warning |
| Spell | `duration.concentration` only on a `timed` duration | error |
| Spell | A `timed` duration has `amount` and `unit` | error |
| Spell | `duration.upTo` only on a `timed` duration without concentration | error |
| Spell | A `distance` range has `feet` or `miles`, not both; no other kind has either | error |
| Spell | `components.m.consumed` requires `costGp` | error |
| Spell | `higherLevels` only at level 1 or above; `cantripUpgrade` only at level 0 | error |
| Spell | `castingTime.trigger` present on a reaction, and only on a reaction or bonus action | error |
| Spell | Cantrip marked `ritual` | warning |
| Feat | An origin feat with a `level` or `prerequisite`; a general feat below level 4; an epic boon below level 19 | warning |
| Background | `feat` names an origin feat | error |
| Background | The last equipment option is coins only | error |
| Background | The coin option isn't 50 GP | warning |
| Species | Speed is a multiple of 5 | error |
| Class | `subclassLevels` ascend | error |
| Class | `features` are in level order, by each feature's first level | error |
| Class | The first subclass level is the level a listed feature is described at | error |
| Class | An SRD class lists no `spells` | error |
| Class | No feature at level 1, or a level after 1 with neither a feature nor a subclass level | warning |
| Class feature | `levels` ascend | error |
| Subclass | `features` are in level order, by each feature's first level | error |
| Subclass | Each feature's levels are its class's subclass levels, and each subclass level has a feature | error |
| Character | Each base score is 8 to 15, and the point costs total 27 or less | error |
| Character | Class levels total 20 or less, and no class is taken twice | error |
| Character | The background's increases are +2/+1 or +1/+1/+1, only among its three abilities | error |
| Character | No placed increase takes a score above 20, or above its feat's `max`; a feat with an Ability Score Improvement's `total` places exactly that many points, among its `from` abilities, and a feat with fixed increases places none | error |
| Character | With more than one class, each class's primary ability is 13 or more in the final scores (all of them for an "and", one for an "or"), the starting class's included | error |
| Character | A subclass belongs to its class, and is present exactly when the class's level reaches its first subclass level | error |
| Character | One feat from the background, its origin feat; a species feat for each `feat` grant of its traits, and a class feat for each `feat` grant of a feature at that class level, of a category the grant allows, every grant filled; a class's feat from one of the character's classes at a level it has; each feat's `level` at most the character's, and its `requires` met by the final scores; only a repeatable feat twice | error |
| Character | Each choice's source is something the character has: its species or a trait of it, its background, a class or subclass, a feature it has at its levels, or a feat | error |
| Character | Each source's skills, Expertise, tools, and languages are exactly the counts it gives ([Grants](#grants)), from its lists: the starting class's skills and `start` grants, a later class's `multiclass` grants, the background's tool when it offers a choice and its two languages, and each trait's, feature's (at each of its levels), and feat's grants; no skill is picked twice, the background's included; Expertise only in a skill the character is proficient in | error |
| Character | Each option is on an option list of one of the character's classes, and each list holds exactly the count its features' `options` grants give at the class's level | error |
| Character | Each spell is on an always-prepared list the character has, or on the list of one of its casting classes (the spell's `classes`, or the class's `spells`) at a level that class's own slots cast, or a feat's `spells` grant's list; and the spells fit the classes' cantrips and prepared spells at their levels and the feats' picks | error |
| Character | A feat's `spells` picks come from the class list its `note` names, one of the grant's `from` | error |
| Character | No more than three equipped items are attuned, and only an item that requires attunement is | error |
| Character | Equipped armor without training, or a weapon without proficiency, from the starting class's `training` or a later class's `multiclass` training, when every class has `training` | warning |

Balance isn't checked by CI; it's judged in review
([generation.md](generation.md#guidelines)).

### Fixture rulesets

Two original rulesets in `tests/fixtures/originals/` test the ruleset-generic
code against rulesets that share nothing with `dnd-5e-2024`. Each is a full
ruleset module, with rules primitives and a rules page, and a small library
of official and homebrew content. They aren't in `config/types.json`, so
they're never on the library's site. The folder is a library root of its own,
laid out as the repo is, so it has a site of its own, built and served apart
([Library root](site.md#library-root)). Its registry is its own
`config/types.json`, and every type uses the generic template.

```
tests/fixtures/originals/
  config/types.json          the fixtures' registry
  rulesets/<ruleset>/        ruleset.json, tables.json, phrases.json, types.ts, index.ts, schemas/, rules/
  content/<ruleset>/<type>/  entries
```

- **Starships & Galaxies** (`starships-and-galaxies`): a crew runs a ship's
  stations, and travel is a run of d100 checks. A check's target is the crew
  member's skill plus the ship system's rating (each 0 to 10), times 5, plus
  the hazard's difficulty (0 to -30); a roll at or under it succeeds, and a
  failure costs the hazard's damage in d10s of hull. Its primitives are the
  five `station`s, each running one ship system.
  - `creature`: a crew member's skill at each station and upkeep. Derived: the
    stations it's best at.
  - `ship`: a size and a rating per system. Derived from the size: crew and
    hull. Checks: the ratings fit the size's system points.
  - `item`: an upgrade that raises a system, or a trade good. Derived: resale
    value, half the value rounded down to 10 credits.
  - `celestial-body`: a star, planet, moon, or asteroid field, with what it
    orbits, its services (trade, refuel, discovery), and its hazards, each
    environmental (testing a station) or a hostile ship. Derived: whether a
    ship can dock, and the worst hazard. Checks: a star has no services or
    orbit, anything else orbits, and a moon orbits a planet, anything else a
    star (a link check).
- **Elementals** (`elementals`): a card game whose colors are fire, water,
  earth, and wind. A card costs chips of one or two colors, drawn from a
  shared pool, and its colors set its element: one of the four, or the blend
  of two. Water beats fire, fire beats wind, wind beats earth, and earth beats
  water; a blend beats what either part beats. Key numbers are powers of 4:
  64 life, a 64-card deck, a hand of 4, 16 chips per color. Its primitives
  are the ten `element`s, the blends naming their two parts.
  - `creature`, `invocation` (a one-time effect), and `ward` (a lasting one,
    with optional upkeep). Derived for each: its element, read from the rules
    data, its total cost, and the base elements it beats and is beaten by.
    Text token: `{cost}`, the card's total cost, in its `text`.
    Checks: some element blends its colors, and a card's text uses no other
    token. A creature's power and toughness
    go in steps of 4, and their sum over 8 per chip is a warning.

Tests run in two places:

- `tests/originals.test.ts`, part of `npm test`, runs the generic behavior
  against both: validation, rules placement, the index build, the gallery's
  filters and sorts, and loading and rendering every entry and rules page.
- `tests/originals/`, the rulesets' own derived values, checks, and ref
  labels, runs only in `npm run test:originals`, so work on `dnd-5e-2024`
  never runs it. CI runs it in the `originals` job on a dev PR that changes
  the fixtures or these tests, or closes a milestone
  ([CI checks](workflow.md#ci-checks)).

`tests/originals/fixture.ts` validates, indexes, and loads the fixtures, or a
temporary copy with a file changed to break one thing.

## Where the rules live

- `rulesets/module.ts`: the contract every ruleset module meets.
- `rulesets/dnd-5e-2024/`: the files in the table above.
- `site/src/lib/creature.ts`, `spell.ts`, `item.ts`, `stat-block.ts`:
  how each type's lines are worded.
- `tests/fixtures/library/valid/dnd-5e-2024/`: example entries, including the
  Cinder Hound, Frost Lance, and Wand of Frost Lances, with their rendered
  numbers checked in `tests/rulesets/dnd-5e-2024/`.
- `tests/fixtures/originals/`: the fixture rulesets
  ([Fixture rulesets](#fixture-rulesets)).

## Extending

| To add or change | Touch |
|---|---|
| A content type | In `rulesets/<ruleset>/`: a schema, its sentences and vocabulary in `phrases.json`, a `derive` function if it has formulas, checks if needed, a guideline, and the type in `ruleset.json`. Plus a registry entry and the request form's dropdown; a template only if the generic layout doesn't fit |
| A component type | In `rulesets/<ruleset>/`: a schema, the type under `components` in `ruleset.json` with its parent types, and a typed ref to it in each parent's schema ([Components](content-model.md#components)) |
| A rules type | In `rulesets/<ruleset>/`: a schema, the type under `rules` in `ruleset.json`, its primitives under `rules/<type>/`, groups if it has them, and its place in `rules/pages.json`. A type that takes extensions also gets a registry entry and a guideline |
| A ruleset | A new `rulesets/<ruleset>/` folder, registry entries (its display `label` among them), an attribution statement, and a licensing review ([licensing.md](licensing.md#new-rulesets)) |
| A rules formula or table | `tables.json` or `derive.ts`; every entry picks it up on the next build |
