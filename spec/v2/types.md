---
issue: 112
---

# Types

## Goal

Ruleset completeness: the library holds every SRD 5.2 component a character
or a game draws on, and user content builds on that base and extends it. Every
relationship between them is data, made of links with references tracked
automatically ([References](../../docs/content-model.md#references)). It serves P3 (one source per fact),
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
- Feats, backgrounds, species, classes, and subclasses are built
  ([Feats](../../docs/rulesets.md#feats) through
  [Subclasses](../../docs/rulesets.md#subclasses)).
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

The component mechanism and every component type are built
([Components](../../docs/content-model.md#components),
[Species](../../docs/rulesets.md#species),
[Classes](../../docs/rulesets.md#classes)), and so are their SRD manifest
records ([SRD manifest and coverage](../../docs/content-model.md#srd-manifest-and-coverage)).

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
  list is derived from these refs ([Classes](../../docs/rulesets.md#classes)), so it's stored once, on
  the spells.

#### Background

Built ([Backgrounds](../../docs/rulesets.md#backgrounds)), except one facet:
**`stats.feat`** becomes an enum facet valued by key and shown by name, with
the filter tree (#235), and the card shows it then, beside the abilities.

#### Class and subclass

Built ([Classes](../../docs/rulesets.md#classes),
[Subclasses](../../docs/rulesets.md#subclasses)), except what waits for the
SRD import (#234):

- The build checks each SRD class's derived Features table and spell list
  against the SRD's.
- The subclass card shows its class, `stats.class` becomes an enum facet
  valued by key and shown by name, and subclasses sort by class, with the
  filter tree (#235).

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

## Migration

Spell `classes` move from the enum to class refs in the SRD import stage
for classes (#234), once the classes exist; every entry keeps its classes and
its words.

## Done when

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
