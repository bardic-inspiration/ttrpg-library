---
issue: 111
---

# Linking

## Goal

One standard way for entries to link to each other, general enough for v2's
new types and later systems to build on. It serves P3 (a link holds only the
target's key, and the name and back-links are derived) and P2 (every link
must resolve, or CI fails).

## Current

- [References](../../docs/content-model.md#references): the two link forms,
  resolution, and back-references.
- [The ruleset module](../../docs/rulesets.md#the-ruleset-module): the
  `refs.ts` labels that name each relation.
- The `generate` skill's "Dependencies" and "Text" rules, and the `srd-import`
  skill's "Step 8: Link pass": how links are written when entries are
  authored.

## Design

v1's ref standard carries into v2 unchanged:

- **Two link forms, both keyed by `<type>/<id>`:** a ref object at a
  `RefOrText` field in `stats`, and a `{ref:…}` token in any markdown-subset
  text field.
- **Relations are typed by the field the link sits in.** There is no
  relation name stored on the link. The ruleset's `refs.ts` names each
  relation from both ends ("Casts" / "Cast by"), and any field it doesn't
  name reads "References" / "Referenced by".
- **Back-references are computed, never written.** Two entries that link to
  each other need no special handling: each end lists the other once per
  label.
- **Linking is part of authoring.** An entry links every library entry it
  mentions or uses, as the `generate` skill already requires. Mentions
  written as plain text because the target wasn't in the library yet are
  linked by a link pass.

A new type extends the standard by declaring its link fields, not by adding
a new mechanism:

- each field that can point at another entry is a `RefOrText` field in the
  type's schema;
- a relation that deserves its own wording gets a label pair in the
  ruleset's `refs.ts`, such as a background's granted feat ("Grants" /
  "Granted by");
- any other field falls back to "References" / "Referenced by".

The type extension (`types.md`, #112) declares these fields and
labels for each new type.

### Links to components

A **component**, a hidden sub-entry of a page type such as a class feature
(`types.md`), is linked like an entry or a ruleset primitive
([Rules data](../../docs/rulesets.md#rules-data)): by its own `<type>/<id>`
key, rendered as a link to its anchor on its parent's page.

## Cases

- `creature/lich`: a creature's spellcasting lists ref spells; they read
  "Casts", and each spell reads "Cast by" back.
- `item/boots-of-levitation`: an item's `spells` ref a spell, with the
  same "Casts" / "Cast by" labels as a creature.
- `spell/animate-dead`: `{ref:…}` tokens in rules text link
  `creature/zombie` and `creature/skeleton` as "References" /
  "Referenced by".
- `item/handy-haversack`: tokens link entries of the same type,
  `item/bag-of-holding` and `item/portable-hole`.

## Migration

None. Existing entries already follow the standard.

## Done when

There is nothing to build in this area alone. Each part goes with the types
build PR that first exercises it: "Links to components" with the first page
type, and the rest of the file with the first v2 type with link fields.

## Out of scope

- Each new type's link fields and labels: the type extension (#112).
- Links from v3's world components and character builder: the "Later (v3)"
  issue (#118).
