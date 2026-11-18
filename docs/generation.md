# Generation

## Purpose

How entries are requested, generated, imported, and revised. Claude routines
turn GitHub issues into entries and open one PR per batch, then revise the batch from the
owner's review comments. The human role is request, review, and merge. SRD
import stages use the same skills in sessions the owner starts.

## Behavior

### Requests

GitHub issues are the request queue. Issue templates set blank issues off, so
every issue starts in a lane.

- **Content request**
  ([`.github/ISSUE_TEMPLATE/content-request.yml`](../.github/ISSUE_TEMPLATE/content-request.yml),
  label `request`): type (the form lists every type in `config/types.json`), count (a 1–10 dropdown,
  since issue forms have no number field; a free-form request may ask for
  more), brief, tags (one `key: value` per line, comma-separated for lists),
  and ruleset. Blank fields take the values in `config/defaults.json`.
- **Revise request** (`revise-request.yml`, label `revise`): the entries, one
  per line as `<type>/<id>` (or a bare `id` when only one type has it), and an
  instruction, both required. For changes to merged entries.
- **Import request** (`import-request.yml`, label `import`): the format (a
  dropdown of the translators that are built), the file (attached, or a URL),
  the work's title, author, and source URL, and its license (a dropdown of the
  ids `config/licenses.json` accepts for imports), all required; then ruleset
  and notes, optional. For Creative Commons homebrew in an open format
  ([Imports](#imports)).
- Free-form issues with the `request` label are also accepted; the routine reads
  them against the defaults.
- A brief that asks for SRD content (by name, or as "ten SRD creatures of CR 1
  to 3") is fulfilled with SRD entries
  ([content-model.md](content-model.md#srd-and-custom-entries)). Any other
  brief is fulfilled with custom entries.

### Labels

| Label | Meaning |
|---|---|
| `request` | Open content request |
| `revise` | Open revision request for merged entries |
| `import` | Open import request |
| `priority:high` | Picked before others |
| `in-progress` | Claimed by a routine run |
| `needs-info` | The routine asked a question on the issue; skipped until it's answered and the label removed |

Lane and area labels for PRs, and the dev-lane issue labels, are in
[workflow.md](workflow.md#work-lanes).

### Run order

Every run, scheduled or manual, follows the same sequence, so review feedback is
never starved by new work. `docs/routines.md` writes it out for the routine.

1. **Sync.** Fetch `main`, `npm ci`, and `npm run build:index` for the current
   library.
2. **Revisions first.** For each open PR on a `gen/` or `revise/` branch, find
   owner comments not yet handled ([Revisions](#revisions)) and run the
   `revise` skill. Push, reply, continue.
3. **Revise requests.** Take open `revise` issues without `in-progress` or
   `needs-info`, oldest first, claim each as in step 5, and run the `revise`
   skill on each; each becomes a small PR.
4. **Import requests.** Pick open `import` issues without `in-progress` or
   `needs-info`, `priority:high` first, then oldest, and claim each as in
   step 5. Run each through the import script in the `generate` skill
   ([Imports](#imports)), and open one content PR for all of them, with a
   skip list grouped by issue. An issue whose license isn't accepted is
   rejected instead.
5. **Content requests.** Pick open `request` issues without `in-progress` or
   `needs-info`, `priority:high` first, then oldest. Group them all into one
   batch; there is no batch size limit. Claim each with `in-progress` and a
   short comment.
6. **Gap fill.** If no content requests were picked and `gapFill.enabled`, choose the
   type and bucket with the fewest entries and generate `gapFill.count` entries
   for it. Ties go to the type with the fewest entries overall, then to the type
   listed first in `config/types.json`; within a type, to the first bucket in
   `gapBuckets` order, first axis outermost. `npm run gap-fill` makes this
   choice among the types of `defaults.ruleset` and prints the type and bucket
   label, as in `spell stats.level=0..0&stats.school=abjuration`.
7. **Ambiguity.** If a request can't be fulfilled as written (contradictory
   constraints, unknown type), comment one question on the issue, add
   `needs-info`, remove `in-progress`, and move on.
8. **Stale claims.** An `in-progress` issue with no open linked PR after 24
   hours is treated as unclaimed.

A manual run may name issues, or pass an inline request (type, count, brief,
tags) handled as if it were an issue but without one. It still does steps 1–3,
but steps 4 and 5 take only what it was given: named issues must be open
`import` or `request` issues without `needs-info`, and any other is reported
and left alone. An inline request is always a content request. It never
gap-fills. An ambiguous inline request has no issue to ask on, so the run
reports the question instead.

### Defaults

`config/defaults.json` holds the ruleset, count, tags, gap-fill settings, and
the validation retry budget a run uses. Defaults apply only to fields a request
leaves out, and request tags merge over default tags. `count` and
`gapFill.count` are whole numbers of at least 1. A request's count is taken on
trust, and no batch has a size limit. `scripts/generate/defaults.ts` loads and
checks the file and applies it to a request.

**Gap fill is off** (`gapFill.enabled: false`) until v2 is built. Every entry
generated in the v1 shape is one more for v2's schema changes to migrate.
Run-order step 6 skips while it's off.

### The generate skill

`.claude/skills/generate/SKILL.md` is generic across types and rulesets. Its
inputs are the ruleset, type, count, brief, tags, and issue numbers, or a gap
bucket, or an SRD import stage. Its steps:

1. Read `config/types.json`, `config/defaults.json`, the ruleset module (the
   type's schema, `tables.json`, tokens, guideline), `config/blocklist.json`,
   and `library.json`.
2. List existing names and IDs to avoid collisions, and existing entries that
   match the brief's theme to avoid near-duplicate concepts.
3. Write entries, with any new dependencies the brief implies. Prefer refs to
   library entries over plain text. Write inputs only, use tokens for derived
   values in prose, and use `adjust` only for a deliberate deviation, explained
   in the PR body. For an SRD request, transcribe the SRD entries faithfully
   instead.
4. Set `meta.createdAt`, `meta.source.kind: "routine"`, and
   `meta.source.issues` (or `meta.source.gapFill`), plus `meta.source.srd: true`
   on SRD entries. Apply request and default tags.
5. Run `npm run validate`; fix and retry up to `validateRetries` times. If it
   still fails, comment the errors on the issue, remove `in-progress`, and stop
   without a PR. A gap-fill run or inline request reports the errors in the run
   output instead.
6. Branch `gen/<issue-numbers-or-gap>-<YYYYMMDD>` (issue numbers ascending:
   `gen/12-14-20261102`, `gen/gap-spell-20261102`; an inline request uses
   `gen/inline-<type>-<YYYYMMDD>`), commit `Add <n> <type> entries`, push, and
   open the PR.

**PR conventions.** Titled `Add <n> <type> entries` (`Add <n> entries` for mixed
batches), labeled `content` automatically, with a body from
`.github/PULL_REQUEST_TEMPLATE/content.md`: a table of each entry (name, type,
the type's summary field, summary); any validator warnings, including every
formula adjustment with its reason; one `Closes #n` per fulfilled issue; and the
bucket filled, for gap fill.

A test checks that every repo path, npm script, and `config/defaults.json` key
the skill names exists, and that `content.md` has the body sections above.

### Revisions

The `revise` skill (`.claude/skills/revise/SKILL.md`) handles review comments
on a routine PR and `revise` issues.

- **Input.** Owner comments on a `gen/` or `revise/` PR: inline review comments
  on a file or line, or general PR comments. A submitted review's body counts as
  a general comment.
- **Instructions.** Free text applies to the commented file, or to the whole
  batch for a general comment. `drop <id>` removes an entry (and fails
  validation if something references it, in which case the routine asks how to
  proceed). `regenerate <id>` replaces an entry with a fresh one under the same
  brief.
- **Handled marker.** The routine posts under the owner's identity, so it marks
  its own replies with a trailing `<!-- routine:handled -->`. An owner comment
  is pending if no reply with that marker follows it in its thread (inline) or
  after it (general).
- **Action.** Edit only the affected files, set `meta.updatedAt`, re-validate,
  push one commit per round (`Revise <ids>: <short reason>`), reply to each
  handled comment with what changed, and resolve the inline threads it
  addressed.
- **SRD entries.** A revision of an SRD entry only brings it closer to the SRD.
  Any other instruction isn't applied; the reply (or a `needs-info` question on
  a `revise` issue) says so and suggests requesting a custom variant.
  `regenerate <id>` on an SRD entry transcribes the same entry again, keeping
  its name and ID.
- **Post-merge revisions.** A `revise` issue produces a PR on
  `revise/<issue>-<YYYYMMDD>`, with `meta.source.kind` left as is and
  `meta.updatedAt` set. IDs never change.
- **Delivery.** The run-order sweep (step 2) is the guaranteed path, so a
  comment is handled by the next run at the latest. A routine may also
  subscribe to the PR it opened for faster turnaround; correctness never
  depends on that.

A test checks that every repo path, npm script, and defaults key the skill names
exists, and that it names the handled marker, `drop` and `regenerate`, and the
commit and branch formats above.

### Guidelines

Each `rulesets/<ruleset>/guidelines/<type>.md` is written for custom entries,
and says so. An SRD entry follows only its token rules and its dependency
section. Each guideline has these `##` sections, in this order:

1. **Tone and voice**, with one short exemplar.
2. **Naming**: evocative and original; no real-world trademarks or non-SRD
   proper nouns; no SRD entry's exact name or SRD proper noun. Building on
   common SRD words ("Fire Zombie") is fine.
3. **Balance targets**, as tables written for this library: for creatures by
   CR (AC, HP, attack bonus, damage per round, save DC), met by choosing inputs;
   for items, power by rarity; for spells, damage by level and area.
4. **Prose style** for rules text in 5.2 phrasing, with derived numbers as
   tokens. Attack and save lines are generated, never written.
5. **Dependencies and SRD references**: when to create a dependency entry and
   when to use plain text for an SRD reference.

Balance is judged in review against these targets; CI doesn't enforce it. The
PR summary shows each creature's derived HP, AC, attack bonuses, DCs, and
average damage per action, so review needs no arithmetic. A test checks that
every registered type's guideline exists at that path with those sections, that
every `{...}` in it is a token the ruleset defines, and that it passes the
blocklist.

### Schedule

`docs/routines.md` holds the canonical routine prompts and the schedule:

- **Scheduled routine:** weekly, Monday morning local time, one run. A request
  without a count gets the default.
- **On-demand routine:** the same prompt, with issue numbers or an inline
  request added.

The prompts tell the run to follow the run order written in `docs/routines.md`
on `main`, so changing the run order is a reviewed dev PR, not an edit to the
routine's settings. A test checks that every path, script, and defaults key the
file names exists, that it lists the run-order steps in order, and that the
on-demand prompts are the scheduled prompt with inputs added.

### Gap buckets

Gap fill never adds a rules extension, so a rules type that takes extensions,
such as `condition` or `equipment`, has no `gapBuckets`; its entries come only from requests.
A content type that comes only by request, `background`, `species`, `class`,
or `subclass`, has no `gapBuckets` either.
A type's `gapBuckets` in `config/types.json` says how gap fill partitions it: a
list of axes, each partitioning one of the type's facets. The buckets are every
combination of one value per axis, so one axis partitions the type and two
cross. An axis is either:

- **numeric bins** on a `range` facet, `{ "path": "stats.cr", "bins": [[0, 1],
  [2, 4]] }`: inclusive at both ends, ascending, not overlapping; or
- **categorical values** on an `enum` facet, `{ "path": "stats.rarity",
  "enum": ["common", "uncommon"] }`: one bucket per listed value, each one the
  schema allows. A value left out, such as `artifact`, is never a gap to fill.

An entry belongs to a bucket when its value on every axis falls in the bucket's
bin or equals its value. An entry with no value on an axis belongs to no
bucket; one whose categorical value is a list belongs to each bucket whose value
the list holds. A bucket's **label**, recorded in `meta.source.gapFill` and the
PR body, joins one `<path>=<value>` per axis with `&`, in axis order, with bins
as `min..max`: `stats.cr=2..4`, `stats.level=1..3&stats.school=evocation`.
With `f.` before each path, a label is a gallery query that shows the bucket.

### Imports

An import request brings an author's openly licensed homebrew into the
library from a file in an open format. Its entries are custom entries, and
every content rule applies to them.

- **Licensing.** The issue's license must be one `config/licenses.json`
  accepts for imports ([Source allowlist](licensing.md#source-allowlist)):
  CC0 or CC-BY. Any other, NC, ND, and SA included, is rejected: the routine
  comments why, removes `in-progress`, and makes no entries.
- **The import script.** `npm run import -- --issue <n> --format <id> --file
  <path> --work <title> --author <name> --url <source> --license <id>`
  (`--ruleset` and `--date` optional) runs the format's translator's import
  side ([Translators](export.md#translators)) on the file. Names in
  structured fields resolve against the library and its rules and become
  refs; names in text stay plain. It writes each entry to `content/` with
  `meta.source.kind: import`, the issue, and `meta.source.license` (the
  license id, author, and source URL), `tags` of `defaults.tags` plus
  `author`, and a drafted `summary` the run rewrites. It appends the work's
  line to `ATTRIBUTION.md` ([Imported works](licensing.md#imported-works)),
  and prints the issue's skip-list section. It exits 2 with the reason when
  the issue is rejected: an `--issue` that isn't a positive integer, a
  license not accepted, an unknown format, a ruleset the format doesn't map,
  or a file that isn't JSON.
- **What it skips.** Everything the translator can't map, by record and
  field; and a whole record whose name is an SRD name of any type (from the
  ruleset's [SRD manifest](content-model.md#srd-manifest-and-coverage)), a
  name or id the library or the batch already has in that type, or a
  blocklisted term. Skipping never renames a record.
- **What the run adds.** The `generate` skill rewrites each drafted summary
  as the type's one-line factual summary, links the mentions of library
  entries and rules in each entry's text
  ([References](content-model.md#references)), and removes any entry that
  uses an SRD proper noun, which no list holds, adding it to the skip list.
  Then it validates the batch like any other.
- **The PR.** One content PR for every import issue in the run, on
  `gen/import-<issue-numbers>-<YYYYMMDD>`, with the content PR template's
  "Skipped on import" section: one `#### #<n>: <work>` section per issue,
  each a table of record, field, and reason. A content PR may change
  `ATTRIBUTION.md` for these lines ([Lane rules](workflow.md#lane-rules)).

### SRD import

The full SRD import bypassed requests: each stage was a sub-issue of its
milestone, without the `request` label, so routines never took it, worked in
sessions the owner started. Every stage is done. SRD entry upkeep (link
passes, corrections, review) works the same way, with its issue under the
current milestone or a track issue ([Dev Queue](../AGENTS.md#dev-queue)).
A session runs the `generate` skill on a batch picked from
`npm run srd-coverage -- --type <type> --tier <tier>`, with no `in-progress`
claim, on branch `gen/srd-<stage>-<type>-<YYYYMMDD>` (`-2`, `-3` for more PRs
that day). The PR uses `content.md` and says `Refs #<stage>`; the PR that
finishes the stage uses `Closes #<stage>`.

The session follows `.claude/skills/srd-import/SKILL.md`, which wraps the
`generate` and `revise` skills: one batch per type, transcription from the PDF's
text layer, verification against the PDF through the templates, format-fix
dev issues for gaps (a fix's PR adds no entries; they come in the next
batch), and a link pass once a stage's batches merge (a
`revise/<stage>-<YYYYMMDD>` PR turning plain-text mentions of library entries
into links). A test checks that every path and npm script the skill names
exists, and that it names both skills and both branch formats.

## Where the rules live

- `.claude/skills/generate/`, `revise/`, and `srd-import/`: the skills.
- `rulesets/<ruleset>/guidelines/`: the guidelines.
- `config/defaults.json` and `scripts/generate/` (defaults, the gap-fill
  picker); `scripts/import/` (the import script) and `config/licenses.json`; `lib/buckets.ts` counts entries per bucket and builds labels.
- `docs/routines.md`: the prompts, schedule, and run order.
- `.github/ISSUE_TEMPLATE/content-request.yml`, `revise-request.yml`,
  `import-request.yml`, and `.github/PULL_REQUEST_TEMPLATE/content.md`.

## Extending

| To add or change | Touch |
|---|---|
| The run order | `docs/routines.md`, as a reviewed dev PR |
| A type's gap buckets | `gapBuckets` in `config/types.json` |
| A type's guidance | Its guideline file; it's dev work, since it changes every future run ([workflow.md](workflow.md#work-lanes)) |
