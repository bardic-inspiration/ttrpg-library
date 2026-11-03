---
name: generate
description: Generate new library entries for a content request issue, an inline request, or a gap-fill bucket, validate them, and open a content PR. Generic across types and rulesets. Use from a routine run (SPEC.md §8.2 steps 4 and 5) or when asked to fulfil a `request` issue. Not for revisions; those use the revise skill.
---

# Generate

Turns one batch of requests into entries under `content/` and one content PR.
`SPEC.md` §8.4 is the source of truth; this skill is how to carry it out.
Follow it exactly, in order. Never skip validation, and never push a failing
batch.

The routine run that calls this skill has already synced `main`, picked the
batch, and claimed each issue with the `in-progress` label (§8.2 steps 1, 4,
5). This skill starts after that.

`defaults.<key>` below means that key of `config/defaults.json`.

## Inputs

One batch, from exactly one of these sources:

- **Issues.** One or more open `request` issues. Read each with its comments.
  A content-request form body has one `### <label>` heading per field
  (`Type`, `Count`, `Brief`, `Tags`, `Ruleset`); `_No response_` means the
  field was left blank. A free-form `request` issue is read for the same
  fields in its prose (§8.1).
- **Inline request.** Type, count, brief, and tags given directly by a manual
  run, with no issue (§8.2).
- **Gap bucket.** A type and a bucket label such as `stats.cr=2..4`, chosen by
  the run (§8.2 step 5, §7.1), with a count of `defaults.gapFill.count`. The
  brief is to fill that bucket: every entry's values must fall in it.
- **SRD import stage.** A stage issue of the full SRD import (§8.1), worked
  in a session the owner starts. The batch is SRD entries of one type and
  tier, picked from `npm run srd-coverage -- --type <type> --tier <tier>`.
  It is an SRD request; don't claim the issue with `in-progress`.

Resolve each request against `config/defaults.json` as
`scripts/generate/defaults.ts` (`applyDefaults`) does: a blank field takes
the default (`defaults.ruleset`, `defaults.count`), a count above
`defaults.maxBatch` becomes `defaults.maxBatch` (`defaults.srdMaxBatch` for an
SRD import stage), and request tags merge over
`defaults.tags`. A form tag line `key: a, b` is the list `["a", "b"]`; a
line with no comma is a single string.

A brief that asks for SRD content, by name or by description ("ten SRD
creatures of CR 1 to 3"), is an **SRD request**: it is fulfilled with SRD
entries reproduced unmodified from SRD 5.2 (§5.9). Any other brief, and every
gap-fill run, is fulfilled with custom entries.

If a request can't be fulfilled as written (contradictory constraints, a type
or ruleset not in `config/types.json`), don't generate it: comment one
question on the issue, add `needs-info`, remove `in-progress`, and leave it
out of the batch (§8.2 step 6).

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
- The example entries in `SPEC.md` §6.9 and the schema shape in `schemas/envelope.schema.json`.

## Step 2: Avoid collisions

From `site/public/library.json`, list every existing `name` and `id`, across
all types: IDs and names are unique library-wide (§5.2). Then find existing
entries that match the brief's theme (by tags, summary, and facets) so the
batch doesn't repeat a concept already in the library.

- On a name or ID collision, choose a different name. Never add a numeric
  suffix.
- Avoid names within a small edit of an existing name ("Frost Lance" vs
  "Frost Lances"); the validator warns on them.
- Custom entries: avoid SRD names and near collisions with them, whether or
  not the SRD entry is in the library, and every blocklist term (§11).
- SRD request: skip any SRD entry already in the library. If an SRD name
  collides with an existing custom entry, leave that SRD entry out and report
  the collision in the PR body (or the run's output if nothing else is
  generated). Never rename an SRD entry to dodge a collision.

## Step 3: Write entries

Write each entry to `content/<ruleset>/<type>/<id>.json`, where `<id>` is the
slug of the name: lowercase, ASCII-folded, non-alphanumerics collapsed to `-`
(§5.2). Write the envelope keys in the §5.1 order: `ruleset`, `type`, `id`,
`name`, `summary`, `description`, `stats`, `tags`, `meta`.

- **Inputs only.** Never write a value the ruleset derives (§6.1). In prose,
  write derived numbers as tokens from `rulesets/<ruleset>/tokens.ts`, never
  as literal numbers (§6.4). Attack and save lines are generated from
  `stats`, so never write them as prose.
- **Balance by inputs.** Meet the guideline's balance targets by choosing
  inputs (ability scores, hit dice, damage dice), not by overriding results.
- **`adjust` only for a deliberate deviation.** Every `adjust` or damage
  `bonus` needs a reason, recorded for the PR body (step 6).
- **Dependencies.** Include any new entry the brief implies, such as a
  creature's signature spell, in the same batch (§5.7). Prefer a ref
  `{ "ref": "<type>/<id>" }` to an existing library entry over plain text
  when one matches. Use plain text only for SRD content not in the library,
  as the guideline's dependency section says.
- **Text.** Rules text and `description` use the markdown subset only (§5.5).
  No non-SRD proper nouns anywhere (§11).
- **Situational fields.** Omit an optional field that doesn't apply; never
  write a "none" stand-in such as `0`, `false`, `""`, or `[]` (§5.8).
- Don't add `image` (no art in v1).

### SRD entries

For an SRD request, transcribe each entry from SRD 5.2 unmodified (§5.9)
instead of following the guideline's tone, naming, and balance targets.
Transcribe from `docs/SRD_CC_v5.2.pdf`, not from memory, and check each entry
against it before pushing.

- `name` is the SRD name exactly, and `id` is its slug.
- `stats` reproduce the SRD stat block: choose inputs so every derived value
  the template renders matches the SRD number. Where no input reaches it, set
  `adjust` or a damage `bonus` to match, with the reason "matches SRD".
- Rules text is the SRD's text word for word, except that every derived
  number is written as its token (§6.4), which renders the same value.
- Fill every structured field the type defines from the SRD too (an item's
  `charges` and `spells`), and still keep every sentence of the rules text,
  even where it states the same thing (§5.9). Don't move a paragraph out of
  `effect` into a structured field; the guideline's "don't restate
  structured fields" rule is for custom entries.
- `summary` is one plain, factual line written for the entry, since the SRD
  has none. Omit `description`.
- Everything the entry uses (spells, gear) is SRD content: a ref if it's in
  the library, a plain string otherwise. Never create a dependency entry.
- Set `meta.source.srd` to `true` (step 4).

Never modify, rename, or move an existing entry. This skill only adds files.

## Step 4: Meta and tags

Set on every entry in the batch, including dependencies:

- `meta.createdAt`: today's date, `YYYY-MM-DD`.
- `meta.source.kind`: `"routine"`.
- `meta.source.issues`: the issue numbers the entry fulfils, for an issue
  batch, or `[<stage>]` for an SRD import stage. Omit it otherwise.
- `meta.source.gapFill`: the bucket label, for a gap-fill run. Omit it
  otherwise.
- `meta.source.srd`: `true` on an SRD entry. Omit it on a custom entry.
- `tags`: the resolved request tags (request tags merged over
  `defaults.tags`), on every entry. Omit `tags` if it would be empty.

## Step 5: Validate

Run `npm run validate`. If it reports errors, fix the entries and run it
again, up to `defaults.validateRetries` retries after the first run.

If it still fails:

- Comment the remaining errors on each issue in the batch, remove
  `in-progress` from each, delete the batch's entry files, and stop. Don't
  push and don't open a PR.
- For a gap-fill run or an inline request there is no issue: report the
  errors in the run's output and stop.

Once it passes, keep every warning it prints; they go in the PR body.

## Step 6: Branch, commit, and open the PR

1. Branch from `main`:
   - issues: `gen/<issue-numbers>-<YYYYMMDD>`, numbers ascending and joined
     by `-` (`gen/12-14-20261102`);
   - gap fill: `gen/gap-<type>-<YYYYMMDD>` (`gen/gap-spell-20261102`);
   - inline request: `gen/inline-<type>-<YYYYMMDD>`;
   - SRD import stage: `gen/srd-<stage>-<type>-<YYYYMMDD>`, adding `-2`,
     `-3` for more PRs the same day.
2. Stage only the new files under `content/`. A content PR that changes
   anything else fails the `lane` check (§12.4).
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
   - **Gap fill:** the bucket label, for a gap-fill run. Delete the section
     otherwise.
   - One `Closes #<n>` line per fulfilled issue. Delete the line for a
     gap-fill or inline run. An SRD import stage uses `Refs #<stage>`,
     except the PR that finishes the stage, which uses `Closes #<stage>`.

The `content` label is applied from the branch prefix (§12.4); don't add
labels to the PR. Leave `in-progress` on the issues: an open linked PR is
what keeps the claim alive (§8.2 step 7), and merging closes them.

Review comments on the PR are handled by the `revise` skill on a later run,
not here.
