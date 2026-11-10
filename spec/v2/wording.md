---
issue: 273
depends: [types]
---

# Wording

## Goal

One system for how the site turns stored data into text a reader sees, used
by every type, the rules pages, and the exporters, for SRD and custom content
alike. The site is a web reference built on the SRD, not a facsimile of the
printed book: it bridges the SRD as written into structured entries, keeps its
rules and meaning, and stays within the SRD's license. The same system words
custom content, which is the site's long-term purpose. It serves P3 (each
phrasing rule is defined once), P4 (a new type adds phrases and vocabulary, not
helper code), P5 (SRD fidelity, read as fidelity of meaning), and P6
(templates own presentation).

## Current

- Each type's module in `site/src/lib/` builds its own text: `creature.ts`,
  `spell.ts`, `item.ts`, `equipment.ts`, `condition.ts`, `feat.ts`,
  `background.ts`, `species.ts`, and `starting-equipment.ts`, with display
  formats in `format.ts` ([Templates](../../docs/site.md#templates),
  [Type registry](../../docs/site.md#type-registry)).
- The grammar helpers are copied with small differences. `capitalize` is
  defined in four modules. There are three title-case rules: only
  `creature.ts`'s keeps minor words lowercase ("Sleight of Hand"). There are
  three list joiners, and inline `join(' or ')` and `join(' and ')` calls. There
  are four plural forms: "Beasts" / "Undead", "Javelins (6)", "4 Handaxes", and
  "10 minutes". An "a"/"an" rule exists only in the species intro.
- Fixed SRD sentences live in the type modules: the condition, feat, and
  species intros, "(see “Feats”)", ", chosen when you select this species",
  and the base item wording.
- Text comes in three forms: plain strings, markdown with `{ref:…}` tokens, and
  an item's base item as linked segments. The segments exist because a link
  there reads a group's qualifier ("Melee"), not its name, which a token can't
  render.
- SRD entries are "included unmodified", word for word, with only formatting
  left to the templates
  ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)).
  The SRD attribution doesn't say that the material is adapted
  ([SRD attribution](../../docs/licensing.md#srd-attribution)).

## Design

### Stored text and composed text

Every string a reader sees is one of two kinds:

- **Stored text** is written in an entry: rules text (`Text` fields) and
  lines kept as printed (a material component, a speed note). The wording
  layer never rewrites it. It only renders its tokens and markdown.
- **Composed text** is built by a template from structured fields: a
  heading's subtitle, a labeled line, an intro sentence, a list of refs. All
  of it is built through the wording layer, never by hand in a type module.

### SRD adaptation

P5 becomes fidelity of meaning. An SRD entry keeps the SRD's rules: every
number, rules term, condition, name, and the effect of every sentence. Its
presentation follows the site's house style, which may differ from the print
layout. The test for any difference: **would a player at the table play it
differently?** If not, it's style, and it's allowed without a note.

Allowed adaptations:

- **Form:** capitalization of labels, list punctuation (a serial comma, "and"
  or "or" before the last item), quote marks and dashes, run-in heading style,
  table layout (a two-up table as one table), bullets for printed columns.
- **Connective wording composed from fields:** intros, "Choose A or B",
  plurals, articles, the order of parts within a line where order carries no
  meaning, and one wording where the SRD's chapters differ only in style (a
  class's "Explorer’s Pack, and 15 GP" and a background's "Robe, 8 GP" both
  become the house style).
- **Cross-references written for print,** such as "(see “Feats”)" or "(see
  “Monsters” for its stat block)", become links or are dropped where a link
  already takes the reader there.
- **Link text:** a link reads its target's name, or display text where the
  SRD names the target differently in context ("Traveler's Clothes" for the
  primitive "Clothes, Traveler's").

Not allowed: changing a number, a die, a range, a duration, a condition, a
rules term, who or what an effect applies to, or an entry's name; dropping or
adding a rules sentence. A change of meaning is a custom entry, never an SRD
entry. Transcription still starts from the SRD's words. The adaptations are
what the house style does to them, not a license to paraphrase.

### Attribution

CC-BY 4.0 requires an adapter to indicate that it modified the licensed
material (section 3(a)(1)(B) of the license). The full attribution statement adds a sentence, and
the short form a word:

> This work includes material from the System Reference Document 5.2 ("SRD
> 5.2") by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative
> Commons Attribution 4.0 International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode. **This site adapts
> that material: it is reformatted for the web and its wording is composed
> from structured data.**

Short form: "Includes adapted SRD 5.2 material, CC-BY-4.0". Both change
everywhere the statement appears: `ATTRIBUTION.md`, the footer, `/about/`,
print runs, and PNG captures.

### The wording layer

**`lib/wording/`, shared by the site, the exporters, and the translators:**
English grammar with no ruleset knowledge.

- **`Phrase`:** composed text as a list of parts, each plain text or a link
  `{ key, text? }`. `text` overrides the target's name. Renderers turn a
  phrase into markdown (links as tokens) for templates, or plain text for
  search, alt text, PR summaries, and exports. This replaces the three
  current forms, including the base item's segments.
- **Casing:** one `titleCase`, with minor words ("of", "and", "or", "the",
  …) lowercase except first, and `capitalize` for a sentence start.
- **Lists:** `list(items, "and" | "or")`: "A", "A and B", "A, B, and C".
- **Counts and plurals:** `counted(n, noun)` and `plural(noun)`, adding "s",
  "y" → "ies", and irregular and unchanging plurals from the phrase book
  ("Undead", "Fey").
- **Articles:** `article(word)`, "a" or "an" by the word's first letter, with
  exceptions from the phrase book ("an hour", "a unicorn").

**`{ref:<type>/<id>|<text>}`:** a link token with display text, valid in
stored text as in composed text. It renders `text`, linked to the target, and
the validator still resolves the key. Authors use it only where the SRD
names a target differently in context. The search index reads the display
text.

**`rulesets/<ruleset>/phrases.json`, the phrase book:**

- **Sentences:** each fixed sentence by key, with named slots:
  `"condition.intro": "While you have the {name} condition, you experience the
  following {effects}."` A type module fills the slots with phrases, and never
  holds a fixed sentence itself.
- **Vocabulary:** the display name of each enum value, keyed by enum:
  abilities ("Intelligence"), skills ("Sleight of Hand"), creature types and
  their plurals, schools, feat categories ("Origin Feat"), sizes, rarities.
  Registry facet `format`s read the same vocabulary, so a value reads the
  same on a card, in a filter, and on its page. `format.ts`'s formatters
  become lookups.

**Type modules only compose.** `site/src/lib/<type>.ts` picks fields, fills
phrases, and returns them. It defines no casing, list, plural, or article
helper and holds no sentence text. A test fails if one does.

### Custom content

Custom entries render through the same composers, so they read in the same
house style as SRD entries, and an author writes only fields and rules text.
Each guideline points to the phrase book for the sentences the template
supplies, so authors don't repeat them. A new type adds its sentences and
vocabulary to the phrase book and its composer to `site/src/lib/`.

## Cases

- `item/flame-tongue`: the base item "Any Melee Weapon", with "Melee" a link
  to the Melee Weapons group, as a phrase rather than segments.
- `creature/swarm-of-bats`: "Swarm of Tiny Beasts", a plural from the
  vocabulary.
- `creature/guard-captain`: gear with counts, "Javelins (6)", through
  `counted`.
- `creature/blink-dog`: languages joined by `list`.
- `spell/animate-dead`: "(see “Monsters” for its stat block)" beside a link to
  `creature/zombie`, a print cross-reference the adaptation rule may drop.
- `spell/fireball`: a level line, "Level 3 Evocation (Sorcerer, Wizard)",
  from vocabulary and `list`.

## Migration

- No entry has to change. Every page renders as it does now, except for the
  adaptations the build PR lists, which a rendered-text diff over every
  entry shows for review.
- Display-text tokens and dropped print cross-references in SRD entries come
  through `revise` PRs, not this build.
- The `generate`, `revise`, and `srd-import` skills, and the guidelines,
  replace "word for word" with the adaptation rule.

## Done when

- `lib/wording/` and `phrases.json` exist, with tests, and every type module,
  rules page component, and exporter uses them.
- A test fails when a type module defines a casing, list, plural, or article
  helper, or a fixed sentence.
- Facet formats read the vocabulary.
- `{ref:…|…}` tokens validate, render, and index.
- The attribution statement and its short form say the material is adapted,
  everywhere they appear.
- `docs/` describes the layer and the adaptation rule; P5's row in
  `docs/decisions.md` is updated.

## Out of scope

- Rewording stored SRD text: `revise` PRs, case by case.
- Translations into other languages.
- The page layout: the UI redesign (#113).
