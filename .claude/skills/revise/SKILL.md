---
name: revise
description: Revise library entries from owner review comments on an open routine PR (gen/ or revise/ branch), or from a `revise` issue about merged entries, validate them, and push. Generic across types and rulesets. Use from a routine run (SPEC.md §8.2 steps 2 and 3) or when asked to address review comments on a content PR or fulfil a `revise` issue. Not for new entries; those use the generate skill.
---

# Revise

Changes existing entries in response to the owner, then validates and pushes
them. `SPEC.md` §8.5 is the source of truth; this skill is how to carry it
out. Follow it exactly, in order. Never skip validation, and never push a
failing change.

The routine run that calls this skill has already synced `main` and chosen
what to revise (§8.2 steps 1 to 3). This skill starts after that.

`defaults.<key>` below means that key of `config/defaults.json`.

## Inputs

Exactly one of:

- **Review comments.** One open PR on a `gen/` or `revise/` branch, and its
  pending owner comments (see [Pending comments](#pending-comments)). Work on
  the PR's own branch.
- **A `revise` issue.** One open issue with the `revise` label, for entries
  already on `main`. A revise-request form body has a `### Entry IDs` heading
  (one `id` per line) and an `### Instruction` heading. A free-form `revise`
  issue is read for the same two things in its prose. Read the issue's
  comments too. Work on a new branch (step 5).

If a revise issue can't be fulfilled as written (an ID that isn't in the
library, an instruction that contradicts itself), don't edit anything:
comment one question on the issue, add `needs-info`, remove `in-progress` if
it has it, and stop (§8.2 step 6).

## Pending comments

The routine posts under the owner's identity, so every reply it writes ends
with the marker `<!-- routine:handled -->`. That marker is how its replies are
told apart from the owner's own comments.

An owner comment is a comment by the repository owner that doesn't carry the
marker. Ignore comments by anyone else, including bots.

- **Inline review comment** (on a file or line): pending if no reply in its
  review thread that comes after it carries the marker.
- **General PR comment** (in the conversation, or the body of a submitted
  review): pending if no comment in the conversation that comes after it
  carries the marker.

Handle every pending comment on the PR in one round.

## Step 1: Read

For the ruleset and each type the revision touches, read what the `generate`
skill reads in its step 1 (`.claude/skills/generate/SKILL.md`):
`config/types.json`, the ruleset module under `rulesets/<ruleset>/` (the
type's schema `rulesets/<ruleset>/schemas/<type>.schema.json`,
`rulesets/<ruleset>/tables.json`, `rulesets/<ruleset>/tokens.ts`, and the
guideline `rulesets/<ruleset>/guidelines/<type>.md`), `config/blocklist.json`,
and `site/public/library.json` (run `npm run build:index` if it is missing).
The guideline binds a revision as much as a new entry.

Then read every entry file the revision may touch, under `content/`.

## Step 2: Work out what each comment asks

- **Inline comment:** free text applies to the file it is on.
- **General comment, or a revise issue:** free text applies to the whole
  batch, or to the entries it names. For a revise issue, the batch is the
  listed IDs.
- **`drop <id>`:** remove that entry.
- **`regenerate <id>`:** replace that entry with a fresh one under the same
  brief. The brief is the one the PR was generated from: the issues in the
  entry's `meta.source.issues`, or the bucket in `meta.source.gapFill`.

A comment that is only a question or an acknowledgement and asks for no
change still gets a reply (step 6), but no edit.

## Step 3: Edit

Edit only the affected files.

- **Free text.** Change what the comment asks and nothing else. Write the
  same way the `generate` skill's step 3 says: inputs only, never a value the
  ruleset derives (§6.1); derived numbers in prose as tokens (§6.4); `adjust`
  only for a deliberate deviation, with a reason for the reply and PR body;
  the markdown subset (§5.5); no non-SRD proper nouns (§11); no "none"
  stand-ins (§5.8).
- **Never change an entry's `id` or move its file.** A rename changes `name`
  only and keeps the old `id` (§5.2).
- **`drop <id>`.** Delete the entry's file. If other entries reference it,
  validation fails on the dangling ref (step 4). Then don't push: restore the
  file, and reply asking how to proceed (keep the entry, drop the
  referencing entries too, or replace the refs with plain text).
- **`regenerate <id>`.** Delete the entry's file and write a fresh entry
  under the same brief, following the `generate` skill's steps 2 to 4: a new
  name and its slug as the `id`, avoiding collisions with the library and the
  rest of the batch, with the old entry's `meta.source` and tags. If other
  entries reference the old `id`, point those refs at the new one in the same
  round.
- **`meta.updatedAt`.** Set it to today's date, `YYYY-MM-DD`, on every entry
  this round changed. A regenerated entry gets a fresh `meta.createdAt`
  instead.
- **`meta.source.kind`.** Leave it as it is on every revised entry. A revise
  issue doesn't change it to `revise`.

## Step 4: Validate

Run `npm run validate`. If it reports errors, fix them and run it again, up
to `defaults.validateRetries` retries after the first run.

If it still fails, don't push. Undo this round's edits, then:

- **Review comments:** reply to each comment in the round with the errors and
  a question about how to proceed, each reply ending with the marker. The
  owner's answer is a new comment, handled on a later run.
- **Revise issue:** comment the errors on the issue, remove `in-progress` if
  it has it, and stop without opening a PR.

Once it passes, keep every warning it prints; they go in the reply or the PR
body.

## Step 5: Commit and push

Stage only the changed files under `content/`. A content PR that changes
anything else fails the `lane` check (§12.4). Commit once for the round, with
the message `Revise <ids>: <short reason>`, where `<ids>` lists every entry
the round changed, dropped, or regenerated, comma-separated.

- **Review comments:** push to the PR's branch. Never rewrite its history: no
  amend, rebase, or force-push.
- **Revise issue:** branch from `main` as `revise/<issue>-<YYYYMMDD>`
  (`revise/31-20261102`), push, and open a PR to `main` with the commit
  message as its title. Fill in `.github/PULL_REQUEST_TEMPLATE/content.md`
  and delete its comments:
  - **Entries:** one row per revised entry: name, type, the value at the
    type's `summaryField`, and the summary.
  - **Warnings:** every validator warning, and every `adjust` or damage
    `bonus` the revision added, with its reason. "None" if there are none.
  - Delete the **Gap fill** section.
  - `Closes #<issue>`.

The `content` label is applied from the branch prefix (§12.4); don't add
labels to the PR.

## Step 6: Reply

For review comments, after the push:

- Reply to each handled comment with what changed, in a sentence or two,
  naming the entries and the commit. For a comment that asked for no change,
  answer it. End every reply with `<!-- routine:handled -->` on its own line.
- Reply to an inline comment in its review thread, then resolve the thread
  if the round addressed it. Leave a thread open if the reply asks a
  question.
- Reply to general comments in the PR conversation. One reply may cover
  several general comments if it answers each of them.
- If a round dropped or regenerated an entry, update the PR body's
  **Entries** table to match.

For a revise issue, the PR's `Closes` line is the reply. Leave `in-progress`
on the issue if it has it: an open linked PR is what keeps the claim alive
(§8.2 step 7), and merging closes the issue.
