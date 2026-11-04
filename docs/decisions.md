# Design decisions: v1

A record of what v1 built and why, as of the `v1.0.0` tag. It is distilled
from `SPEC.md` at that tag, the milestone issues and their comments, the
decision comments those issues link to, and the dev PR descriptions.

**This is history, not a set of rules.** The decision rows describe what v1
did. Later versions may change any of them (the themes, the look, the
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
| P5 | SRD fidelity, custom originality | SRD entries reproduce SRD 5.2 exactly. Custom entries borrow no SRD entry name and no non-SRD intellectual property. |
| P6 | Templates own presentation | Entries hold content; templates hold wording, order, and typography. One streamlined rule beats per-entry formatting. The data models the gameplay meaning, not every printed variation. |
| P7 | Humans request, review, merge | Routines do the writing. Review needs no arithmetic. Merging to `main` is the only step that publishes. |
| P8 | Enforced, not by convention | Lanes, text rules, and accessibility are checked by CI. Every content change made by code is visible. |
| P9 | Shareable later | A private tool now, but licensing, attribution, stable URLs, and an original look are right from day one. |
| P10 | Cheap, safe refinement | The UI is tuned through tokens and a style guide, with WCAG 2.2 AA checked automatically. |
| P11 | Weight follows the selection | Pages load a lean index; full data is fetched only for what the reader picks. |
| P12 | A durable record | Sessions have no memory, so decisions live in the repo, issues, and PRs, and every merge leaves `main` consistent. |

## Scope

| Decision | Why | Source |
|---|---|---|
| A library of D&D 5e content on SRD 5.2, ruleset `dnd-5e-2024`, with types `creature`, `magic-item`, and `spell`. | P9: the SRD is CC-BY-4.0 | #1 |
| The library holds SRD entries and custom entries. | The full SRD proofs the schemas and UI against everything they must hold | #77, #128 |
| Public repo and Pages site on the free plan, not promoted. | P9 | #1 |
| No backend, database, accounts, user submissions, or in-browser editing. Every change is a PR. | P1, P7 | #1 |
| v1 is a prototype; v2 a complete product for one user; v3 and later explore multiple users and a public site. | | #95 |

## Entry model

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

## Rulesets and derived values

| Decision | Why | Source |
|---|---|---|
| Everything ruleset-specific is one folder meeting one module contract: schemas, tables, derivations, tokens, checks, ref labels, guidelines, SRD manifest. | P4: adding a ruleset is adding a folder | #1, #21 |
| Entries store only authored inputs. The ruleset computes XP, PB, HP, modifiers, saves, skills, passive Perception, attack bonuses, DCs, and damage averages at build time. | P3: no mismatches, no arithmetic in generation, one place per rule | #1 |
| A deliberate deviation is an explicit non-zero `adjust` or damage `bonus`, and each one is listed as a warning. | P7: the reviewer confirms it | #1 |
| Numbers the rules leave to the author (AC, spell dice, an item's DC) stay stored. | | #1 |
| Creature prose shows derived numbers only through tokens. A literal number that looks derived fails; `{dc=<n>}` marks an authored DC. Spell and item text is exempt, since its numbers are authored. | P3 | #21, #99 |
| Display forms such as the U+2212 minus are display only; data and exports keep plain numbers and ASCII formulas. | Exports carry the data | #94 |

## SRD and custom entries

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

## Type formats

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

## Validation

| Decision | Why | Source |
|---|---|---|
| Schemas are plain JSON Schema (draft 2020-12), validated with Ajv. | P1 | #1 |
| Errors fail CI; warnings appear in local output and the job summary but don't block. | | #1 |
| Checks that apply to every type: path, uniqueness, refs, markdown subset, blocklist, placeholder text, image path and size. Type checks cover cross-field rules a schema can't express. | P8 | #30, #39, #191 |
| Balance isn't enforced by CI. It is judged in review against guideline targets, and the PR summary shows the derived numbers. | P7 | #1 |

## Registry and gallery

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

## Templates and styling

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

## Export

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

## Generation and revision

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

## Repository, lanes, and CI

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

## Working process

| Decision | Why | Source |
|---|---|---|
| Don't invent behavior: a gap in the spec is settled with the owner, and written down, before code depends on it. | P12 | #2 |
| One issue per PR. A multi-item issue is one PR with one commit per item; small related issues are bundled. | The owner merges once | #91, #126 |
| Milestones are tracking issues whose ordered sub-issues form one dev queue. A new issue is placed before the first issue that depends on it. GitHub milestones aren't used. | Sessions can't manage GitHub milestones, which have no order | #2, #32, #95 |
| Checks that need a human or a live service aren't milestone criteria; they go in the Testing backlog. | A pending manual check never blocks work | #38 |
| No triage routine: the session that files an issue places it. | | #95 |
| `SPEC.md` becomes reference docs for what's built plus a stage spec for what isn't; citations use file and heading; docs defer to code for exact rules. In progress under #108. | P3, P12: a routine must not act on unbuilt design | #95, #108 |
| v2 starts with a design-only phase, one owner-led session per area. | Unknowns are worked out before they meet the dev rules | #95, #110 |
