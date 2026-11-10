# Design decisions

A record of what each version decided and why. The v1 section is distilled
from `SPEC.md` at the `v1.0.0` tag, the milestone issues and their comments,
the decision comments those issues link to, and the dev PR descriptions. From
v2 on, the PR that makes a decision adds its row (`AGENTS.md` "Rules").

**This is history, not a set of rules.** The decision rows describe what a
version did. Later versions may change any of them (the themes, the look, the
gallery, the type formats) without arguing against this file. The principles
are what carries forward: they are the reasons v1 chose as it did, and they
remain the guide for weighing new designs. What the library does now is in the
current docs and code.

Each row states what was decided. The reason is kept high level: usually one of
the principles below, otherwise a short note. **Source** names the PRs and
issues where the decision was made or last changed; read them for the full
argument. Exact rules lived in the schemas, `tables.json`, `derive.ts`, the
guidelines, and the skills. Only the final state of a decision is recorded; a
reversal is noted only when it explains the reason.

## Principles

| | Principle | Meaning |
|---|---|---|
| P1 | Files are the database | One JSON file per entry, in the repo, reviewed as an ordinary diff. Static build and GitHub Actions; no runtime services. |
| P2 | Fail closed | Rules data is strict. An unknown or malformed value fails CI instead of being skipped, because a silent skip loses an entry with no signal. Organization (tags) stays open. |
| P3 | One source per fact | Each value, rule, or decision is held in one place. Derived values are computed, never stored. Shared logic is one helper used by every consumer. Copies drift. |
| P4 | Configuration over code | A new type, page size, exporter, theme, or filter is a data or file addition, not a code change. |
| P5 | SRD fidelity, custom originality | SRD entries keep SRD 5.2's rules and meaning; the site's house style may adapt their form (#273). Custom entries borrow no SRD entry name and no non-SRD intellectual property. |
| P6 | Templates own presentation | Entries hold content; templates hold wording, order, and typography. One streamlined rule beats per-entry formatting. The data models the gameplay meaning, not every printed variation. |
| P7 | Humans request, review, merge | Routines do the writing. Review needs no arithmetic. Merging to `main` is the only step that publishes. |
| P8 | Enforced, not by convention | Lanes, text rules, and accessibility are checked by CI. Every content change made by code is visible. |
| P9 | Shareable later | A private tool now, but licensing, attribution, stable URLs, and an original look are right from day one. |
| P10 | Cheap, safe refinement | The UI is tuned through tokens and a style guide, with WCAG 2.2 AA checked automatically. |
| P11 | Weight follows the selection | Pages load a lean index; full data is fetched only for what the reader picks. |
| P12 | A durable record | Sessions have no memory, so decisions live in the repo, issues, and PRs, and every merge leaves `main` consistent. |

## v1

The library as built at the `v1.0.0` tag.

### Scope

| Decision | Why | Source |
|---|---|---|
| A library of D&D 5e content on SRD 5.2, ruleset `dnd-5e-2024`, with types `creature`, `magic-item`, and `spell`. | P9: the SRD is CC-BY-4.0 | #1 |
| The library holds SRD entries and custom entries. | The full SRD proofs the schemas and UI against everything they must hold | #77, #128 |
| Public repo and Pages site on the free plan, not promoted. | P9 | #1 |
| No backend, database, accounts, user submissions, or in-browser editing. Every change is a PR. | P1, P7 | #1 |
| v1 is a prototype; v2 a complete product for one user; v3 and later explore multiple users and a public site. | | #95 |

### Entry model

| Decision | Why | Source |
|---|---|---|
| One file per entry at `content/<ruleset>/<type>/<id>.json`; the path must match the entry. | P1 | #1 |
| A fixed envelope: `ruleset`, `type`, `id`, `name`, `summary`, `stats`, `meta`, and optional `description`, `tags`, `image`. Unknown top-level keys fail. | P2 | #1, #21 |
| Three zones: `stats` strictly validated, `tags` open and flat, `meta` for provenance. | P2: lists of actions flatten into meaningless filter paths, and open rules data lets typos pass | #1 |
| An unknown ruleset or type fails CI (the field is `ruleset`, not `version`). | P2 | #1 |
| The ID is the slug of the name at creation and never changes; a rename keeps it. A collision gets a new name, never a numeric suffix. | P9: stable URLs; sequential IDs collide across parallel branches | #1 |
| IDs and names are unique within a type, not across the library. Everything that identifies an entry carries its type (`<type>/<id>`). | Different types are different things: the Giant Insect spell and a Giant Insect creature | #146 |
| Near-duplicate names within a type warn, except between two SRD entries. | Catches "Frost Lance" vs "Frost Lances"; SRD names can't change | #119, #146 |
| Tags are a flat map, and every key is filterable with no configuration. Filtering ignores case; display keeps it. | P4 | #1 |
| `meta` records dates, the source kind (`routine`, `revise`, `manual`), fulfilled issues, the gap bucket, and the SRD flag. It is shown and sortable, but isn't a tag. | P7: traceability | #1, #77 |
| Text fields take a markdown subset: paragraphs, bold, italic, lists, line breaks, pipe tables. No headings, links, HTML, or images. | P8 | #1, #39 |
| The markdown check lexes with the same parser the site renders with, and finds its fields through a schema keyword (`markdownSubset`). | P3: a new `Text` field gets the check with no code change | #39 |
| Pipe tables sit inline in any text field, SRD or custom. A bold-only paragraph directly above a table is its title, rendered as a caption, in plain text only. Malformed tables fail. | SRD text keeps its order; P6 | #145, #182 |
| Links carry no display text. A ref object (`{ ref, note? }`) sits at `RefOrText` fields, and a `{ref:<type>/<id>}` token works in any text field. Both render the target's current name. | P3: a rename updates every link | #35, #146, #147 |
| A plain string names SRD content not in the library; once the entry is in, it's a ref. | | #35, #77 |
| Every ref must resolve, within the same ruleset. Deleting a referenced entry fails. Back-references are computed, and the ruleset names each relation ("Casts" / "Cast by"). | P2, P3 | #35 |
| Required fields always display. Optional fields display only when present, and omission is the only way to say "doesn't apply": schemas reject `0`, `false`, and empty stand-ins. Templates decide from presence alone, through one helper. | P3: presence and applicability can't disagree | #40, #41 |
| A DC displays only when there is one: an authored DC is omitted, and a derived DC is switched off by a flag. | One rule for every type | #183 |
| Art is an optional repo-relative `image`. With no art there is no container or placeholder. | | #1, #100 |

### Rulesets and derived values

| Decision | Why | Source |
|---|---|---|
| Everything ruleset-specific is one folder meeting one module contract: schemas, tables, derivations, tokens, checks, ref labels, guidelines, SRD manifest. | P4: adding a ruleset is adding a folder | #1, #21 |
| Entries store only authored inputs. The ruleset computes XP, PB, HP, modifiers, saves, skills, passive Perception, attack bonuses, DCs, and damage averages at build time. | P3: no mismatches, no arithmetic in generation, one place per rule | #1 |
| A deliberate deviation is an explicit non-zero `adjust` or damage `bonus`, and each one is listed as a warning. | P7: the reviewer confirms it | #1 |
| Numbers the rules leave to the author (AC, spell dice, an item's DC) stay stored. | | #1 |
| Creature prose shows derived numbers only through tokens. A literal number that looks derived fails; `{dc=<n>}` marks an authored DC. Spell and item text is exempt, since its numbers are authored. | P3 | #21, #99 |
| Display forms such as the U+2212 minus are display only; data and exports keep plain numbers and ASCII formulas. | Exports carry the data | #94 |

### SRD and custom entries

| Decision | Why | Source |
|---|---|---|
| An SRD entry reproduces the SRD unmodified: exact name, every rendered number, text word for word, with derived numbers as tokens. | P5 | #77 |
| SRD text is transcribed from the reference PDF in the repo, never from memory. | | #106, #135 |
| An SRD entry fills every structured field and keeps every sentence, even where they repeat each other. The no-restating rule is for custom entries only. | An SRD entry needs both the data and the verbatim rule | #125 |
| Where derivation can't reach an SRD number, `adjust` matches it ("matches SRD"). A number that contradicts the entry's own stats is a misprint: the derived value stays, and the misprint is recorded. | P5, P3 | #77, #183, #171 |
| Ruleset warnings are skipped on SRD entries; errors still apply. | SRD content is literal | #99 |
| Templates own an SRD entry's typography. A printed detail the fields can't hold goes in the nearest free-text field, and a new field is added only for a detail that recurs with a fixed shape. Template-owned differences from the PDF are listed, not worked around. | P6 | #147, #183, #171 |
| An SRD entry gets an authored one-line `summary` and no `description`. | The SRD has neither | #77 |
| SRD entries are flagged in `meta`, added only by an SRD request or an import stage, never by gap fill. A revision only brings one closer to the SRD; a variant is a new custom entry. | P5 | #77, #137 |
| A custom entry uses no SRD entry's exact name, no SRD proper noun, and no duplicate SRD concept. It may build on common SRD words ("Fire Zombie"). | P5 | #77, #146 |
| A blocklist of non-SRD proper nouns applies to every text field, matching case, diacritic, plural, possessive, and joined-word variants. A false positive is fixed by editing the list in a PR. | P5, P9; the decision stays visible in history | #39 |
| A checked-in SRD manifest, tiered `complex` or `simple`, and a coverage script define when the import is complete. | A measurable finish line | #128, #137 |
| SRD import stages bypass routines: sub-issues worked in owner-started sessions with the `srd-import` skill wrapping `generate` and `revise`. A format-fix PR may add the SRD entries that motivated it. | The fix is shown working on real entries | #129, #137, #145, #177 |

### Type formats

All three types render in SRD 5.2 form (P6). The fields below were added during
the SRD import to hold printed forms, following the nearest-field rule.

| Decision | Why | Source |
|---|---|---|
| Creature attack and save lines are generated from structured fields, never written as prose. | P3, P6 | #1, #21 |
| Creature display follows fixed rules whatever the JSON order: speed and sense order, a semicolon before Passive Perception, title case with minor words lowercase, damage-sentence continuation, one line per spell list, the legendary uses line first, Spellcasting after other actions. | P6 | #94, #147, #183 |
| Creature languages are `spoken` and `understood` lists of free-text items, plus telepathy and a note. | Model speaking versus understanding, not every combination | #96 |
| Creature forms: conditional damage riders, attack notes, flat and untyped damage, swarms, speed, sense, and condition qualifiers, skill `adjust`, `shortName`, `noComponents`, `noSaveDc`, `onFailureOrSuccess`, optional `actions`, and the SRD's recharge values and wording. | SRD import | #99, #147, #152, #168, #183 |
| Magic-item forms: charges as an integer or dice with optional recharge, variable charge costs, and per-variant rarities that keep `rarity: varies` for the gallery. | SRD import | #124, #165, #186 |
| Spell forms: `castingTime.trigger` as `Text` on reactions and bonus actions, a casting-time note, ranges in miles, until-dispelled-or-triggered and "Up to" durations. Material text is exactly as printed; cost and consumption are data only. | SRD import; P6 | #123, #160 |
| The spell level line reads as SRD 5.2 does ("Level 3 Abjuration", "Evocation Cantrip"), on cards and in the gallery alike. | P5; replaces an earlier "1st-level" choice | #122, #147 |
| A stat block printed only inside a spell or item is embedded (`statBlocks`): authored as printed, with only modifiers and saves derived, and not an entry. One that is its own SRD creature is linked instead. | Its numbers scale with the spell or caster | #146 |
| Every inline heading prints bold italic, both template labels and headings written in text. | SRD 5.2 typography | #152 |

### Validation

| Decision | Why | Source |
|---|---|---|
| Schemas are plain JSON Schema (draft 2020-12), validated with Ajv. | P1 | #1 |
| Errors fail CI; warnings appear in local output and the job summary but don't block. | | #1 |
| Checks that apply to every type: path, uniqueness, refs, markdown subset, blocklist, placeholder text, image path and size. Type checks cover cross-field rules a schema can't express. | P8 | #30, #39, #191 |
| Balance isn't enforced by CI. It is judged in review against guideline targets, and the PR summary shows the derived numbers. | P7 | #1 |

### Registry and gallery

| Decision | Why | Source |
|---|---|---|
| `config/types.json` holds display and generation defaults only. Validation reads it only to confirm a type is registered, and it doesn't decide display. | P3, P4 | #1, #40 |
| Only curated `stats` and derived paths become facets; every tag is filterable. | Nested rules data makes poor filters; tags are made for it | #1 |
| Ordered enums declare their order. Value formats (`cr`, `spell-level`, `rarity`, `title`) are opt-in, so tags and free text display as stored. | | #43, #121 |
| The index builder writes a lean, deterministic `library.json` plus a raw copy and an export bundle per entry, and never computes a rules value itself. | P3, P11 | #43, #58 |
| The gallery is one client-side island over `library.json`, filtered in memory, with a no-JavaScript list fallback. It's sized for a few thousand entries. | P1, P11 | #47 |
| Values in a filter combine with OR, filters with AND; an entry missing a value never matches. | | #47 |
| Query, sort, and filters live in the URL in one canonical form. Selection stays in the page. | Any view can be bookmarked or shared | #47 |
| Cross-type galleries sort by name, type galleries by the registry default, and ties always break to a unique order. | Order never depends on file order | #101 |
| Every data fetch revalidates with the server, through one helper. | A deploy shows on the next load | #89 |
| Navigation is built from the registry. The SRD statement is in every page footer. | P4, P9 | #48 |

### Templates and styling

| Decision | Why | Source |
|---|---|---|
| One template per type plus a generic fallback. The same component renders on screen, in PNG capture, and in print, through a `mode` prop. | P3 | #1, #48 |
| Templates are built from small parts with one job each, over semantic markup. | P10 | #48 |
| Templates never compute rules values. Tokens render first, then markdown, through one sanitizing helper; fields that aren't `Text` are escaped. | P3 | #48, #90 |
| Plain CSS: custom properties, cascade layers, nesting, container queries. No framework, preprocessor, or CSS-in-JS. | P1 | #1, #45 |
| Design values live only in layered token files; a literal value anywhere else fails Stylelint. | P10 | #45 |
| Type and rarity accents come from data attributes, not per-type CSS. | P4 | #45, #47 |
| System, Light, and Dark themes. Print and PNG capture always use light. | | #45 |
| The look is a clean reference book, original, with no official art or ornaments. Alegreya fonts and Lucide icons, self-hosted. | P9; self-hosted fonts keep PNG captures faithful | #1, #45 |
| A style guide page, stress-case fixtures, and on-demand snapshots support refinement. Snapshots are not a CI gate. | P10: a deliberate design change never fights a failing snapshot | #45, #49 |
| WCAG 2.2 AA: token contrast tests, axe on built pages in both themes, color never the only signal, motion off under reduced motion. | P8, P10 | #45, #48 |
| Tables have one site-wide style and scroll inside their own box; the page never scrolls sideways. | WCAG reflow | #145 |

### Export

| Decision | Why | Source |
|---|---|---|
| Exporters are modules listed in `config/export.json`, each offering entry scope, set scope, or both. | P4: a format translator is one more module | #1, #54 |
| Every exporter receives `{ entry, derived }`. Gallery set actions fetch per-entry export bundles to build them. | One interface for both scopes; translators need full items | #52, #58 |
| JSON is the native format: the raw entry, inputs only. | P1 | #1, #54 |
| PNG is a DOM capture of the template, from an inert capture source, in light theme, with a short attribution footer. | Discord and VTTs | #1, #55 |
| PDF is the browser's print of print CSS, not an image. The print view fetches per-entry print fragments. | Vector text and multi-page stat blocks; P11 | #1, #51, #56 |
| Page sizes are Letter (default), A4, Half-Letter, and 4×6, configured as data. | P4 | #1 |
| Every printed page carries the short attribution and the entry name; the full statement prints after the last entry. Print has no art. | The full statement doesn't fit a 4×6 margin | #56 |
| A failed export does nothing and says so in a status region. | | #54, #58 |

### Generation and revision

| Decision | Why | Source |
|---|---|---|
| GitHub Issues are the request queue, through content-request and revise-request forms. `config/defaults.json` fills what a request leaves out. | P7 | #1, #66, #67 |
| Routines follow a run order read from `docs/routines.md` on `main`: revisions, then revise requests, then content requests, then gap fill. | Review feedback is never starved; a run-order change is a reviewed PR | #70, #76 |
| `in-progress` claims an issue and `needs-info` parks a question; a claim is stale after 24 hours. | | #1, #76 |
| No batch size limit; a request's count is taken on trust. | Owner's call; replaces an earlier cap | #161 |
| The `generate` and `revise` skills are generic across types and rulesets. Tests check every path and script they name. | P3, P4 | #69, #74 |
| Revision is driven by PR comments (free text, `drop`, `regenerate`). Replies carry a handled marker, and the run-order sweep guarantees each comment is handled. | Most feedback is "adjust this"; routines post under the owner's identity | #1, #74 |
| Each type has a guideline with fixed sections, written for custom entries. Its balance targets are met by choosing inputs. | P3 | #68 |
| Gap buckets are a list of axes (numeric bins or listed values), labeled as gallery queries. A script picks the bucket, with fixed tie-breaks. | Scheduled runs need direction without a human | #57, #75 |
| Guidelines, skills, defaults, and routine prompts are development, not content. | They change every future run | #1 |

### Repository, lanes, and CI

| Decision | Why | Source |
|---|---|---|
| One repo, two lanes, kept apart by branch prefix, labels, templates, and a CI lane check. | A schema change and its migration land together; P8 | #1, #18 |
| Content lane: `gen/`, `revise/`, `manual/`, touching only content and art. Dev lane: every other branch, unprefixed included. `spike/` branches fail. | A web-editor edit needs no rename; spikes can't merge | #18, #26 |
| A dev PR that changes content gets the `migration` label automatically, and the lane check waits for it. | P8 | #161, #185 |
| `validate` is the single required status check, aggregating the lane's jobs. | Branch protection never depends on which jobs a lane runs | #18 |
| Content PRs run validate and build; dev PRs add types, tests, and a11y; docs-only PRs run only the lane rules. | Fast feedback where code can't change | #18, #136 |
| No required approval: merging is the approval. | Routines open PRs under the owner's identity, and GitHub blocks self-approval | #1 |
| Squash merge with the PR title as the message, so `main` reads as one line per change in two visible streams. | | #1 |
| The labeler runs on `pull_request_target` and never runs PR code. | Security | #18 |
| CI uses the latest Node 22 patch; cloud sessions install with `npm ci`. | Reproducible installs | #17, #44 |
| Code is MIT; content is CC-BY-4.0. The SRD statement appears in `ATTRIBUTION.md`, the footer, `/about/`, and print. | P9 | #1, #45, #56 |

### Working process

| Decision | Why | Source |
|---|---|---|
| Don't invent behavior: a gap in the spec is settled with the owner, and written down, before code depends on it. | P12 | #2 |
| One issue per PR. A multi-item issue is one PR with one commit per item; small related issues are bundled. | The owner merges once | #91, #126 |
| Milestones are tracking issues whose ordered sub-issues form one dev queue. A new issue is placed before the first issue that depends on it. GitHub milestones aren't used. | Sessions can't manage GitHub milestones, which have no order | #2, #32, #95 |
| Checks that need a human or a live service aren't milestone criteria; they go in the Testing backlog. | A pending manual check never blocks work | #38 |
| No triage routine: the session that files an issue places it. | | #95 |
| `SPEC.md` becomes reference docs for what's built plus a stage spec for what isn't; citations use file and heading; docs defer to code for exact rules. In progress under #108. | P3, P12: a routine must not act on unbuilt design | #95, #108 |
| v2 starts with a design-only phase, one owner-led session per area. | Unknowns are worked out before they meet the dev rules | #95, #110 |

## v2

### Working process

| Decision | Why | Source |
|---|---|---|
| Docs-as-code with a light subset of common practice: reference and explanation docs only, one decision record per version instead of numbered ADRs, the stage spec as the design-doc step, and field meanings in schema `description`s. No arc42, C4, docs site generator, or wiki. | Complete and agent-readable without overkill; P3 | #196 |
| `docs/README.md` indexes the docs. Topic files are flat, one per subsystem, with the same four sections, and are cited by heading. | An agent finds one focused file and reads it; P3 | #196 |
| The stage spec is a folder, `spec/v2/`, with one file per design area, kept outside `docs/` so routines never read it. | Built parts are easy to delete, and the stage ends when the folder is empty | #197 |
| No status table: design, build, and built status come from the design issues, the build milestone issues, and the file tree. Front matter holds only an area's issue and dependencies. | P3: a table would copy state GitHub already holds | #197 |
| Every area file follows one template (Goal, Current, Design, Cases, Migration, Done when, Open questions, Out of scope), with only Goal and Design required. A test checks the front matter, the sections, and that the entries cited under Cases are real. | Seven sessions write seven files of the same shape; designs are checked against the real library; P8 | #197 |
| A gap found while building is decided by the session and recorded in the PR if a different choice wouldn't change behavior other work depends on. Otherwise it stops and goes to the owner, as an open question for v2 design. | v1 handled gaps inconsistently, sometimes stopping and sometimes guessing | #197 |
| A PR that makes a decision lists it under "Decisions" and adds its row here. | v1's decisions were spread across comments, interviews, PRs, and spec edits; P12 | #197 |
| Each build milestone starts with a pilot on its hardest cases, and an approved design can be amended by a small spec PR at any time. | v1's pilot, fix, bulk sequence turned discoveries into planned work | #197 |
| `SPEC.md` is retired into the topic docs, schema descriptions, `AGENTS.md`, and `spec/v2/`. Its v1-only parts (non-goals, changes from the preliminary design, the delivery plan, the example entries as prose) aren't carried over; the `v1.0.0` tag keeps them, and the example entries live on as test fixtures. | P3: one home per fact; the stage spec holds only unbuilt design | #95, #108 |
| A link check runs in the `lane` job, so docs-only PRs get it, and in `npm run check`. It fails on a cited file or heading that doesn't exist, a broken relative Markdown link, and any section-number citation. | A renamed heading is most likely in a docs-only PR; P8 | #108 |
| Markdown files cite docs with relative links titled by the heading; code cites `docs/<file>.md#<heading>` as plain text. | Readable in both places, and both forms are checked | #108 |
| v1's allowance for a format-fix PR to add the SRD entries that motivated it isn't carried over: it was scoped to the SRD import milestone, which is done. | | #108 |
| Gap fill is off until v2 is built; routines take `request` issues only. | Entries made in the v1 shape would only add to v2's schema migrations | #95, #109 |
| Text-only PRs (docs plus Markdown only tests read: the stage spec, skills, and guidelines) skip validate, build, and the type and style checks, and run the tests. `dev-checks` runs alongside `content-checks`. | Fast feedback where the build can't change | #212 |
| The SRD import's PDF extraction is a committed Python module, `scripts/srd-extract/`, which stage converters import; the converters stay in scratch. CI only compiles it. | Four stages rebuilt the same extraction and rediscovered its edge cases; pdfplumber has no TypeScript equivalent, and CI never reads the PDF | #234 |

### Linking

| Decision | Why | Source |
|---|---|---|
| v1's ref standard carries into v2 unchanged: ref objects at `RefOrText` fields and `{ref:…}` tokens in text, keyed by `<type>/<id>`, with relations typed by field, labels in the ruleset's `refs.ts`, and back-references computed. Existing entries need no migration. | It works in practice and already covers what new types need; P3 | #111 |
| A new type links through `RefOrText` fields it declares, with a label pair in `refs.ts` for a relation that needs its own wording, rather than a new link mechanism. Each type's fields and labels are set in the type extension design. | P4: a new link is a schema and label addition | #111, #112 |
| Linking is part of authoring: an entry links every library entry it mentions or uses, and a link pass links mentions written before their target existed. | Already the `generate` and `srd-import` rules; the owner confirmed them as the standard | #111 |
| An area with no build of its own (`linking.md`) is deleted part by part, each by the first build PR that exercises it. | Keeps the stage spec's "emptied by building it" rule | #111, #214 |
| Ruleset primitives (SRD conditions, equipment items and groups, glossary terms) and hidden components are link targets with `<type>/<id>` keys, rendered as links to their anchors. An extension shares its type's keys. | One link form whatever the target; P3 | #111, #112 |

### Types

| Decision | Why | Source |
|---|---|---|
| v2 covers every SRD 5.2 component: glossary terms, conditions, equipment, feats, backgrounds, species, classes, and subclasses, alongside spells, items, and creatures. | Ruleset completeness: user content builds on the full SRD | #112 |
| The ruleset splits into rules (glossary terms, conditions, equipment) and content (everything else). | Separates the ruleset's definitions from the authorable library | #112 |
| Ruleset primitives are ruleset data shown as one combined page per rules type, with an anchor per primitive. Ruleset extensions are authored entries shown as cards, listed on an Extensions page beside the rules pages and at the bottom of each rules page. | The line falls between the basis and the custom additions, and applies to every rules type | #112 |
| In v2, only conditions and equipment take extensions. Glossary terms aren't authorable, and abilities, damage types, skills, creature types, and sizes stay closed lists. | Covers the simple house rules; P2 for the rest | #112 |
| v2 extension only adds. Modifying or replacing a rule, or adding a mechanic, waits for v3's house rules system. | Additive extensions are simple; rule changes need their own design | #112 |
| Equipment is one rules type with categories and nested sub-classifications, each group a linkable section. | Matches the SRD's grouping, and lets a base item name a group | #112 |
| Content types are cards (spells, items, creatures, feats, backgrounds) or pages (classes, subclasses, species). A page type is assembled from components: hidden, linked sub-entries viewed only through the parent's page. | A hierarchy by complexity; v3's encounters and dungeons extend it | #112 |
| `magic-item` is renamed `item`, through a migration that keeps every `id` and redirects the old URLs. | Magic items are items built on equipment; P9 | #112 |
| A ruleset primitive is one file under `rulesets/<ruleset>/rules/<type>/` holding `type`, `id`, `name`, and `stats`, validated like an entry. An extension's `stats` use the same schema, and keys and names are unique across a type's primitives, groups, and extensions. | P1, P3: one schema per type; P2 | #222 |
| Primitives and equipment groups are in the SRD manifest, so coverage proves the rules data complete. | P2 | #222 |
| Weapon properties and mastery properties are primitive-only rules types with keys of their own. | The Ammunition property and the Ammunition gear would collide in one key space | #222 |
| Rules pages are listed in `rules/pages.json`, with SRD chapter prose that isn't a primitive kept as page sections. The rest of the Equipment chapter (coins, lifestyle, food and lodging, hirelings, spellcasting services, using magic items, crafting) is an Equipment rules page, not primitives or glossary terms. | P4, P5: the whole chapter is in the library without inventing types for tables | #222 |
| Conditions are stored once, as condition primitives; the Glossary page lists each at its alphabetical place as a link to the Conditions page. | P3 | #222 |
| Equipment groups are a closed, ordered list in the ruleset; a primitive names its leaf group, and its category is derived from it. Melee Weapons and Ranged Weapons are union groups. | P3; Simple/Martial and Melee/Ranged cross | #222 |
| Equipment that comes in forms sharing one description is one primitive with `variants`; a variant isn't a link target. | Variants carry only cost and weight, and only a few mentions name one | #222 |
| A base item is structured links (`any` with optional `except`, or `oneOf`) worded by the template, using each group's qualifier. | P3, P6, and it reproduces every SRD base item word for word | #222 |
| A field that links to one rules type takes a typed ref whose key pattern allows only that type. | P2: a wrong-type link fails the schema | #222 |
| A condition's opening sentence is worded by the template from its name; only its titled effects are stored. | P6: all 15 SRD conditions share the sentence | #222 |
| Creature gear refs may target equipment and carry a `count`, printed as a plural with an added "s". | P5: "Javelins (6)" reads as printed | #222 |
| A mention links only where the target's name reproduces the text exactly. Conditions and equipment link at every mention; a glossary term at its first mention in each text field. | P5; readable rules text | #222 |
| Gap fill never adds a rules extension, so condition and equipment have no gap buckets. | Custom rules are deliberate additions, made by request | #222 |
| A renamed type lists its earlier keys under `formerly` in the registry. The site builds redirect pages for the old gallery and detail URLs (keeping the query and fragment), and print and gallery queries read an old key as the current one. Entries and refs use only current keys. | P4, P9: one registry key covers every old URL | #223 |
| The `item` type's display names are "Item" and "Items". | Match the key; items are still the SRD's magic items | #223 |
| The decision record keeps `magic-item` in rows that describe what was decided under that name. | It is history, not a description of the current library | #223 |
| Groups are a generic rules-data mechanism: any rules type may have `rules/<type>-groups.json`, and its members name a leaf group in `stats.group`. A union group may have a parent, which places it in that tree. | P4: equipment is the first user, not the only shape | #224 |
| `rules/pages.json` blocks are prose, a type's primitives, or a group's tree; a type with groups is shown only through group blocks. Every primitive and group appears on exactly one page. | P2: a primitive with no page would have a link with nowhere to land | #224 |
| A rules page's anchors are `<type>-<id>`. The Extensions page is `/<ruleset>/rules/extensions/`, so `extensions` is not a page id. | Anchors of two types on one page can't collide | #224 |
| Every registered ruleset's rules data is validated, whether or not an entry uses it. | P2 | #224 |
| A primitive's section renders its `stats` with the generic template's lines until its type gets a template; the generic lines render refs as links, for entries too. | P4: a new rules type renders with no code | #224 |
| The validator and index build take a rulesets root and a registry, so tests run a fixture ruleset. | Rules data is proven before any real rules type exists | #224 |
| Extension lists filter with a plain search box; rules pages join the header with the navigation task. | The layout and navigation are the UI's (#236, #237) | #224 |
| A condition card shows its summary like other cards; its effect names aren't a card field. | Showing them would need a facet of effect names, which filters nothing useful | #225 |
| A rules extension type has no `summaryField` and no `gapBuckets`; its registry entry sorts by name. | It has no key stat, and gap fill never adds one | #225 |
| The condition-immunity facet waits for the filter tree, and SRD coverage of primitives for a later rules task. | Each needs machinery the conditions don't (a facet over refs; tierless manifest records) | #225 |
| Contagion's Poisoned mentions are linked with the conditions, as the spec's case; the link pass links every other mention. | Proves the case without starting the pass early (#228) | #225 |
| Rules data links only to rules data: a primitive's, group's, or page's link to an entry is an error, and page links must resolve. Mounts don't link their creatures, and the Equipment page names Identify and the rings in plain text. | The ruleset is the basis; linking down into the library would make every library depend on certain entries existing | #226 |
| A ruleset module's `derive` and `check` receive the ruleset's rules data. | Equipment's category comes from its group, and base items are checked against the groups and variants | #226 |
| Groups take a category `noun` and `sortBy` paths; armor prints by AC then cost through `sortBy`. A page's opening prose may have no title. | P4: the base item wording and the SRD's armor order are data, not code | #226 |
| The Spell Scroll and the Saddle are equipment with variants, like the foci; a variants table heads its first column "Variant". | Each shares one description across priced forms; the SRD's own column names vary by table | #226 |
| The Equipment page links the five category pages in a "Categories" section, and keeps the SRD's "Spellcasting" heading. The large-vehicle notes are the vehicles group's text, with run-in heads. | The page needs a way to the categories; group text has no headings | #226 |
| Equipment text and rules prose link each exact mention of a condition or equipment as they're transcribed; plurals and names inside a longer capitalized phrase stay plain, and "Ammunition" stays plain because it names the property. | Linking is part of authoring (#111) | #226 |
| Custom equipment filters by category, group, cost, and weapon damage type, sorts by cost, and has no gap buckets. Filters on weapon properties and mastery wait for the filter tree. | Those facets are lists of refs, which need the tree's ref labels (#235) | #226 |
| A base item renders as linked segments in the item card's subtitle. | A link's text is a group's qualifier, which a `{ref:…}` token can't render | #226 |
| Glossary terms are the primitive-only rules type `glossary`, keys `glossary/<id>`: a term's name without its bracketed tag, the tag as a field, and its definition as one `text`, with the "See also" sentence as printed. The Glossary is the first rules page. | P3, P5: the tag is data, and the text reads word for word | #227 |
| A primitives block may cross-list other rules types: their primitives sit among its own by name as "Name [Type]", linked to their own page, without being placed there. The Glossary cross-lists the conditions. | P3: a condition is stored once; P4: the cross-listing is data | #227 |
| A primitive whose stats are only `text` and an optional `tag` renders as paragraphs, its tag in brackets after its name. | P4: the glossary needs no template | #227 |
| The glossary's run-in lists (the actions, areas of effect, conditions, and creature types), printed in columns, are bulleted lists in alphabetical order; its two-up tables (Object Armor Class, Water and Food Needs per Day) are single tables in reading order; the abbreviations are a list of bold abbreviations with their meanings. | The markdown subset has no columns, and the abbreviations have no printed header row | #227 |
| Glossary text is plain; its mentions of other terms, conditions, and equipment become links in the link pass. | One pass applies the link rule to every rules text (#228) | #227 |
| A gear ref's `count` lives in a shared `CountedRefOrText`, and the Gear line is markdown with each ref a link and a count as "{ref}s (n)". | The search index finds plain-text gear by the `RefOrText` family; the plural is the spec's "s" rule | #262 |
| The link pass leaves plain: sentence- and cell-initial capitals, names inside a longer capitalized name, table and column names, chapter-section cross-references, a creature's own action names, "Acid" (the damage type), and "Ammunition" (the property). A bulleted line that is exactly a name, and a quoted "See also" name, link. | Exact text alone over-links words that only look like rule names; P5 | #262 |
| The SRD manifest lists the rules data in a `rules` list: each primitive by rules type and exact name, transcribed from the PDF, and each group with `"group": true`, without tiers. `srd-coverage` reports them after the entries; `--tier` leaves them out. | P2: coverage proves the rules data complete, as it does the entries | #215 |
| `npm run a11y` checks every rules page and the Extensions page. A rules section's link lists use body text, like a detail page's Links, which meets the 24px target size. | WCAG 2.2 AA (2.5.8); the milestone added these pages | #215 |
| Page types have three component types: `class-feature` (for classes and subclasses alike), `class-option`, and `species-trait`, registered under `components` in `ruleset.json` with their allowed parents. A component's envelope drops `summary`, `description`, `tags`, and `image`. | One shape per kind of component; a component has no card to summarize | #229 |
| A component's id is its parent's id plus the slug of its name, with the level added where one parent prints a name twice. | Names like "Extra Attack" repeat across parents; no numeric suffixes | #229 |
| A parent lists its components in order by typed ref, and a component's parent is derived from that list; each component has exactly one parent. A subclass isn't a component: it names its class. | P3: order and parentage are stored once; a custom subclass leaves an SRD class unchanged | #229 |
| A back-link to a component reads "Parent › Component", and a parent's structural component lists aren't shown as links. | Many parents share component names; the page already shows its components | #229 |
| Components are in the SRD manifest with their parent key and no tier; feats and backgrounds are `simple`, species, classes, and subclasses `complex`. | P2: coverage proves each parent complete | #229 |
| A spell's `classes` become class refs, and a class's spell list is derived from them. A custom class adds SRD spells through its own `spells`, which a spell's card doesn't print. | P3: the list is stored once; P5: SRD spells and their cards stay unchanged | #229 |
| A class derives its proficiency bonus, Class Features column, and spell slots per level: full casters from the Multiclass Spellcaster table, half casters at half their level rounded up, and pact casters from a Pact Magic table in `tables.json`. Its other columns are stored as printed. | P3; the rounding reproduces the Paladin's and Ranger's slots | #229 |
| A class feature lists every level it appears at, each with an optional note ("Mystic Arcanum (level 6 spell)"); a class lists its subclass levels, which bound its subclasses' features. | The Features table is derived, with no per-row text | #229 |
| Templates word the SRD's fixed sentences, now from the phrase book: a feat's "You gain the following benefits.", a species' trait intro (with an `intro` override for the Tiefling), a class's "Becoming a <Class> …" bullets and spell list intro, and "(see “Feats”)". | P5, P6: entries store only what varies | #229, #273 |
| A feat stores its category, prerequisite level and text, titled benefits or one text, and a Repeatable paragraph. A background stores three abilities, an origin feat ref, two skills, a tool ref, and starting equipment. A species stores its creature type, sizes with heights, speed, and traits. | Each field matches a part the SRD prints for the type | #229 |
| Classes and backgrounds share one starting-equipment shape: lettered options of counted refs or text, plus GP, worded in one house style with "and" before the last part. | One shape and one wording; the SRD's two chapters differ only in style | #229, #273 |
| Subclass features' spell lists, the Elven Lineages and Fiendish Legacies, and similar tables stay tables in text, with spell tokens. | A field is added only when a shape recurs; these tables differ | #229 |
| Feats fill gaps by category; backgrounds, species, classes, and subclasses come only by request. | Classes and subclasses are too large for gap fill; backgrounds and species have no natural axis | #229 |
| A component has its own envelope schema, `schemas/component.schema.json`, which the validator picks when the entry's ruleset lists its type under `components`. | P2: an unknown key such as `summary` still fails; no conditional envelope | #230 |
| A component's parent is the entry whose stats hold a `{ ref }` object to it; a `{ref:…}` token is a mention. | Ref objects sit only at typed fields, so a listing is exact; text can mention any component | #230 |
| The validator checks that a component's id starts with its parent's id and a hyphen, not the full slug; a name repeats within a parent only as the first id plus `-<number>`. | Entry ids aren't slug-checked either; the prefix is what keeps keys unique across parents | #230 |
| A page type's search text includes its components' names and text, in its order. | A search for a feature should find its class, since components have no records of their own | #230 |
| Components render after the parent's template through `EntryTemplate`, so the detail page, print, and PNG capture show them alike: a heading, then rules text or the generic lines. | P3, P6: one rendering for every mode; the layout waits for the UI redesign (#237) | #230 |
| A page's Links merge its own and its components' links, without the links among its parts. Rules pages' back-links include components. | A component has no page, so its links show on its parent's | #230 |
| Components get no raw data file or export bundle; a page type's own bundle is unchanged. | Page types get Print and no Download in v2 (`export.md`, #115) | #230 |
| A ruleset module may have `checkLinks`, run once every ref resolves with each target's type and stats, for checks across entries: a background's feat must be an origin feat. | `check` sees one entry's stats; this rule reads another's | #231 |
| A background's coin option other than 50 GP is a warning, and a last option with items an error. | Every SRD background offers 50 GP; the coins-only option is part of the format | #231 |
| A starting-equipment item whose SRD primitive name reads differently in a list ("Clothes, Traveler's") is a token with display text, `{ref:equipment/clothes-travelers Traveler's Clothes}`. | P5: it reads as the SRD names it, and still links | #231, #273 |
| A registry facet may use the `ability` format, which reads an ability key by its full name from `tables.json`. | Backgrounds filter by ability score, stored as keys | #231 |
| The background card's feat and the `stats.feat` facet wait for the filter tree. | A facet over refs needs the tree's ref labels (#235), as condition immunities do | #231 |
| `linking.md` is deleted: v1's link standard carries into v2 unchanged, and the first v2 types declare their link fields in `refs.ts` and their schemas. | Nothing in it remained to build | #231 |
| A template may place a page type's components itself (`PLACES_COMPONENTS`); the species page prints its traits as anchored, bold-italic titled paragraphs rather than generic sections. | P5, P6: the SRD prints traits as run-in paragraphs | #232 |
| The species page words "As a/an <Name>, …" with "an" before a vowel, and `intro` overrides it. | P6: eight of nine SRD species share the sentence | #232 |
| A ruleset module may have `deriveLinked`, values that read other entries, which the site merges into an entry's derived values: a class's Class Features column, spell list, and subclasses. | `derive` sees one entry's stats; these read its components, the spells, and the subclasses | #233 |
| Until the SRD classes are imported, a class's spell list is the spells whose `classes` enum holds its id, plus its own `spells`. | Spell `classes` move to class refs in #234, once the classes exist to resolve them | #233 |
| `check` receives whether the entry is an SRD entry, for the error on an SRD class with `spells`. | That rule depends on provenance, which a type's stats don't hold | #233 |
| The class page prints its Features table and spell list as titled pipe tables, with each feature and spell a link, and the slot columns headed "Level 1 Slots" … in place of the SRD's grouped "Spell Slots per Spell Level" header. | P3: one table style; a pipe table has one header row, and the layout waits for the UI redesign (#237) | #233 |
| At a level that has both class features and a later subclass level, the Class Features column prints "Subclass feature" after the features. | No SRD class has such a level; a custom one reads features first, as the first subclass level does | #233 |
| The class page heads its Core Traits lines "Core <Class> Traits" and its subclasses "<Class> Subclasses"; the subclass page's heading is plain text, and it links its class through Links ("Subclass of"). | The SRD prints the traits as a titled table and has no subclass list; a heading isn't a link | #233 |
| The subclass card's class, the `stats.class` facet, and a sort by class wait for the filter tree; subclasses sort by name until then. | A facet over refs needs the tree's ref labels (#235), as a background's feat does | #233 |
| The hit die and casting progression read through the phrase book's `hitDie` ("D6") and `spellcastingProgression` ("Full", "Half", "Pact") vocabularies. | A value reads the same on a card, in a filter, and on its page | #233 |
| The class fixtures are the SRD Sorcerer and Draconic Sorcery in full; the Warlock's, Paladin's, and Barbarian's cases are tested as derivations. Matching every SRD class's table and spell list is the import's (#234). | The Sorcerer holds most cases; the import transcribes the rest | #233 |
| The SRD manifest lists components in their own `components` list by type, name, and parent key, and a name a parent prints twice is listed twice; coverage matches by count. | A key of type, name, and parent repeats for Improved Brutal Strike; a level in the record would duplicate the component's own data | #234 |
| A spell's `classes` are class refs, and the Classes filter reads a derived list of class ids by the `class` vocabulary until the filter tree reads ref labels. | The spec's ref facet needs #235; a derived key list keeps the filter working meanwhile | #234 |
| Where an SRD spell entry names a class whose printed list omits it (*Phantasmal Force*, *Mind Spike*), the class derives the spell, and the SRD check lists the case as an inconsistency. | P5: the spell card is reproduced as printed; the list is derived from it | #234 |
| The example test library holds abbreviated Sorcerer and Wizard classes for Frost Lance, and `tempLibrary` adds a stand-in for each SRD caster class a test's spells name but its library lacks. | A spell's class refs must resolve; a stand-in brings no refs of its own | #234 |
| `types.md` is removed with Milestone 4. Its last unbuilt part, the facets over refs (condition immunities, spell classes, a background's feat, a subclass's class), moves to `ui.md`'s filter tree, which builds them (#235). | The types are built; what remains is the filter tree's work | #216 |

### Wording

| Decision | Why | Source |
|---|---|---|
| The site is a web reference built on the SRD, not a facsimile of the print book. SRD fidelity means the same rules and meaning: a difference a player wouldn't play differently is style, and allowed. | The SRD was written for print; custom content, the site's main purpose, needs one house style | #273 |
| Allowed SRD adaptations: form (casing, list punctuation, quotes, run-in heads, table layout), connective wording composed from fields, print cross-references replaced by links, and link display text. Changing a number, rules term, condition, scope, or name, or dropping or adding a rules sentence, is not. | A bright line between style and meaning that review can apply | #273 |
| The SRD attribution states that the material is adapted, in the full statement and the short form. | CC-BY 4.0 requires indicating that licensed material was modified | #273 |
| All composed text goes through one wording layer: ruleset-independent grammar in `lib/wording/` (phrases, casing, lists, plurals, articles) and a per-ruleset phrase book of sentences and vocabulary. Type modules only compose, and a test enforces it. | P3, P4: each phrasing rule once; new types add data | #273 |
| Composed text is a `Phrase`, a list of plain and link parts, rendered to markdown or plain text, replacing plain strings, ad hoc markdown, and base item segments. | One form for every consumer | #273 |
| A link token may carry display text after a space, `{ref:<key> <text>}`, in stored and composed text. A `|`, as first designed, would split a table cell. | A link's words sometimes differ from its target's name: a group's qualifier, "Traveler's Clothes" | #273 |
| Facet formats read the phrase book's vocabulary. | A value reads the same on a card, in a filter, and on its page | #273 |

### UI

| Decision | Why | Source |
|---|---|---|
| The design criteria: one place for all content, fast lookup, easy export, and equal support for phones, tablets, and laptops. | The site is a DM's resource for lookup and session prep | #113 |
| The top bar is Library, Rulesets, About, Contribute. The Library is one gallery whose filters do the navigating; Rulesets holds the rules pages and the Extensions page. | Filters already navigate; rules and content are the big split | #113 |
| The old per-ruleset and per-type gallery URLs redirect to the Library with their filter. | P9: stable URLs | #113 |
| Filters are a nested accordion checkbox tree following the schema, in a sidebar on desktop and a collapsible container on phones and tablets, with search on top. | v1's filter pills took too much space on everything but desktop | #113 |
| Export is one Download and one Print button, each opening the device's own dialog. | Easy export; fewer controls | #113 |
| Card entries keep their own detail pages with back-navigation. Long pages use accordion sections with a jump-to table of contents, and a link opens its section. | Compartmentalized pages; fast lookup within long pages | #113 |
| Print stacks entries by default; the one-entry-per-page mode is removed. | Fewer pages for session prep | #113 |
| Every UI PR shows screenshots at 390, 820, and 1440px. Accessibility moves from per-PR CI to one WCAG 2.2 AA review at the end of each milestone. | Layout is the per-PR risk; a per-PR accessibility run isn't needed. Changes how P10 is checked | #113 |
| One palette for the whole site: no light and dark themes, and no theme switch. | One look to design, check, and print | #113 |
| The Library is at `/`, Rulesets at `/rulesets/`, and Contribute links to the repository. | P9: the home URL keeps working and is the Library | #236 |
| A `ruleset` filter (`f.ruleset`) joins the type filter; its node shows only with more than one ruleset, or when it filters. `/<ruleset>/` redirects to it. | The Library spans rulesets; with one ruleset the node is noise | #236 |
| A type's old gallery redirects with its type and ruleset filters and its registry `defaultSort`, and a checked type opens its `defaultFilters`, so the old view survives the move. A detail page's type link goes to the same view. | P9: an old link opens the view it showed; the registry keys keep a use | #236 |
| A redirect adds the old URL's query after the target's, so the reader's own parameters win. | P9: a bookmarked filtered gallery keeps its filters | #236 |
| The filter menu is a sidebar from a `64rem` viewport up; below that, phones and tablets (820px included) get the closed container. | Tablets read as phones per the spec; a 16rem sidebar leaves too little room for cards below 64rem | #236 |
| The axe run moves out of per-PR CI to a job on the PR that closes a milestone, marked by a hand-added `milestone` label. | A per-PR run isn't needed; a label is explicit and re-runs `validate` | #212 |
| The filter tree nests a type's facets by their registry paths: facets that share a field below `stats` or `derived` sit in a node labeled from the field's key; a field holding one facet adds no node. | "Following the schema" with no new registry key; `stats.ac.value` shouldn't read as "Ac › AC" | #235 |
| The tree keeps v1's filter semantics and URL form: one filter per path, OR within it and AND across paths, so a path two types share is one filter shown under each type. A type is a checkbox for `f.type`. | The pilot's "done when" keeps URL state as in v1; per-type filters would change every link | #235 |
| A ref facet is marked `"ref": true`; the index lifts its values as keys, and the island gets the targets' names from the build. | Condition primitives aren't in `library.json`, so names can't come from the records alone | #235 |
| Equipment's group is a `"groups": true` facet whose values nest as the groups file does, and a group matches every leaf in it; `derived.category` is no longer a facet, being the tree's top level. Categories read by `noun`, groups by `qualifier`, else by name. | Equipment › Weapon › Martial without a second, overlapping Category filter; the labels are the groups' own short forms | #235 |
| Creatures gain damage and condition immunity facets, which share the Immunities node. Spells' Classes filter reads `stats.classes`, and the derived class ids are removed. Subclasses filter, show, and sort by their class, and backgrounds show their feat. | The spec's facets over refs; the derived list was a stopgap until ref labels | #235 |
| A facet node shows only when some entry of its type has a value or it's active; a type shows only when the route has entries of it. Default filters start open on a type route only. | v1 showed default filters only with values; on routes spanning types, every open default would bury the type list | #235 |

### Export

| Decision | Why | Source |
|---|---|---|
| Export serves three lanes: data for other software, digital files for chat, and paper for the table. Print and PNG carry over from v1. | Already cover the file and paper lanes | #115 |
| No dynamic API in v2. The data lane is file downloads, with translators for VTT and site formats; the static entry files and `library.json` stay as an informal read-only feed. | Targets import files; P1 | #115 |
| One-click PDF is dropped; Print uses the device's print dialog. | Same number of steps in practice; fewer controls | #115 |
| Print layout adapts to the paper chosen in the print dialog, replacing the page size choice. | The size dropdown is gone | #115 |
| Download opens a small format menu (PNG, JSON, translators), offering only the formats for its scope. | A save dialog's file-type list works only in Chromium | #115 |
| Page types and rules pages get Print, not Download; printing one expands every section. | Download is for card entries | #115 |

### Translators

| Decision | Why | Source |
|---|---|---|
| Translators cover open sources only, in order: Open5e, Foundry VTT's dnd5e system, and the 5e.tools homebrew format (schema only). No licensed content is imported. | P5; closed formats can't be targeted | #116 |
| Each translator is a two-way module: export to the target format, import from it. | One module per format keeps both directions consistent | #116 |
| Import runs from a file attached to an issue: a routine runs the translator as a script within the `generate` workflow and opens a content PR. | P7: every import is reviewed; authors publishing comes later | #116 |
| What doesn't translate is skipped and reported: in the content PR on import, and on the site after the download on export. | Never guess a mapping | #116 |
| Translators are tested by an export-then-import round trip over the library and by each target's published schema in CI; real importers are checked by hand in the Testing backlog. | P8 | #116 |
| The translator and export areas can be combined. | Translators are exporters behind Download | #115, #116 |

### Style

| Decision | Why | Source |
|---|---|---|
| The style feels like an early-20th-century architectural print, inspired by Frank Lloyd Wright's Wasmuth portfolio: early modern, innovative, and romantic. | An unconventional take on a fantasy sourcebook | #114 |
| The owner's style package is the starting point: its light palette, Tenor Sans, Crimson Pro, and Josefin Sans (self-hosted), square corners, corner piers, the double page frame, and two ornaments. Its dark palette isn't used. | One palette (#113); self-hosting keeps captures faithful | #114 |
| Every type and item rarity has its own art-glass accent. | Types stay distinct as v2 adds them | #114 |
| Art is late-1800s and early-1900s public domain or CC book illustration and architectural drawing, lightly processed to monochrome or a tint. | Matches the style with art that is actually available | #114 |
| Wright and the Wasmuth portfolio are inspiration only, never named on the site. | P9: an original look | #114 |

### Art

| Decision | Why | Source |
|---|---|---|
| Images stay in the repo under `assets/images/`; no external hosting. | Processed line art is small; P1 and PR review stay intact | #117 |
| Art is lightly processed: cropped, monochrome, and tinted by CSS at display time. | One file serves every accent, and files stay small | #117 |
| Art is used if its source marks it public domain, CC0, or CC-BY, or if the skill judges it public domain from creator and date (US publication before 1931, or a creator dead over 70 years), with the reasoning recorded. A denylist of protected collections and estates is never retrieved from. | Most wanted art predates 1931; some collections are protected regardless of age | #117 |
| An `art` skill retrieves, checks, processes, and posts candidates. It is tuned on a `spike/` branch through a private claude.ai review page where the owner rates each candidate Good, OK, or Rejected with a note, and the next session updates the skill from the ratings. | Iteration narrows in on the right images without downloading or typing lists | #117 |
| For the v2 build, the tuned skill opens a content PR with the Good-rated images. Later, art comes with content or is added afterwards; when content passes but its art is denied, the two are split and the request issue gets a comment. | Art has its own review criteria; P7 | #117 |
