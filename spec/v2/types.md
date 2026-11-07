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
- Conditions, damage types, skills, creature types, sizes, and abilities are
  closed lists in `rulesets/dnd-5e-2024/tables.json` and the
  `common.schema.json` enums.
- An item's base item is a plain string (`baseItem`).
- Adding a type: [Extending](../../docs/rulesets.md#extending).

## Design

### Rules and content

The ruleset splits into two layers.

- **Rules** are the ruleset's definitions: the basis everything else is
  built on. The rules types are glossary terms, conditions, and equipment.
- **Content** is everything else: the authorable library. The content types
  are spells, items, creatures, feats, backgrounds, species, classes, and
  subclasses.

Within the rules, the line falls between the basis and the custom additions:

- **Ruleset primitives** are the SRD's rules. They are ruleset data, kept
  with the ruleset, not entries under `content/`. They display as **pages**:
  one combined page per rules type, with an anchored section for each
  primitive, so any of them is easy to reference and link.
- **Ruleset extensions** are custom rules, authored like any content entry
  (a request, the `generate` skill, a content PR). They display as
  **cards**. Extensions appear on an Extensions page beside the ruleset's
  rules pages (`ui.md`, #113), and in a simple, searchable list at the
  bottom of each rules page.

| Rules type | Primitives | Extensions in v2 | Rules page |
|---|---|---|---|
| Glossary term | Every SRD Rules Glossary term | None | Glossary |
| Condition | The SRD conditions | Authorable | Conditions |
| Equipment | The SRD weapons, armor, tools, adventuring gear, and mounts and vehicles, with weapon properties and mastery properties | Authorable | One per category, and Equipment for the chapter's general rules |

Abilities, damage types, skills, creature types, and sizes stay closed lists
in v2. User content can't extend them.

### Equipment

Equipment is one rules type. Its categories are weapon, armor, tool,
adventuring gear, and mount or vehicle, each with nested
sub-classifications as the SRD groups them: simple or martial and melee or
ranged weapons; light, medium, and heavy armor and shields; artisan's tools
and other tools. A category and a sub-classification are each a section of
the category's page, with a key of its own (`equipment/medium-armor`), so a
link can point at a group as well as an item. Stats differ by category: a
weapon has damage, properties, and a mastery property, and armor has an
Armor Class and a Strength requirement. Weapon properties and mastery
properties are primitives on the Weapons page.

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

### Items

Items are content built on equipment: an item links to its base equipment,
an item or a group, on the rules side.

### Extension scope

v2 extension only adds: new content entries, custom conditions, and custom
equipment. Anything that modifies or replaces a rule, or adds a new
mechanic, waits for v3's house rules system.

### Rules data

- **One file per primitive**, at `rulesets/<ruleset>/rules/<type>/<id>.json`,
  holding `type`, `id`, `name`, and `stats`. The path must match, and the
  `id` is the slug of the name, as for an entry. A primitive has no
  `summary`, `meta`, `tags`, `description`, or `image`: every primitive is an
  SRD rule, reproduced unmodified ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)),
  with its rules text word for word.
- **An extension is an ordinary entry** under `content/<ruleset>/<type>/`,
  and its `stats` validate against the same type schema as a primitive's.
  An extension is always custom: `meta.source.srd` on one is an error.
- **One key space per type.** A key is unique across a type's primitives,
  its equipment groups, and its extensions, and so is a name, ignoring case
  (error). Since an extension is custom, the SRD-name rule already keeps it
  off a primitive's name.
- **Validated like entries:** the type schema, ref resolution, the markdown
  subset, `{ref:…}` tokens, the blocklist, and placeholders. A primitive's
  links count for back-references, so a glossary term's "See also" token
  lists the term it names.
- **Registered in `ruleset.json`** under a `rules` list, separate from
  `types`, each with whether it takes extensions. Only a rules type that
  takes extensions has a registry entry in `config/types.json`, because
  only extensions have cards.
- **In the SRD manifest.** The manifest lists every primitive and equipment
  group by type and exact name, so `srd-coverage` proves the rules data is
  complete. Primitives have no tier.
- **Weapon properties and mastery properties** are two more primitive-only
  rules types, `weapon-property` and `mastery-property`, shown on the
  Weapons page. Their keys are their own (`weapon-property/ammunition`), so
  the Ammunition property doesn't collide with the Ammunition gear.

### Rules pages

`rulesets/<ruleset>/rules/pages.json` lists the rules pages in order. Each
has an `id`, a `title`, and its blocks in order: a prose section (`title`,
`text`, and nested `sections`), a rules type's primitives, or an equipment
group's tree. Prose is SRD text word for word, in the markdown subset, for
chapter text that isn't a primitive, such as "Weapon Proficiency" or "Armor
Training".

| Page | Shows |
|---|---|
| Glossary | The Glossary Conventions and abbreviations as its intro, then every glossary term. Each condition appears at its alphabetical place as "Name [Condition]", linked to its section on the Conditions page; it isn't stored twice. |
| Conditions | Every condition |
| Equipment | The chapter's general rules: Coins, Selling Equipment, Lifestyle Expenses, Food, Drink, and Lodging, Hirelings, Spellcasting Services, Magic Items, Crafting Nonmagical Items, Brewing Potions of Healing, and Scribing Spell Scrolls, with their tables, plus links to the five category pages |
| Weapons | The chapter's weapon text, Properties, Mastery Properties, and the weapons tree |
| Armor | The chapter's armor text, and the armor tree |
| Tools | The chapter's tool text, and the tools tree |
| Adventuring Gear | The chapter's gear text, and the gear tree |
| Mounts and Vehicles | The chapter's mount and vehicle text, and the tree |

A page's URL is `/<ruleset>/rules/<page>/`, and a primitive's or group's
anchor is `#<type>-<id>`, so primitives of two types on one page can't
collide. The Equipment page's sections are anchored but aren't link targets:
a mention of one ("see 'Hirelings'") stays plain text, like any mention of
an SRD chapter. Each category page lists the equipment extensions in its
category at the bottom; the Conditions page lists condition extensions. The
layout is the UI's ([`ui.md`](ui.md)).

### Equipment groups

`rulesets/<ruleset>/rules/equipment-groups.json` lists the groups, in page
order. A group has an `id`, a `name`, an optional `qualifier` (its short form
in a base item, below), an optional `parent`, an optional `note` printed in
parentheses after its heading, and optional `text`, SRD prose that opens its
section. A group with no parent is a category, and its page is the
category's page. Groups are closed in v2: extensions add equipment, not
groups.

| Category | Groups (qualifier) |
|---|---|
| Weapons (noun "Weapon") | Simple Weapons (Simple), with Simple Melee Weapons and Simple Ranged Weapons; Martial Weapons (Martial), with Martial Melee Weapons and Martial Ranged Weapons |
| Armor (noun "Armor") | Light Armor (Light), Medium Armor (Medium), Heavy Armor (Heavy), Shields, each with its don and doff time as its `note` |
| Tools | Artisan's Tools, Other Tools |
| Adventuring Gear | None |
| Mounts and Vehicles | Mounts and Other Animals; Tack, Harness, and Drawn Vehicles; Airborne and Waterborne Vehicles |

A primitive names its leaf group in `stats.group`, and belongs to that group
and every ancestor. A group may instead be a `union` of other groups, with
no members of its own: Melee Weapons (Melee) is Simple Melee and Martial
Melee, and Ranged Weapons (Ranged) is Simple Ranged and Martial Ranged. A
union group's section lists its members as links, after the tree. The
Shield group is "Shields", because the Shield is an item of the same type
and names are unique.

Members print in name order, except armor, which prints by base AC and then
cost, as the SRD's table does.

### Variants

Some equipment comes in forms that share one description: Ammunition, Arcane
Focus, Druidic Focus, Holy Symbol, Gaming Set, Musical Instrument, and
Saddle. Each is one primitive with a `variants` list, each variant a `name`
with its own `cost`, `weight`, and, for ammunition, `amount` and `storage`.
A variant isn't a link target. A mention of one stays plain text, such as
the Mage's "Wand", the same as any SRD thing not in the library. Where the
SRD's tables print the parent's cost or weight, it reads "Varies" when any
variant has a value and "—" when none does.

### Fields

Each type's stored inputs, derived values, consistency checks, guideline,
link fields and labels, registry facets, and gap buckets. A field that takes
a link to a rules type takes a typed ref: a `Ref` whose key pattern allows
only that type, defined in `common.schema.json`, so a link of the wrong type
fails the schema. Gap fill never adds a rules extension; a custom condition
or equipment comes only from a request, so neither type has gap buckets.

#### Condition

- **Inputs:** `effects`, a list of at least one `{ name, text }`, `text`
  being `Text`. The template opens with "While you have the <Name>
  condition, you experience the following effect." ("effects." for more
  than one), the sentence all 15 SRD conditions open with, and prints each
  effect as a bold-titled paragraph: "**Speed 0.** Your Speed is 0 and can't
  increase."
- **Derived:** nothing.
- **Checks:** none beyond the schema.
- **Guideline:** `condition.md`: a custom condition is a state several
  entries share, not a one-off effect; effects are titled and written in
  the SRD's second person; it builds on SRD conditions by linking them
  ("You have the Incapacitated condition") rather than restating them.
- **Links and labels:** `{ref:…}` tokens in effect text read "References" /
  "Referenced by".
- **Registry:** no facets beyond the type; the card shows the effect names.

#### Glossary term

- **Inputs:** an optional `tag`, one of `action`, `area-of-effect`,
  `attitude`, or `hazard`, printed in brackets after the name ("Attack
  [Action]"); and `text`, the definition as printed, `Text`, including its
  "See also" sentence. Terms tagged Condition are condition primitives
  ([Rules pages](#rules-pages)).
- **Derived:** nothing.
- **Checks:** none beyond the schema.
- **Links and labels:** tokens in text, such as "See also" mentions of other
  terms, read "References" / "Referenced by".
- Primitive-only: no guideline, registry entry, facets, or gap buckets.

#### Weapon property and mastery property

- **Inputs:** `text`, the definition as printed.
- **Links and labels:** a weapon's `properties` read "Properties" /
  "Weapons", and its `mastery` reads "Mastery" / "Weapons", so each
  property's section lists the weapons that have it.
- Primitive-only, like glossary terms.

#### Equipment

**Inputs** every equipment has:

| Field | Shape |
|---|---|
| `group` | Required: a leaf group's `id` |
| `cost` | `{ amount, unit }`, `unit` one of `cp`, `sp`, `ep`, `gp`, `pp`. Required, except with `variants` |
| `weight` | Pounds, a positive number, printed as a fraction where the SRD uses one ("1/4 lb.", "1½ lb."). Omitted prints "—" |
| `weightNote` | Printed after the weight: "5 lb. (full)" |
| `text` | The description as printed, `Text`. Optional |
| `variants` | [Variants](#variants) |

and the block for its category, present only for that category:

- **`weapon`:** `damage`, `{ dice, type }` or `{ flat, type }` for the
  Blowgun's "1 Piercing"; `properties`, typed refs to weapon properties,
  each with an optional `note` ("Two-Handed (unless mounted)"); `mastery`, a
  typed ref to a mastery property; `range`, `{ normal, long }` in feet;
  `ammunition`, the piece as printed ("Bolt"); and `versatile`, dice. The
  template words the property list as the SRD does: "Ammunition (Range
  80/320; Bolt), Loading, Two-Handed", "Thrown (Range 20/60), Versatile
  (1d8)", and "—" with no properties.
- **`armor`:** `ac`, the base; `dex`, true when the Dexterity modifier
  adds; `dexMax`, its cap; `strength`, the score required; and
  `stealthDisadvantage`. It prints "11 + Dex modifier", "12 + Dex modifier
  (max 2)", or "16", and a Shield's `ac` prints as "+2".
- **`tool`:** `ability`; `utilize`, `Text` with its DCs as printed; and
  `craft`, `Text`. Craft lists stay text, because the SRD words them with
  exceptions ("Any Melee weapon (except Club, Greatclub, Quarterstaff, and
  Whip)"); the link pass links the names in them.
- **`mount`:** `carryingCapacity` in pounds, and `creature`, a typed ref to
  the animal's stat block.
- **`vehicle`:** `speedMph`, `crew`, `passengers`, `cargoTons`, `ac`, `hp`,
  and `damageThreshold`; those the SRD prints "—" for are omitted.

**Derived:** `category`, the group's root, so the category is never stored
beside the group; and `costGp`, the cost in gold pieces, for sorting and the
cost facet.

**Checks** (errors):

- `group` is a leaf group of the ruleset, and the category block present is
  the one for its category, if that category has one.
- `cost` and `weight` are absent with `variants`, and `cost` is present
  without.
- A weapon has `range` exactly when it has the Ammunition or Thrown
  property, `ammunition` exactly with Ammunition, and `versatile` exactly
  with Versatile; `range.long` is above `range.normal`.
- `dexMax` only with `dex`.

**Guideline:** `equipment.md`: custom equipment fills a gap in the SRD's
tables rather than renaming an SRD item, sits in the group whose stats it
matches, and is costed against that group's SRD items; balance is judged in
review.

**Links and labels:** the weapon property and mastery labels above; a
mount's `creature` reads "Stat block" / "Sold as"; tokens in `text`,
`utilize`, and `craft` read "References" / "Referenced by".

**Registry facets** (for extensions): `derived.category`, `stats.group` (the
filter tree nests it under its category, as Equipment › Weapon › Martial ›
Melee), `derived.costGp` (range), `stats.weapon.damage.type`,
`stats.weapon.properties`, and `stats.weapon.mastery`. The card shows the
group and cost, and the default sort is cost.

#### Item

`item` keeps every field, check, facet, and gap bucket it has, and changes
one field. `baseItem` becomes structured links, and the template
words them:

```json
{ "baseItem": { "any": [{ "ref": "equipment/medium-armor" }, { "ref": "equipment/heavy-armor" }], "except": [{ "ref": "equipment/hide-armor" }] } }
{ "baseItem": { "oneOf": [{ "ref": "equipment/longsword" }, { "ref": "equipment/rapier" }] } }
```

- **`oneOf`** prints its names as an English list joined by "or":
  "Glaive, Greatsword, Longsword, or Scimitar"; one name prints alone:
  "Shield".
- **`any`** prints "Any", then its targets as an English list joined by
  "or", each a group's `qualifier` or an item's name. When its only target
  is a group, the category's noun follows: "Any Melee Weapon". `except`
  adds ", Except" and its names, joined by "and".

Each qualifier and name is a link to its target; "Any", "or", and "Except"
are plain words. "Any Medium or Heavy, Except Hide Armor" reads with
"Medium", "Heavy", and "Hide Armor" linked to the Medium Armor, Heavy Armor,
and Hide Armor sections. This reproduces every base item in the SRD word
for word: "Any Simple or Martial", "Any Light, Medium, or Heavy", "Any
Medium or Heavy, Except Hide Armor", "Any Melee Weapon", "Any Ammunition",
and every list of items.

- **Checks** (errors): exactly one of `any` and `oneOf`; `any` targets are
  groups or items with `variants`; `oneOf` targets are items; each `except`
  target belongs to an `any` target. `baseItem` stays required for armor
  and weapons.
- **Links and labels:** `baseItem` reads "Base item" / "Base of". A group's
  section lists only the items that name it, not the items that name a
  group it belongs to.
- **Guideline:** `item.md`'s base item guidance is rewritten for links.

#### Creature

Two fields change:

- **`immunities.conditions`** takes typed refs to conditions in place of the
  condition enum. The Immunities line prints the same words, each linked.
  The labels are "Immune to" / "Immune creatures", and the field becomes an
  enum facet, valued by key and shown by name (the UI's Creature ›
  Immunities › Conditions).
- **`gear`** stays `RefOrText`, and a ref may target equipment as well as an
  item. A gear ref may add a `count` of 2 or more, printed after the name
  with an "s" added: `{ "ref": "equipment/javelin", "count": 6 }` reads
  "Javelins (6)", as the SRD prints it. Every plural in SRD gear adds an
  "s"; a field for an irregular one waits until one is needed.

### Mentions in text

A mention of a condition, equipment, or glossary term in text becomes a
`{ref:…}` token only where the target's name reproduces the text exactly,
case included, so SRD text stays word for word: "the Poisoned condition"
and "has Advantage" link, while "an attack roll" and "2 Daggers" stay
plain. Conditions and equipment are linked at every mention, as entries
are; a glossary term is linked at its first mention in each text field, so
rules text isn't carpeted with links to "Advantage" and "Bonus Action".

## Cases

- `creature/air-elemental`: its condition immunities become links to
  `condition/…` primitives.
- `item/adamantine-armor`: its base item "Any Medium or Heavy, Except
  Hide Armor" names two armor groups and excludes one item.
- `item/dragon-slayer`: its base item "Any Simple or Martial" names two
  weapon groups.
- `spell/contagion`: rules text naming the Poisoned condition links to the
  Poisoned primitive on the Conditions page: "have the
  {ref:condition/poisoned} condition", "While {ref:condition/poisoned}",
  and "the {ref:condition/poisoned} target" all read as printed.
- `item/flame-tongue`: its base item "Any Melee Weapon" names one
  union group, so the category's noun follows its qualifier.
- `item/frost-brand`: its base item, a list of six weapons, is a
  `oneOf` of six weapon primitives.
- `creature/guard-captain`: its gear "Javelins (6)" is a gear ref with a
  count; "Breastplate", "Longsword", and "Shield" are plain refs.
- `creature/mage`: its gear "Wand" is an Arcane Focus variant, so it stays
  plain text.
- `creature/riding-horse`: the Riding Horse in Mounts and Other Animals
  links to it as its stat block.

## Migration

- **Conditions:** the `Condition` enum in `common.schema.json` and the
  `conditions` table become the condition primitives, and a creature's
  `immunities.conditions` takes typed refs to them.
- **Base items:** every `baseItem` string becomes its `any` or `oneOf`
  form, which must render the same words.
- **Creature gear** naming equipment becomes refs, with a `count` where the
  SRD prints one, in the link pass.
- **Mentions in text** of conditions, equipment, and glossary terms become
  links through a link pass once the primitives exist
  ([Mentions in text](#mentions-in-text)).

## Done when

- Each new type validates against its schema, with fixtures for its
  errors.
- The rules pages build, with an anchor for every primitive and group, and
  an extensions list.
- `srd-coverage` reports every SRD primitive and equipment group present.
- Components don't appear in the library's galleries or search, and each is
  rendered on its parent's page.
- Links to primitives, groups, and components resolve, and a link to a
  missing one fails CI.

## Open questions

- **The content types' fields** (feat, background, species, class,
  subclass, and their components): inputs and derived values, consistency
  checks, guideline, link fields and labels, registry facets, and gap
  buckets, settled as [Fields](#fields) settles the rules types'. A type
  isn't built until its fields are settled here.

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
