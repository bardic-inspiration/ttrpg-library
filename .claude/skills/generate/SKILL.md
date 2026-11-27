---
name: generate
description: Generate new library entries for a content request issue, an import issue, an inline request, or a gap-fill bucket, validate them, and open a content PR. Generic across types and rulesets, with a procedure per type (character presets have their own). Use from a routine run (docs/generation.md#run-order steps 4 to 6) or when asked to fulfil a `request` or `import` issue. Not for revisions; those use the revise skill.
---

# Generate

Turns one batch of requests into entries under `content/` and one content PR.
[The generate skill](../../../docs/generation.md#the-generate-skill) is the source of truth; this skill is how to carry it out.
Follow it exactly, in order. Never skip validation, and never push a failing
batch.

The routine run that calls this skill has already synced `main`, picked the
batch, and claimed each issue with the `in-progress` label ([Run order](../../../docs/generation.md#run-order) steps 1, 4,
5, and 6). This skill starts after that.

`defaults.<key>` below means that key of `config/defaults.json`.

## Inputs

One batch, from exactly one of these sources:

- **Issues.** One or more open `request` issues. Read each with its comments.
  A content-request form body has one `### <label>` heading per field
  (`Type`, `Count`, `Brief`, `Ruleset`); `_No response_` means the
  field was left blank. A free-form `request` issue is read for the same
  fields in its prose ([Requests](../../../docs/generation.md#requests)).
- **Import issues.** One or more open `import` issues, an import batch
  ([Imports](../../../docs/generation.md#imports)). An import-request form body has one `### <label>` heading per
  field (`Format`, `File`, `Work`, `Author`, `Source URL`, `License`,
  `Ruleset`, `Notes`). An import batch is never mixed with content requests;
  it follows "Import batches" below in place of steps 2 to 4.
- **Inline request.** Type, count, brief, and ruleset given directly by a manual
  run, with no issue ([Run order](../../../docs/generation.md#run-order)).
- **Gap bucket.** A type and a bucket label such as `stats.cr=2..4`, chosen by
  the run ([Run order](../../../docs/generation.md#run-order) step 6, [Gap buckets](../../../docs/generation.md#gap-buckets)), with a count of `defaults.gapFill.count`. The
  brief is to fill that bucket: every entry's values must fall in it.
- **SRD import stage.** A stage issue of the full SRD import ([SRD import](../../../docs/generation.md#srd-import)), worked
  in a session the owner starts. The batch is SRD entries of one type and
  tier, picked from `npm run srd-coverage -- --type <type> --tier <tier>`.
  It is an SRD request; don't claim the issue with `in-progress`. The full
  import is done; the session workflow its stages followed is archived at
  `.claude/archive/srd-import/SKILL.md`.

Resolve each request against `config/defaults.json` as
`scripts/generate/defaults.ts` (`applyDefaults`) does: a blank field takes
the default (`defaults.ruleset`, `defaults.count`), a request's count is
taken as given (no batch has a size limit, [Defaults](../../../docs/generation.md#defaults)). A request that names a
`source` or `author` sets the entries' own; without one, custom entries take
`defaults.author`, and the `source` in `config/defaults.json` when it sets one.

A brief that asks for SRD content, by name or by description ("ten SRD
creatures of CR 1 to 3"), is an **SRD request**: it is fulfilled with SRD
entries reproduced faithfully from SRD 5.2 ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)). Any other brief, and every
gap-fill run, is fulfilled with custom entries.

If a request can't be fulfilled as written (contradictory constraints, a type
or ruleset not in `config/types.json`), don't generate it: comment one
question on the issue, add `needs-info`, remove `in-progress`, and leave it
out of the batch ([Run order](../../../docs/generation.md#run-order) step 7).

## Step 1: Read

For the batch's ruleset and each type in it, read:

- `config/types.json`: the type's registry entry, including its `guideline`
  path, `summaryField`, and `gapBuckets`.
- `config/defaults.json`.
- The ruleset module, `rulesets/<ruleset>/`: the type's schema
  `rulesets/<ruleset>/schemas/<type>.schema.json` and the shared
  `rulesets/<ruleset>/schemas/common.schema.json`, the rules tables
  `rulesets/<ruleset>/tables.json`, the text tokens
  `rulesets/<ruleset>/tokens.ts`, and the guideline
  `rulesets/<ruleset>/guidelines/<type>.md`. The guideline is binding: tone,
  naming, balance targets, prose style, and when to create a dependency.
- `config/blocklist.json`.
- `site/public/library.json`, the current library. If it is missing, run
  `npm run build:index` first.
- The example entries in `tests/fixtures/library/valid/dnd-5e-2024/` and the schema shape in `schemas/envelope.schema.json`.

## Step 2: Avoid collisions

From `site/public/library.json`, list every existing `name` and `id` of each
type in the batch: IDs and names are unique within a type ([IDs and names](../../../docs/content-model.md#ids-and-names)), so a new
spell may share a name with a creature but not with another spell. Then find existing
entries that match the brief's theme (by name, summary, and facets) so the
batch doesn't repeat a concept already in the library.

- On a name or ID collision, choose a different name. Never add a numeric
  suffix.
- Avoid names within a small edit of an existing name ("Frost Lance" vs
  "Frost Lances"); the validator warns on them.
- Custom entries: never use an SRD entry's exact name (of any type) or an
  SRD proper noun, whether or not the SRD entry is in the library, and avoid
  every blocklist term ([Blocklist](../../../docs/licensing.md#blocklist)). Building on common words from SRD names
  ("Fire Zombie") is fine ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).
- SRD request: skip any SRD entry already in the library. If an SRD name
  collides with an existing custom entry of the same type, leave that SRD entry out and report
  the collision in the PR body (or the run's output if nothing else is
  generated). Never rename an SRD entry to dodge a collision.

## Step 3: Write entries

Write each request's entries by the procedure its type routes to
([Procedures](../../../docs/generation.md#procedures)). Steps 1, 2, 4, 5,
and 6 are shared: a batch that mixes types runs them once, and step 3 once
per request.

## Procedures

| Procedure | Types |
|---|---|
| [Entries](#procedure-entries) | `background`, `class`, `condition`, `creature`, `equipment`, `feat`, `item`, `species`, `spell`, `subclass` |
| [Characters](#procedure-characters) | `character` |
| [Maps](#procedure-maps) | `map` |
| [Encounters](#procedure-encounters) | `encounter` |
| [Modules](#procedure-modules) | `module` |

Every type in `config/types.json` is in exactly one row. A type in none
can't be generated: ask, as for a type not in the registry (Inputs).

### Procedure: Entries

Write each entry to `content/<ruleset>/<type>/<id>.json`, where `<id>` is the
slug of the name: lowercase, ASCII-folded, apostrophes dropped, other
non-alphanumerics collapsed to `-` ("Hunter's Mark" is `hunters-mark`)
([IDs and names](../../../docs/content-model.md#ids-and-names)). Write the envelope keys in the [Entry envelope](../../../docs/content-model.md#entry-envelope) order: `ruleset`, `source`,
`author`, `type`, `id`, `name`, `summary`, `description`, `stats`, `meta`.

- **Inputs only.** Never write a value the ruleset derives ([Inputs and derived values](../../../docs/rulesets.md#inputs-and-derived-values)). In prose,
  write derived numbers as tokens from `rulesets/<ruleset>/tokens.ts`, never
  as literal numbers ([Text tokens](../../../docs/rulesets.md#text-tokens)). Attack and save lines are generated from
  `stats`, so never write them as prose.
- **Balance by inputs.** Meet the guideline's balance targets by choosing
  inputs (ability scores, hit dice, damage dice), not by overriding results.
- **`adjust` only for a deliberate deviation.** Every `adjust` or damage
  `bonus` needs a reason, recorded for the PR body (step 6).
- **Dependencies.** Include any new entry the brief implies, such as a
  creature's signature spell, in the same batch ([References](../../../docs/content-model.md#references)). Prefer a ref
  `{ "ref": "<type>/<id>" }` to an existing library entry over plain text
  when one matches. Use plain text only for SRD content not in the library,
  as the guideline's dependency section says.
- **Text.** Rules text and `description` use the markdown subset only ([Text fields](../../../docs/content-model.md#text-fields)).
  A mention of a library entry in text is a `{ref:<type>/<id>}` link token
  ([References](../../../docs/content-model.md#references)), wrapped in `*…*` for a spell name; SRD content not in the library is
  plain text. An entry's mention of its own name stays plain text, never a
  link to itself. A mention of a condition, equipment, or glossary term is a
  token too, by [Mentions of rules](../../../docs/content-model.md#references): only where its name matches the text
  exactly, at every mention for conditions and equipment ("the
  {ref:condition/poisoned} condition") and at the first mention in each text
  field for a glossary term ("has {ref:glossary/advantage}").
  No non-SRD proper nouns anywhere ([Blocklist](../../../docs/licensing.md#blocklist)).
- **Situational fields.** Omit an optional field that doesn't apply; never
  write a "none" stand-in such as `0`, `false`, `""`, or `[]` ([Situational fields](../../../docs/content-model.md#situational-fields)).
- Don't add `image`. Art is the Images track's work (#316), not this skill's.

#### SRD entries

For an SRD request, transcribe each entry faithfully from SRD 5.2 ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries))
instead of following the guideline's tone, naming, and balance targets.
Transcribe from `docs/SRD_CC_v5.2.pdf`, not from memory, and check each entry
against it before pushing.

- `name` is the SRD name exactly, and `id` is its slug.
- `stats` reproduce the SRD stat block: choose inputs so every derived value
  the template renders matches the SRD number. Where no input reaches it, set
  `adjust` or a damage `bonus` to match, with the reason "matches SRD".
- Rules text is transcribed from the SRD's text, keeping every rule and
  sentence, with every derived number written as its token ([Text tokens](../../../docs/rulesets.md#text-tokens)),
  which renders the same value. The house style may adapt form, and a print
  cross-reference may become a link, but nothing that changes how the rule
  plays ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).
- Fill every structured field the type defines from the SRD too (an item's
  `charges` and `spells`), and still keep every sentence of the rules text,
  even where it states the same thing ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)). Don't move a paragraph out of
  `effect` into a structured field; the guideline's "don't restate
  structured fields" rule is for custom entries.
- `summary` is one plain, factual line written for the entry, since the SRD
  has none. Omit `description`.
- A stat block the SRD prints inside a spell or item goes in `statBlocks`,
  written as printed, when the SRD has no creature entry of that name ([Spells](../../../docs/rulesets.md#spells)).
  When it does (Animate Dead's Zombie), link the creature from the text with
  `{ref:creature/<id>}` if it's in the library, and leave the name as plain
  text if it isn't.
- Everything the entry uses (spells, gear) is SRD content: a ref if it's in
  the library or the ruleset's rules data, a plain string otherwise. Gear
  names SRD equipment, so it is a ref to it, with a `count` for a plural the
  SRD prints (`{ "ref": "equipment/javelin", "count": 6 }` for "Javelins
  (6)"); a variant such as the Mage's "Wand" stays a plain string ([Creatures](../../../docs/rulesets.md#creatures)). Never create a dependency entry. A
  qualifier the SRD prints after a name goes in the ref's `note`
  (`{ "ref": "spell/fireball", "note": "level 5 version" }`), or stays in the
  plain string (`"Lightning Bolt (level 5 version)"`) ([References](../../../docs/content-model.md#references)).
- A detail the structured fields can't express goes, as printed, in the
  nearest free-text field the schema offers (a creature's `speed.note` for
  "40 ft. (wolf form only)"). Don't work around the template for exact
  punctuation or layout; [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries) "Formatting" lists what isn't matched.
- An inline heading in rules text is bold italic: `***Regaining Charges.***`
  ([Templates](../../../docs/site.md#templates)).
- Set `source` to `"SRD 5.2"` and `author` to `"publisher"` (step 4).

#### Import batches

For an import batch, the import script writes the entries; don't write their
stats by hand. For each issue, in order:

1. Get the file: save the attachment or the URL's file under the session's
   scratch directory, never under `content/`.
2. Run `npm run import -- --issue <n> --format <Format> --file <path>
   --work "<Work>" --author "<Author>" --url <Source URL> --license <License>`,
   adding `--ruleset <Ruleset>` when the issue gives one.
3. **Rejected** (exit code 2): comment the printed reason on the issue,
   remove `in-progress`, and leave it out of the batch. A rejected license is
   final; any other reason (a missing file, a format the issue misnamed) is a
   `needs-info` question instead ([Run order](../../../docs/generation.md#run-order) step 7).
4. **Imported:** keep the printed skip-list section for the PR body. The
   script wrote the entries under `content/`, `meta`, and the work's line in
   `ATTRIBUTION.md`.
5. Rewrite each new entry's drafted `summary` as one plain, factual line for
   the entry, in the type's voice. The script links only names in structured
   fields, so link each mention of a library entry or rule in the entry's
   text by **Text** above. Don't change its `name`, `stats`, or
   `description` otherwise.
6. Read each new entry for SRD proper nouns (a specific person, place, or
   thing named in the SRD), which the script can't detect. Delete an entry
   that uses one, and add a row for it to the issue's skip-list section with
   the reason "It uses an SRD proper noun".

Then validate the batch (step 5). An import entry that fails validation and
can't be fixed without changing what the work says is deleted and added to
its issue's skip list, not rewritten.

Never modify, rename, or move an existing entry. This skill only adds files.

### Procedure: Characters

A character is a preset: one legal build at one level, written as the
choices that make it ([Characters](../../../docs/rulesets.md#characters)).
The ruleset derives everything else, and the consistency checks reject a
build that isn't legal ([Consistency checks](../../../docs/rulesets.md#consistency-checks)).

- **By request only.** Characters have no gap buckets, so a gap bucket
  never names one. An issue or an inline request does.
- **Always custom.** The SRD prints no pregenerated characters, so an SRD
  request for characters can't be fulfilled as written: ask (Inputs). A
  preset is a custom entry, with the request's `author` (step 4).
- **No dependencies.** Every ref names an entry already in the library
  (`site/public/library.json`): the species, background, classes,
  subclasses, feats, class options, spells, and what's equipped. A brief
  that needs an entry the library lacks can't be fulfilled as written: ask,
  suggesting a request for that entry first.

For each character:

1. **Read the build's entries.** Besides the type's schema and guideline
   (step 1), read the species with its traits, the background, each class
   with its features, its `spellcasting`, `multiclass`, `grants`, and
   `training`, each subclass with its features, and each feat it takes,
   from `content/<ruleset>/<type>/<id>.json`. Read
   [Grants](../../../docs/rulesets.md#grants) for what each one gives.
2. **Choose the build.** From the brief, choose the species, the
   background, and the classes in the order taken, each with its `level`
   (20 or less in all, no class twice) and its `subclass` exactly when its
   level reaches the class's first subclass level. With more than one
   class, plan the scores so every class's primary ability is 13 or more.
3. **Buy the scores.** Write the six `base` scores, each 8 to 15, spending
   the 27 points of point buy (`pointBuy` in `rulesets/<ruleset>/tables.json`).
   Place the background's increases as +2/+1 or +1/+1/+1 among its three
   abilities, no score above 20.
4. **Fill what the build gives, exactly.** Each grant is filled to its
   count, from its list, under the `source` that gives it (the guideline's
   "Prose style"):
   - `feats`: the background's origin feat, one per `feat` grant of a trait
     or of a feature at its class level, each of a category the grant
     allows and with its `requires` met; a feat's `note` is the choice it's
     taken with, and its `abilities` the increases it places.
   - `choices`: the starting class's skills, a later class's `multiclass`
     picks, the background's tool and two languages, and each trait's,
     feature's, and feat's skill, Expertise, tool, and language picks. No
     skill twice, the background's included; Expertise only in a proficient
     skill. An entry with a `choice` names its `option` (Elven Lineage's
     "Wood Elf"), and a feature whose feat grant has an `or` names that
     option only when the build takes it in place of the feat.
   - `options`: each class's option lists, to the count its `options`
     grants give at the class's level.
   - `spells`: each casting class's cantrips and prepared spells, to its
     counts at its level, from its lists at a spell level its slots cast;
     each feat's, feature's, and trait's `spells` picks (a chosen option's
     included); and the always-prepared spells the profile should show.
   - `equipped`: armor, a shield, and weapons the classes' training covers,
     and items; at most three attuned, each one that requires attunement.
5. **Write the entry.** Write it to `content/<ruleset>/<type>/<id>.json`
   with its envelope keys in the order the Entries procedure gives, and
   `stats` holding only these inputs. Never write a value the ruleset derives: the
   level, scores, modifiers, saves, skill bonuses, Hit Points, Armor Class,
   attacks, and spellcasting. `summary` and `description` follow the
   guideline. Names follow step 2 and the guideline's "Naming".
6. **Fix by choices.** When `npm run validate` reports a character error
   (step 5), change the build's choices to meet it. Never edit another
   entry to make a build pass.

In the PR's Entries table, a character's summary field is "—": the type has
no `summaryField`.

### Procedure: Maps

A map is a placeholder place with named zones, written together with its
diagram, an SVG the validator checks
([Maps](../../../docs/rulesets.md#maps),
[Map diagrams](../../../docs/content-model.md#map-diagrams)). The diagram is
an original placeholder, not art, so it needs no `ATTRIBUTION.md` credit.

- **By request only.** Maps have no gap buckets, so a gap bucket never names
  one. An issue or an inline request does.
- **Always custom.** The SRD prints no maps, so an SRD request for maps
  can't be fulfilled as written: ask (Inputs). A map is a custom entry, with
  the request's `author` (step 4).
- **No dependencies but a parent.** A map references nothing but its
  parent, by `within`. A child map's parent is a map in the library
  (`site/public/library.json`) or one the same request writes; a brief that
  sets a map inside a place the library lacks, and doesn't ask for that
  place too, can't be fulfilled as written: ask.

For each map, parents before their children:

1. **Lay out the zones.** From the brief and the guideline's "Balance
   targets", choose the `scale` and the zones: a room map a fight's few
   zones, a dungeon map one per room, a town map one per district. Give
   each zone its `name`, what the table calls it, and its `id`, the name's
   slug, unique within the map. Sketch where each sits and which ones
   connect, so every zone is reachable from the way in.
2. **Write the entry.** Write it to `content/<ruleset>/<type>/<id>.json` with
   its envelope keys in the order the Entries procedure gives. `stats`
   holds `scale`, the `zones` in the order the page lists them (the way in
   first, then as a visitor meets them), each with a `note` where the
   guideline's "Prose style" has one to say, and, for a child map, `within`:
   `{ "ref": "map/<parent-id>", "zone": "<zone-id>" }`, naming the parent's
   zone it details. `summary` and `description` follow the guideline. Don't
   add `image`: the diagram's path is derived, never stored.
3. **Draw the diagram.** Write it to `assets/images/<ruleset>/map/<id>.svg`,
   named by the entry's `id` exactly. The file is plain XML, indented two
   spaces, as `tests/fixtures/map/sunken-cistern.svg` is:
   - The root is `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">`,
     with no `width`, `height`, or other attribute. Use whole numbers, a
     width of 300 to 800, and a height no more than the width, so the
     site's 11-unit labels stay legible at the page's width.
   - First a `<title>` holding the map's name, then a `wall` shape for the
     outline: a `<rect>` the size of the `viewBox` for a building, a
     `<polygon>` or `<path>` for a cave or a town's edge.
   - Each zone in `stats.zones` is exactly one element with
     `id="zone-<id>"` and `class="zone"`: a `<g>` holding the zone's shape
     (`<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, or `<path>`) and its
     label, or the shape alone. Zones don't overlap; leave a gap of a few
     units between them for walls. No other element has an id starting
     `zone-`, and no id is on two elements.
   - A zone's label is a `<text class="label">` holding the zone's name at
     its shape's center: `x` is the center, since a label is centered on
     it, and `y` about 4 units below the center, since `y` is its baseline.
     A name too wide for its shape, at about 6 units a character, is split
     into `<tspan>` lines, or the zone is drawn larger.
   - A `door` is a `<line>` across each gap where two zones, or a zone and
     the outside, connect. A `feature` is a small shape for something a
     zone's note names, such as a pillar, a well, or an altar.
   - Only these elements: `<rect>`, `<circle>`, `<ellipse>`, `<line>`,
     `<polyline>`, `<polygon>`, `<path>`, `<text>`, `<tspan>`, `<g>`, and
     `<title>`. An element's class, if it has one, is `zone`, `wall`,
     `door`, `feature`, or `label`. No `style` or color attribute (`fill`,
     `stroke`, and the like), `href`, `url(…)`, event handler, doctype,
     CDATA, or `<style>`: the site colors the diagram by its classes.
4. **Fix by drawing.** When `npm run validate` reports a diagram error
   (step 5), fix the diagram, or the zones it names, to meet it, keeping
   the entry's zones and the diagram's `zone-<id>` ids one to one.

In the PR's Entries table, a map's summary field is "—": the type has no
`summaryField`.

### Procedure: Encounters

An encounter is an arrangement of other entries: its parts, in the order
the page reads, with one roster or spawn table
([Encounters](../../../docs/rulesets.md#encounters)). The ruleset derives
its XP from the creatures and counts; this procedure writes the counts,
dice, and E, never XP
([Encounter difficulty](../../../docs/rulesets.md#encounter-difficulty)).

- **By request only.** Encounters have no gap buckets, so a gap bucket never
  names one. An issue or an inline request does.
- **Always custom.** The SRD prints no encounters, so an SRD request for
  encounters can't be fulfilled as written: ask (Inputs). An encounter is a
  custom entry, with the request's `author` (step 4). The creatures and
  items it uses may be SRD entries.
- **Dependencies before the encounter.** Every creature, item, equipment,
  and map the encounter names is in the library
  (`site/public/library.json`) or written by the same request, before the
  encounter: a creature, item, or equipment by the Entries procedure, by
  its own type's guideline, and a map by the Maps procedure. Prefer an
  existing entry where one fits the brief. A character in the scene is a
  `{ref:character/<id>}` in a part's text, never a roster line, and must be
  in the library: a brief that needs a character the library lacks can't
  be fulfilled as written: ask, suggesting a request for it first.

For each encounter:

1. **Choose the party.** Design for the party the brief names, its size
   and levels. Without one, use four characters at the level the brief
   implies, or at level 1, the calculator's default. Its budgets are each
   character's Low, Moderate, and High XP for their level, summed, from
   `xpBudgetPerCharacter` in `rulesets/<ruleset>/tables.json`.
2. **Pick the creatures.** From the brief, choose the creatures and any
   items, and write the new ones the library lacks (the dependency rule
   above). A library creature's XP is its `derived.xp` facet in
   `site/public/library.json`; a new creature's is the `xp` of its `cr` in
   the rules tables' `challengeRatings` (`xpWithDamage` at CR 0 when it
   deals damage).
3. **Assemble the roster or spawn table.** Exactly one part is either:
   - a **roster**, for a fixed fight: each creature's ref with a whole
     `count` of 1 or more, chosen so the sum of XP times count, times E,
     falls in the band the brief asks for (Moderate if it names none):
     at or under Low reads Low, up to Moderate reads Moderate, up to High
     reads High;
   - or a **spawn table**, for a variable one: one row per difficulty the
     brief asks for (`low`, `moderate`, and `high` if it names none), each
     a roster whose counts may be dice: one kind of d4, d6, d8, d10, d12,
     d20, or d100, with an optional modifier (`"1d4+1"`), the lowest roll at
     least 1. Choose each row's counts so its average XP, times E, reads as the
     row's name for the party, and its lowest and highest rolls stay near
     that band. For a table the DM rolls on, add `roll`, one die
     (`"1d6"`), and give each row a `range` of its faces, covering every
     face once, the lowest row first.
4. **Set E, only when the setting changes the fight.** Add `environment`
   with a `multiplier` other than 1 and a `note` naming what does it
   ("difficult terrain and a collapsing floor"), by the guideline's
   "Balance targets". Leave it out for a neutral setting. Every multiplier
   is a warning for the PR body (step 6).
5. **Write the other parts.** By the guideline's "Prose style", and only
   the parts the brief calls for, in the order the page should read: a
   `description` (player-facing), a `dm-guide` (how to run it), the roster
   or spawn table, a `sequence` (a structured `trigger`, `stages` each with
   its `name`, `loop`, and `transition` but the last, and `victory`; or one
   prose `example`, not both), `loot` (rows keyed by difficulty as the
   spawn table's are, each with `coins`, `items`, or both), a `table` (a
   `title` and one pipe table), `prose`, and a `map` part to show a map on
   the page. Every text is markdown-subset text with `{ref:…}` tokens
   (**Text** in the Entries procedure). Add `show` to a ref object only
   where the page should show it otherwise than its default
   ([Arrangements](../../../docs/content-model.md#arrangements)).
6. **Write the entry.** Write it to `content/<ruleset>/<type>/<id>.json`
   with its envelope keys in the order the Entries procedure gives.
   `stats` holds `parts`, `setIn` when the encounter is set in a map
   (`{ "ref": "map/<id>", "zone": "<zone-id>" }`, the zone optional), and
   `environment` when step 4 set it. `summary` follows the guideline;
   `description` is left out, since the parts hold the text. Never write
   XP, a row's XP, or the creature types: the ruleset derives them.
7. **Fix by choices.** When `npm run validate` reports an encounter error
   (step 5), change the parts' counts, dice, ranges, or refs to meet it.
   Never edit an existing entry to make an encounter pass.

In the PR's Entries table, an encounter's summary field is the party it
was designed for and the difficulty its roster, or each spawn table row,
reads ("4 × level 3: Moderate", or "4 × level 1: Low, Moderate, High"),
since the type has no `summaryField`; review then needs no arithmetic. Its
Warnings list E with its note, the validator's warning for it.

### Procedure: Modules

A module is an arrangement that contains encounters and other modules
([Modules](../../../docs/rulesets.md#modules)). Its steps aren't written
yet, so a request for modules can't be fulfilled as written: ask (Inputs).

## Step 4: Source, author, and meta

An import batch skips this step: the import script sets `source` to the
work's title and `author` to its author, `meta.source.kind` to `"import"`,
with `meta.source.issues` and `meta.source.license`.

Set on every entry in the batch, including dependencies:

- `meta.createdAt`: today's date, `YYYY-MM-DD`.
- `meta.source.kind`: `"routine"`.
- `meta.source.issues`: the issue numbers the entry fulfils, for an issue
  batch, or `[<stage>]` for an SRD import stage. Omit it otherwise.
- `meta.source.gapFill`: the bucket label, for a gap-fill run. Omit it
  otherwise.
- `source` and `author` ([Source and author](../../../docs/content-model.md#source-and-author)),
  right after `ruleset`: `"SRD 5.2"` and `"publisher"` on an SRD entry. On a
  custom entry, the resolved request's `author` and its `source` if it has
  one; omit `source` otherwise. A component takes its parent's.

## Step 5: Validate

Run `npm run validate`. If it reports errors, fix the entries and run it
again, up to `defaults.validateRetries` retries after the first run.

If it still fails:

- Comment the remaining errors on each issue in the batch, remove
  `in-progress` from each, delete the batch's entry files and diagrams, and stop. Don't
  push and don't open a PR.
- For a gap-fill run or an inline request there is no issue: report the
  errors in the run's output and stop.

Once it passes, keep every warning it prints; they go in the PR body.

Then go through the [Self-review](../../../docs/generation.md#self-review)
list, fixing each item that doesn't hold, and tick it in the PR body. If
`npm test` fails on an entry that already follows the content rules, file
the dev issue the list describes and leave that item unticked.

## Step 6: Branch, commit, and open the PR

1. Branch from `main`:
   - issues: `gen/<issue-numbers>-<YYYYMMDD>`, numbers ascending and joined
     by `-` (`gen/12-14-20261102`);
   - import issues: `gen/import-<issue-numbers>-<YYYYMMDD>`
     (`gen/import-31-20261102`);
   - gap fill: `gen/gap-<type>-<YYYYMMDD>` (`gen/gap-spell-20261102`);
   - inline request: `gen/inline-<type>-<YYYYMMDD>`;
   - SRD import stage: `gen/srd-<stage>-<type>-<YYYYMMDD>`, adding `-2`,
     `-3` for more PRs the same day.
2. Stage only the new files under `content/`, each map's diagram under
   `assets/images/`, and for an import batch, `ATTRIBUTION.md`. A content PR that changes anything else fails the `lane`
   check ([Lane rules](../../../docs/workflow.md#lane-rules)).
3. Commit with the message `Add <n> <type> entries` (a mixed-type batch:
   `Add <n> entries`), where `<n>` counts every new entry, dependencies
   included.
4. Push the branch and open a PR to `main` with the commit message as its
   title. Fill in `.github/PULL_REQUEST_TEMPLATE/content.md` and delete its
   comments:
   - **Entries:** one row per entry: name, type, the value at the type's
     `summaryField` (CR, rarity, or spell level), and the summary.
   - **Warnings:** every validator warning, and every `adjust` or damage
     `bonus` with its reason. "None" if there are none.
   - **Self-review:** each item ticked, or the dev issue named under an
     unticked one.
   - **Gap fill:** the bucket label, for a gap-fill run. Delete the section
     otherwise.
   - **Skipped on import:** for an import batch, each issue's skip-list
     section, in issue order. Delete the section otherwise.
   - One `Closes #<n>` line per fulfilled issue. Delete the line for a
     gap-fill or inline run. An SRD import stage uses `Refs #<stage>`,
     except the PR that finishes the stage, which uses `Closes #<stage>`.

The `content` label is applied from the branch prefix ([Lane rules](../../../docs/workflow.md#lane-rules)); don't add
labels to the PR. Leave `in-progress` on the issues: an open linked PR is
what keeps the claim alive ([Run order](../../../docs/generation.md#run-order) step 8), and merging closes them.

Review comments on the PR are handled by the `revise` skill on a later run,
not here.
