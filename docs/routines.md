# Routines

Routines are scheduled or on-demand Claude Code sessions that work the
content lane: they turn `request` and `revise` issues into content PRs and
answer review comments on them. This file holds the canonical prompts, the
schedule, and the run order every run follows. `SPEC.md` §8 is the source of
truth; where this file and the spec disagree, the spec wins and this file is
fixed.

The prompts below are short on purpose. They tell the run to follow
[Run order](#run-order) in this file, which the run reads from `main`, so a
change to the run order lands through a reviewed PR here instead of by
editing the routine's settings.

## Schedule

| Routine | When | Batch |
|---|---|---|
| Scheduled | Weekly, Monday morning local time, one run | `defaults.count` (5) per request, never above `defaults.maxBatch` (10) in total |
| On-demand | Whenever you start it | Same, for the issues or inline request you name |

Both routines use the same prompt (§8.7). The on-demand routine adds its
inputs after it.

## Setup

Create each routine as a scheduled task in Claude Code on the web (see the
[Claude Code on the web docs](https://code.claude.com/docs/en/claude-code-on-the-web)):

- **Repository:** this repository, with GitHub access that can push branches,
  open PRs, label and comment on issues, and reply to review comments.
- **Environment:** network access to the npm registry, so the session-start
  hook (`.claude/hooks/session-start.sh`) can install dependencies.
- **Trigger:** for the scheduled routine, a weekly schedule on Monday
  morning in your time zone. The on-demand routine has no schedule; run it by
  hand.
- **Prompt:** the [scheduled prompt](#scheduled-prompt) as written, or for an
  on-demand run, the [on-demand prompt](#on-demand-prompt) with its inputs
  filled in.

Routines work only the content lane (§12.4). They take only `request` and
`revise` issues, never dev-lane issues (bugs, features, UI refinement). They
push only to `gen/` and `revise/` branches, named as the `generate` and
`revise` skills say. A cloud session is assigned a branch of its own; a
routine never pushes to it, or to `main` (`CLAUDE.md`).

## Scheduled prompt

```text
Run the content routine for this repository. Read docs/routines.md on main and follow its "Run order" section exactly, step by step. Work only the content lane: take only `request` and `revise` issues, push only `gen/` and `revise/` branches, and never push to main or to this session's assigned branch. If a step fails in a way you can't recover from, stop and report which step and why. End with a short report: PRs opened or updated, issues claimed, questions asked, and steps skipped.
```

## On-demand prompt

The scheduled prompt, followed by one of these input lines. With no input
line, an on-demand run is the same as a scheduled run.

Named issues:

```text
Run the content routine for this repository. Read docs/routines.md on main and follow its "Run order" section exactly, step by step. Work only the content lane: take only `request` and `revise` issues, push only `gen/` and `revise/` branches, and never push to main or to this session's assigned branch. If a step fails in a way you can't recover from, stop and report which step and why. End with a short report: PRs opened or updated, issues claimed, questions asked, and steps skipped.

Issues: #12, #14
```

Inline request:

```text
Run the content routine for this repository. Read docs/routines.md on main and follow its "Run order" section exactly, step by step. Work only the content lane: take only `request` and `revise` issues, push only `gen/` and `revise/` branches, and never push to main or to this session's assigned branch. If a step fails in a way you can't recover from, stop and report which step and why. End with a short report: PRs opened or updated, issues claimed, questions asked, and steps skipped.

Inline request: type: spell; count: 3; brief: frost-themed utility spells for levels 1 to 3; tags: theme: winter
```

An inline request takes the content-request fields (§8.1): type, count,
brief, tags, and ruleset. Type and brief are required; the others default.

## Run order

Every run, scheduled or on-demand, follows these steps in order (§8.2), so
review feedback is never starved by new work. A step marked **Not yet
available** depends on Milestone 6 (#15); skip it and say so in the report.

`defaults.<key>` below means that key of `config/defaults.json`.

### 1. Sync

Fetch `main` and work from it. Run `npm ci`, then `npm run build:index` to
build `site/public/library.json`, the current library.

### 2. Revisions first

**Not yet available.** For each open PR on a `gen/` or `revise/` branch,
this step will find owner comments not yet handled and apply them with the
`revise` skill (§8.5).

### 3. Revise requests

**Not yet available.** This step will take open `revise` issues, each
becoming a small PR on a `revise/` branch, with the `revise` skill (§8.5).

### 4. Content requests

Pick the batch:

- **Scheduled run, or on-demand with no inputs:** open `request` issues
  without `needs-info`, and without `in-progress` unless the claim is stale
  (step 7). Take `priority:high` issues first, then oldest first. Resolve
  each issue's count as the `generate` skill says (`defaults.count` when
  blank, at most `defaults.maxBatch`), and add issues to the batch while the
  total count stays at or below `defaults.maxBatch`.
- **On-demand with named issues:** only the named issues. Each must be an
  open `request` issue without `needs-info`; report any other and leave it
  alone. If their total count is above `defaults.maxBatch`, take them in the
  order named while the total fits, and report the rest as left for a later
  run.
- **On-demand with an inline request:** the inline request alone, as if it
  were an issue but without one.

Claim each picked issue: add the `in-progress` label and comment that this
run has picked it up. Then run the `generate` skill
(`.claude/skills/generate/SKILL.md`) on the batch. It writes the entries,
validates them, and opens the content PR, or reports why it couldn't.

### 5. Gap-fill

**Not yet available.** If no requests were picked in step 4 and
`defaults.gapFill.enabled` is true, this step will choose the type and gap
bucket with the fewest entries (§7.1) and run the `generate` skill on it for
`defaults.gapFill.count` entries. An on-demand run with named issues or an
inline request never gap-fills.

### 6. Ambiguity

If a request can't be fulfilled as written (contradictory constraints, an
unknown type or ruleset), comment a single question on the issue, add
`needs-info`, remove `in-progress`, and move on without it. The `generate`
skill does this for requests in its batch. For an inline request, report the
question instead.

### 7. Stale claims

An `in-progress` issue with no open linked PR after 24 hours is treated as
unclaimed, so step 4 may pick it again. Check this while picking in step 4.
