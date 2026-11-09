# Content model

## Purpose

What an entry is, in every ruleset: the file it lives in, its fixed keys, how
it links to other entries, which of its fields display, how SRD entries differ
from custom ones, and what validation checks. Rules specific to a ruleset, such
as the `stats` of a creature, are in [rulesets.md](rulesets.md).

## Behavior

### Entry envelope

Every entry is one JSON file at `content/<ruleset>/<type>/<id>.json`, and the
path must match the entry's `ruleset`, `type`, and `id`. Every entry, in every
ruleset, has the same envelope: `ruleset`, `type`, `id`, `name`, `summary`,
`stats`, and `meta`, plus optional `description`, `tags`, and `image`. Unknown
top-level keys are rejected.

The envelope has three zones:

- **`stats`** holds the rules data, validated strictly by the ruleset's schema
  for the type. Unknown keys fail. It holds inputs only, never a value the
  ruleset derives ([rulesets.md](rulesets.md#inputs-and-derived-values)).
- **`tags`** holds open organization ([Tags](#tags)).
- **`meta`** holds provenance ([Meta](#meta)).

`ruleset` must name a folder in `rulesets/` and a ruleset in
`config/types.json`; `type` must be listed in the ruleset's `ruleset.json`,
with a schema file and a registry entry. Anything else fails as unknown.

### IDs and names

- The ID is the slug of the name at creation: lowercase, ASCII-folded,
  non-alphanumerics collapsed to `-`. It equals the file name.
- IDs and names are unique within a type, not across the library. Entries of
  different types are different things even when they share a name: the Giant
  Insect spell and a Giant Insect creature can both exist. Everything that
  identifies an entry carries its type: a ref is `<type>/<id>`, a page URL is
  `/<ruleset>/<type>/<id>/`, and the print view takes `<type>/<id>` keys.
- An ID never changes after merge. A rename changes `name` and keeps the ID.
- On a name or ID collision, the generator picks a different name; it never
  appends a numeric suffix.
- The validator warns on near-duplicate names within a type (normalized edit
  distance of 2 or less), so a reviewer can catch "Frost Lance" beside "Frost
  Lances". It skips a pair when both are SRD entries, since neither name can
  change: "Fireball" and "Fire Bolt" are both canonical.

### Tags

- `tags` is a flat map. Values are a string, number, boolean, or array of
  strings; nested objects are rejected. Nothing else in `tags` is ever
  rejected for being unknown.
- Every tag key becomes a gallery filter, `tags.<key>`, with no configuration.
- Conventional keys, not enforced: `world`, `campaign`, `theme`,
  `environment`, `author`.
- Filtering compares strings case-insensitively; display keeps the stored
  case.

### Meta

`meta` records when an entry was created and revised, and where it came from:
the source kind (`routine`, `revise`, or `manual`), the issues it fulfilled, the
gap bucket that produced it ([generation.md](generation.md#gap-buckets)), and
whether it's an SRD entry. It shows on the detail page as a provenance line and
`meta.createdAt` is sortable, but meta isn't a tag.

### Text fields

`description` and the rules-text fields inside `stats` take a markdown subset:
paragraphs, `**bold**`, `*italic*`, bulleted and numbered lists, line breaks,
and pipe tables ([Tables in text](#tables-in-text)). No headings, links
(including bare URLs, which render as links), HTML, or images.

- The validator lexes text with the same `marked` lexer the site renders with,
  so the check and the site read the same structure.
- A schema marks these fields with the `markdownSubset: true` keyword: the
  envelope's `description` and the ruleset's `Text` definition. A field that
  uses `Text` gets the check with no code change.
- Rendering is sanitized ([site.md](site.md#templates)).
- A ruleset may define tokens that render derived values inside text
  ([rulesets.md](rulesets.md#text-tokens)), and any text may link to another
  entry with a `{ref:<type>/<id>}` token ([References](#references)).

### Tables in text

A table is a GitHub-style pipe table inside the text, at the point where it
reads, so an SRD entry keeps its text in order. Any markdown-subset field may
hold one, in SRD and custom entries alike. It has a header row, a delimiter row
(`|---|---|`, with `:` for alignment), and at least one body row, and sits
between paragraphs:

```text
The type of giant determines the score (see the table below).

| Belt | Str. | Rarity |
|---|---|---|
| Belt of Giant Strength (hill) | 21 | Rare |
```

**Titles.** A paragraph that is only one bold run, directly above a table, is
the table's title, rendered as its caption. The title is plain text only, with
no italic, links, or tokens, since it also labels the table. Text that names
the table ("the Omens table") stays in the paragraph before it. A bold
paragraph anywhere else is an ordinary paragraph, and so is a bold run with
more text on its line ("**First Roar.** …").

```text
The GM chooses the omen from the Omens table.

**Omens**

| Omen | For Results That Will Be … |
|---|---|
| Weal | Good |
```

Cells hold only inline text: bold, italic, and tokens where the ruleset allows
them. A `|` inside a cell is escaped as `\|`. The validator rejects a malformed
table: a row with a different number of cells than the header, an empty header
cell, no body rows, a line that starts with `|` but doesn't parse as a table
(usually a missing or mismatched delimiter row), and a title with anything but
plain text.

### Images

- `image` is optional: a repo-relative path,
  `assets/images/<ruleset>/<type>/<id>.(png|jpg|webp)`, to a file that must
  exist. Validation warns above 500 KB and fails above 2 MB.
- The build copies `assets/images/` into the site output.
- Art shows only when `image` is set. Without it, the gallery card, detail
  page, and PNG and print exports render no art, no container, and no
  placeholder; the layout closes up.
- Committed art must be something we have the rights to publish, credited in
  `ATTRIBUTION.md`.

### References

A reference takes one of two forms, both keyed by `<type>/<id>`, since the ID
never changes and is unique within its type:

- **A ref object**, `{ "ref": "<type>/<id>" }`, valid only inside `stats` at
  fields the schema declares as `RefOrText` (or `CountedRefOrText`, creature
  gear, which may add a `count`). It may add a `note`, a qualifier
  printed in parentheses after the name wherever the ref renders:
  `{ "ref": "spell/fireball", "note": "level 5 version" }` reads "Fireball
  (level 5 version)".
- **A text token**, `{ref:<type>/<id>}`, valid in any markdown-subset field in
  every ruleset and type. It is the one way text links to another entry.

Neither form carries display text. The site shows the target's current name,
so a rename updates every link, and no link text is written by hand. A token
renders as that name linked to the target's detail page, and reads as the name
in search text. It takes inline markup around it: a spell name is written
`*{ref:spell/cure-wounds}*`, as SRD text italicizes spell names. Because the
token renders the name, SRD text stays word for word when a mention becomes a
link: "becomes a {ref:creature/zombie}" reads "becomes a Zombie". A token
anywhere else (`name`, `summary`, a plain-string `stats` field) is a validation
error, as is a malformed one such as `{ref:zombie}`.

- **Mentions of rules.** A mention of a condition, equipment (or an
  equipment group), or glossary term in SRD text is a token only where the
  target's name reproduces the text exactly, case included: "the Poisoned
  condition" and "has Advantage" link, while "an attack roll" and "2 Daggers"
  stay plain. Conditions and equipment link at every mention; a glossary term
  at its first mention in each text field, so rules text isn't carpeted with
  links to "Advantage". A capitalized word that starts a sentence or a table
  cell, a name inside a longer capitalized name ("Total Cover", "Opportunity
  Attack", "Cube of Force Faces"), the name of a table or column ("the Armor
  table"), a section of a chapter in a cross-reference ("Playing the Game"
  ("Damage and Healing")), and a creature's mention of its own action
  ("two Javelin attacks") stay plain. "Acid" names the damage type and
  "Ammunition" the weapon property, so neither links to the equipment. Rules
  data follows the same rule ([Rules data](rulesets.md#rules-data)).
- A `RefOrText` field takes a ref or a plain string. A plain string names SRD
  content not in the library ("Fireball", or "Lightning Bolt (level 5
  version)"). Once the entry is in the library, new entries ref it. Text
  follows the same rule.
- Every ref must resolve to an entry of its type, in the same ruleset, or to
  a ruleset primitive or group of its type ([Rules data](rulesets.md#rules-data)),
  which renders as its name linked to its anchor on its rules page. An entry
  that fails its own `stats` schema can still be a target, but its own refs
  aren't checked until its schema passes. Deleting an entry that others
  reference fails CI until those refs are removed or replaced.
- The validator and the build compute back-references. Each entry's `refs`
  (forward) and `refBy` (back) are lists of `{ path, key }`: `path` is where
  the ref sits in the referring entry (`stats.spells[0].spell`, or
  `stats.effect` for a token), and `key` is the other end. Only resolved refs
  are listed, in document order.
- Detail pages show forward links ("Casts: Frost Lance") and back-links ("Cast
  by: Cinder Witch"), each target once per label. The ruleset names each
  relation from the field the ref sits in
  ([rulesets.md](rulesets.md#the-ruleset-module)).
- A batch may add its own dependencies, such as a creature plus the new spell
  it casts.

### Situational fields

Many `stats` fields apply to some entries and not others: a spell's material
cost, an item's `cursed` flag, a creature's `lair`. One rule decides
whether a field displays, and it lives in the type's schema, not in templates
or the registry:

- **Required fields always display**, including `0` or `false`. A cantrip's
  `level: 0` and a spell's `ritual: false` are facts. How a value reads is the
  template's formatting (level 0 reads "Cantrip"), not a display decision.
- **Optional fields display only when present**, and a present optional field
  always displays.
- **Omission is the only way to say "doesn't apply".** The schema rejects every
  other "none" value for an optional field, so presence and applicability can't
  disagree:

| Optional shape | Schema constraint | Rejected stand-ins |
|---|---|---|
| Number | A minimum that excludes the "none" value, or `not: { const: 0 }` for a signed number | `0` |
| Boolean flag | `const: true` | `false` |
| String | `minLength: 1` | `""` |
| Array | `minItems: 1` | `[]` |
| Object | `minProperties: 1`, or required keys | `{}` |

An optional number whose `0` is a real value, such as an item's
`attackBonus` of +0, keeps `0` valid and displays it when present. A facet on
an optional flag reads an omitted key as `false`. A derived value always
exists, so a line that shows one displays even when its optional inputs are
omitted: the Senses line still shows Passive Perception.

**DCs.** A DC displays only when there is one, by one rule for every type. An
authored DC, such as an item's `spells[].saveDc`, is omitted when there is
none; `0` is never a stand-in. A derived DC, which always exists, is switched
off by an optional flag on the input that derives it, such as a creature's
`spellcasting.noSaveDc`.

Because the schema holds the rule, it needs no display annotation. Every
template, including the generic fallback, decides from presence alone, through
one shared helper ([site.md](site.md#templates)), never by testing a value
against `0`, `false`, or emptiness.

### SRD and custom entries

Every entry is either an **SRD entry**, reproduced from SRD 5.2, or a **custom
entry**, original to this library. SRD text is transcribed from the reference
copy in the repo, `docs/SRD_CC_v5.2.pdf`, never from memory.

**SRD entries are included unmodified.**

- `name` is the SRD name exactly. `stats` reproduce the SRD stat block, so every
  number the template renders, derived or not, matches the SRD. Rules text is
  the SRD's word for word, except that derived numbers are written as tokens
  that render the same values.
- An SRD entry carries both the data and the verbatim rule. It fills every
  structured field its type defines (an item's `charges` and `spells`, with
  their costs and DCs), and its rules text still keeps every sentence, even
  where both state the same thing. An SRD wand's `effect` keeps "This wand has
  7 charges", its spell's save DC, and its "Regaining Charges" paragraph, while
  `charges` holds the maximum, recharge, and depletion. The rule that item text
  doesn't restate structured fields is for custom entries only.
- Where the ruleset's derivation can't reach an SRD number from inputs, an
  `adjust` or damage `bonus` matches it, with "matches SRD" as its reason. A
  printed number that contradicts the entry's own stats is a misprint: the
  entry keeps the derived value, and the misprint is recorded in the PR.
- SRD content is literal, so the ruleset's consistency warnings are skipped on
  an SRD entry. Its errors still apply ([Validation](#validation)).
- Only what the SRD doesn't provide is authored: a required one-line factual
  `summary`. `description` is omitted, since SRD stat blocks carry no lore. The
  guidelines' tone, naming, and balance targets don't apply.

**Formatting.** An SRD entry matches the SRD's words, numbers, and order, and
the templates print them in SRD 5.2 form. Typography beyond that isn't matched
entry by entry: line wrapping, hanging indents, column layout, the place of
Spellcasting among a creature's actions (after the others), and the italics the
PDF puts on names inside plain-string fields all come from the templates, never
from per-entry workarounds. A printed detail the structured fields can't express
goes, as printed, in the nearest free-text field the schema offers: a
form-limited speed in `speed.note`, a qualifier in a ref's `note` or a plain
string. A new field is added only when a detail recurs across many entries and
has a fixed shape.

**How SRD entries enter and change.**

- An SRD entry sets `meta.source.srd: true`. It is added only by a request that
  asks for SRD content or by an SRD import stage
  ([generation.md](generation.md#srd-import)); gap fill never adds one.
- Each SRD entry enters once; the uniqueness rules enforce it. If an SRD name
  collides with an existing custom entry of the same type, the SRD entry isn't
  added, and the run reports the collision so the custom entry can be renamed
  through a `revise` issue.
- A revision of an SRD entry only brings it closer to the SRD, such as a
  transcription fix. A variant of an SRD entry is a new custom entry.

**Custom entries stay clear of SRD content,** whether or not the SRD entry is
in the library: no SRD entry's exact name, of any type; no SRD proper noun (a
specific person, place, or thing named in the SRD); and no concept that
duplicates an SRD entry. A custom name may build on the common words in SRD
names: "Fire Zombie" and "Ice Troll" are fine beside the SRD's Zombie and Troll.
A custom entry omits `meta.source.srd`. The blocklist keeps non-SRD proper
nouns out of every entry ([licensing.md](licensing.md#blocklist)).

### SRD manifest and coverage

`rulesets/<ruleset>/srd-manifest.json` lists every SRD entry of the ruleset's
types, transcribed from the reference PDF, each once by type and exact name.
Where the PDF misprints a heading, the manifest uses the entry's correct name
(the Knight's stat block is headed "Iron Golem"). Each record has a tier:
`complex` if the SRD entry has any of the following, `simple` otherwise:

- creature: legendary actions, a lair, a Spellcasting action, reactions, or a
  Shape-Shift action;
- item: a table, a stat block, variants under one name ("+1, +2, or +3",
  a rarity of "Varies", or versions such as giant types), several spells cast
  for charges, or a variable charge cost;
- spell: a table, a stat block, or a Reaction casting time with a trigger.

The manifest's `rules` list holds the ruleset's rules data the same way
([Rules data](rulesets.md#rules-data)): every primitive by rules type and exact
name, and every group with `"group": true`, transcribed from the PDF where the
SRD prints it (the groups are the ruleset's own list). Rules records have no
tier.

`npm run srd-coverage` matches SRD entries to manifest records by type and exact
name. It prints, per type and tier, the count missing and their names, then any
SRD entry that isn't in the manifest (usually a name that doesn't match
exactly). It then matches the rules data's primitives and groups to the
`rules` records by type, name, and kind, and prints the same report for them.
`--type` (a type or a rules type), `--tier`, and `--ruleset` narrow it; `--tier`
leaves the rules records out. A test checks that the manifest is valid, that its
per-type counts are the expected ones, that every SRD entry in the library is in
it, and that the rules data holds every rules record and no other.

### Validation

`npm run validate` checks every entry: the envelope and `stats` schemas, then
consistency checks a schema can't express. **Errors** fail CI; **warnings**
appear in local output and the PR's job summary but don't block. Derived values
are never checked, because they are never stored.

Checks for every type and ruleset:

| Check | Level |
|---|---|
| File path matches `ruleset`, `type`, `id` | error |
| ID unique within its type; name unique within its type, ignoring case | error |
| Near-duplicate names, unless both entries are SRD entries | warning |
| Every ref resolves and its type matches | error |
| Text fields use only the markdown subset | error |
| Blocklist match in any text-bearing field ([licensing.md](licensing.md#blocklist)) | error |
| Placeholder text in any text-bearing field: `TODO`, `TBD`, `FIXME`, or `XXX` as a whole word in capitals, or "lorem ipsum" in any case | error |
| `image` path valid and file exists; size limits | error / warning |

Each ruleset adds its own checks ([rulesets.md](rulesets.md#consistency-checks)).
The validator skips a ruleset's warnings on an SRD entry, whose numbers and
text are literal; errors still apply. The build fails if validation fails, so
nothing invalid reaches the site.

## Where the rules live

- `schemas/envelope.schema.json`: the envelope, tags, meta, and image, with a
  description of each field.
- `scripts/validate/`: the CLI, the schema stage, the checks for every type,
  the text checks (`text.ts`), and ref resolution and back-references
  (`refs.ts`).
- `lib/text.ts`: name normalization and the blocklist matcher.
  `lib/table-title.ts`: what counts as a table title, shared by the validator
  and the renderer.
- `rulesets/<ruleset>/srd-manifest.json` and `scripts/srd-coverage/`.
- `docs/SRD_CC_v5.2.pdf`: the SRD reference copy.

## Extending

| To add | Touch |
|---|---|
| A world, campaign, author, or theme | A tag on entries |
| A field a schema validates | The type's schema, plus the template if it displays |
| Art for an entry | Commit the file under `assets/images/` and set `image` |
| A check for every type | `scripts/validate/`, with a fixture for its error |
