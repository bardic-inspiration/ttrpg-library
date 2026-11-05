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

- The library has three types, `creature`, `spell`, and `magic-item`, all
  authored as entries ([Entry envelope](../../docs/content-model.md#entry-envelope)),
  registered in `config/types.json`, and shown as cards and detail pages
  ([Pages and navigation](../../docs/site.md#pages-and-navigation)).
- Conditions, damage types, skills, creature types, sizes, and abilities are
  closed lists in `rulesets/dnd-5e-2024/tables.json` and the
  `common.schema.json` enums.
- A magic item's base item is a plain string (`baseItem`).
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
  **cards**. Extensions appear in the library on an Extensions page, and in
  a simple, searchable list at the bottom of each rules page.

| Rules type | Primitives | Extensions in v2 | Rules page |
|---|---|---|---|
| Glossary term | Every SRD Rules Glossary term | None | Glossary |
| Condition | The SRD conditions | Authorable | Conditions |
| Equipment | The SRD weapons, armor, tools, adventuring gear, and mounts and vehicles | Authorable | One per category |

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

`magic-item` is renamed `item`. Items are content built on equipment: an
item links to its base equipment, an item or a group, on the rules side.

### Extension scope

v2 extension only adds: new content entries, custom conditions, and custom
equipment. Anything that modifies or replaces a rule, or adds a new
mechanic, waits for v3's house rules system.

## Cases

- `creature/air-elemental`: its condition immunities become links to
  `condition/…` primitives.
- `magic-item/adamantine-armor`: its base item "Any Medium or Heavy, Except
  Hide Armor" names two armor groups and excludes one item.
- `magic-item/dragon-slayer`: its base item "Any Simple or Martial" names two
  weapon groups.
- `spell/contagion`: rules text naming the Poisoned condition links to the
  Poisoned primitive on the Conditions page.

## Migration

- **`magic-item` to `item`:** every magic item's file moves to
  `content/<ruleset>/item/` with its `id` unchanged, every `magic-item/…`
  link becomes `item/…`, and the type's routes, registry entry, schema, and
  guideline are renamed. The old URLs redirect to the new ones (P9: stable
  URLs). It is a `migration`-labelled dev PR.
- **Conditions:** the condition enum and the `conditions` table become the
  condition primitives, and fields that take a condition, such as a
  creature's condition immunities, take links to them.
- **Base items:** `baseItem` becomes links to equipment primitives (see
  Open questions).
- **Mentions in text** of conditions, equipment, and glossary terms become
  links through a link pass once the primitives exist.

## Done when

- Each new type and the renamed `item` type validates against its schema,
  with fixtures for its errors.
- The rules pages build, with an anchor for every primitive and group, and
  an extensions list.
- Components don't appear in the library's galleries or search, and each is
  rendered on its parent's page.
- Links to primitives, groups, and components resolve, and a link to a
  missing one fails CI.
- No `magic-item` key remains, and every old magic-item URL redirects.

## Open questions

- **Each type's fields:** its inputs and derived values, consistency
  checks, guideline, link fields and labels, registry facets, and gap
  buckets. A type isn't built until its fields are settled here.
- **Base item wording:** a link renders its target's name, so "Any Medium or
  Heavy, Except Hide Armor" can't stay word for word as links to
  `equipment/medium-armor`, `equipment/heavy-armor`, and
  `equipment/hide-armor`. Does the base become structured links that the
  template words, or text that keeps the SRD wording?
- **The rest of the Equipment chapter:** coins, lifestyle expenses, food and
  lodging, hirelings, spellcasting services, and crafting. Are they rules
  pages, glossary terms, or left out?

## Out of scope

- Modifying or replacing a rule, and new mechanics: v3's house rules system
  (#118).
- Authoring glossary terms, and extending abilities, damage types, skills,
  creature types, or sizes.
- Locations, encounters, dungeons, a character sheet builder, and character
  presets (#118).
- The layout of pages and rules pages: the UI redesign (#113).
