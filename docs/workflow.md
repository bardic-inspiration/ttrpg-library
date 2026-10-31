# Workflow

How a change gets from an idea to `main` — issues, branches, commits, pull
requests, CI, and merging — and how a spike explores without getting there.
Everything Git and GitHub lives here; the lane rules themselves are
[`SPEC.md`](../SPEC.md) §12.4 "Work lanes".

Every change takes the same path, whichever lane it's in
([`AGENTS.md`](../AGENTS.md) "How work happens"): a task, a branch, a PR with
a green `validate` check, a human merge — and one squash commit on `main` as
the record.

## Issues

An issue is a prompt that outlives its session: the task, written down where
the next session — or you, next month — can find it.

Content issues (`request`, `revise`) follow [`SPEC.md`](../SPEC.md) §8.1. The
rest of this section is about **dev-lane issues** — bug reports, feature
requests, and UI refinements:

- **A dev session files one for work it won't finish itself**; a task that
  comes from chat and lands in this session's PR needs no issue — the PR
  description carries it.
- **Sized for one PR.** If it won't fit, split it before starting.
- **Testable acceptance criteria**, derived from the `SPEC.md` section the
  issue cites. They're the failing tests to write first
  ([`testing.md`](testing.md)); if one can't become a test, it isn't specific
  enough yet.
- **Out of scope, stated** — the first guard against creep.
- **Dependencies** as a `Depends on #N` line.
- **Assigned to its milestone** ([`spec-driven-development.md`](spec-driven-development.md)
  "Milestones").
- **Ends with a `## TL;DR`:** a few plain-English bullets, no jargon — why it
  exists, and what changes once it's done.

The [templates](../.github/ISSUE_TEMPLATE/) lay these out — Bug report,
Feature request, UI refinement. Blank issues are off, so every issue starts in
a lane. The templates apply only in GitHub's web form; an agent filing through
the API writes the same sections itself and applies the label.

### Labels

Every label, and what it means, is defined in [`SPEC.md`](../SPEC.md): issue
labels in §8.1 "Requests as GitHub Issues", lane and area labels in §12.4.
Lane and area labels on PRs are applied automatically; `migration` is applied
by hand, never automatically.

### Closing

Issues close through a merged PR carrying `Closes #N`, which keeps the trail
from issue to commit intact. One that turns out invalid or superseded is
closed with a comment saying why, and the matching reason ("not planned",
"duplicate") — never deleted or left to go stale.

## Scope

Sessions don't remember each other, so nobody cleans up "temporary" scope
creep later — it just becomes permanent drift. Every PR is one concern, in
one lane:

- **Do what the task asks — nothing more.** A file the acceptance criteria
  don't touch isn't part of this PR, even if the change is one line and
  obviously right. No drive-by refactors, no "while I'm in here" fixes.
- **File, don't fold.** Anything worth doing that's out of scope becomes a new
  issue saying where it came from ("Surfaced while working #N"), and the PR
  gets one line pointing at it — not a `TODO`, not a note buried in the PR.
- **A PR that outgrows its task means the task was under-scoped.** Split the
  extra ground into issues rather than growing the PR.
- **Two lists name the tempting-but-out-of-scope work:** the spec's non-goals
  ([`SPEC.md`](../SPEC.md) §1.2) and later work ([`SPEC.md`](../SPEC.md)
  §16.1 "Later (post-v1)").

**When something unplanned comes up,** ask one question: does proceeding mean
guessing at behavior, or breaking a governing decision? **Yes** → stop, and
resolve it in the spec first
([`spec-driven-development.md`](spec-driven-development.md) "Using it").
**No** → keep going, and file the rest.

## Branches

- Branch from `main` with the lane's prefix ([`SPEC.md`](../SPEC.md) §12.4):
  `dev/<short-description>` for development (`dev/creature-schema`,
  `dev/fix-cr-sort`); `gen/`, `revise/`, and `manual/` for content, named as
  [`SPEC.md`](../SPEC.md) §8.4 and §8.5 say. Dependabot uses `dependabot/` on
  its own.
- The prefix decides the lane, and the lane check fails any other prefix — so
  a branch name an agent platform assigns doesn't stand in for one.
- One branch per PR. A spike's branch is `spike/<question>`
  ([Spikes](#spikes)).
- **Once pushed, a branch's history is shared** — another session may have it
  checked out. Add commits; never amend, rebase, or force-push. To catch up
  with `main`, merge it in (or use GitHub's "Update branch"); the squash
  absorbs the merge commit.

## Commits

`main` gets **one commit per PR**, because PRs land by squash merge with the
PR title as the commit message ([`SPEC.md`](../SPEC.md) §12.3). So
`git log --oneline` reads as the project's changelog, one line per change, in
two visibly distinct streams — content and development — and each line's
` (#N)` leads to the PR that holds the why.

**PR titles** follow the lane ([`SPEC.md`](../SPEC.md) §12.4):

| Lane | Title |
|---|---|
| Content | `Add <n> <type> entries` (mixed batches: `Add <n> entries`), or `Revise <ids>: <reason>` |
| Development | `<area>: <summary>` — for example `ui: tighten stat-block spacing` |

For a dev PR, `<area>` is its area label (`ui`, `ruleset`, `generation`,
`ci`) — or, where none applies, the part of the repo it changes (`docs`,
`spec`, `scripts`, `config`). The summary is imperative and lower-case, with
no trailing period.

**Branch commits** never reach `main`, so they need no particular format —
just a message that says what the step did, so a reviewer, or a session
picking the branch up mid-flight, can follow along. Routine commits use the
messages in [`SPEC.md`](../SPEC.md) §8.4 and §8.5.

## Pull requests

### The PR is the record

| PR field | Becomes | So write it as |
|---|---|---|
| Title | The commit on `main` | The lane's title form ([Commits](#commits)). |
| Description | The record the commit links to | What a reader of `git log` needs a year from now: what, why, where it came from, how it was tested, the TL;DR. No leftover template comments. |

If review changes the approach, **update the description before merge**, so
the record matches what landed.

### Opening one

- **Open it when the work is ready.** A routine's run isn't done until it has
  produced a PR. (Exception: you're told not to.)
- **Run the pre-flight checklist** (below) first.
- **Use the lane's template** — [`dev.md`](../.github/PULL_REQUEST_TEMPLATE/dev.md)
  for development; the content body is written by the routine
  ([`SPEC.md`](../SPEC.md) §8.4). Delete the sections that don't apply and
  every guidance comment.
- **Link its task:** `Closes #N` for an issue. A chat task with no issue
  states the task and its acceptance criteria in the Summary instead.
- **Say where it comes from** — the `SPEC.md` sections it implements or
  touches — so a reader can trace commit → PR → issue → spec.
- **Assign the milestone** for a dev PR.
- **End with a `## TL;DR`:** plain-English bullets — why, and what changes.

### Pre-flight checklist

This lives here rather than in the PR template, so it doesn't repeat in every
PR.

**Dev-lane code changes:**

- [ ] Tests written first, and passing; the dev-lane checks green
      ([`AGENTS.md`](../AGENTS.md) "Commands").
- [ ] `SPEC.md` describes the behavior as merged — updated if behavior
      changed.
- [ ] Other docs updated if behavior changed.
- [ ] One concern, in one lane, scoped to its task; the design principles and
      governing decisions still hold.
- [ ] No `content/` or `assets/images/` changes, unless this is a migration —
      labeled `migration`, with the body stating what changed in the entries
      and why.
- [ ] Screenshots attached, if the UI changed.
- [ ] Title and description written for `git log`.

**Docs-only changes:** every changed file is Markdown; links resolve and
cross-references are updated; no process narration in doc content
([`documentation.md`](documentation.md)).

### Screenshots (UI changes)

A `ui` PR includes 1–4 screenshots under `## Screenshots` — before/after for
fixes, both themes where colors changed, plus a phone-width view if the
layout differs. A session with no upload path commits them to
`dev/screenshots/pr-<N>/name.png` (open the PR first to get `<N>`) and links
by commit SHA, so the link survives the folder being pruned —
`https://github.com/bardic-inspiration/ttrpg-library/blob/<sha>/dev/screenshots/pr-<N>/<file>?raw=true`.
`npm run snapshots` captures the style guide and key pages for before/after
comparison ([`SPEC.md`](../SPEC.md) §9.8).

## Watching CI

**A PR you open is yours until it's merged or closed.** Opening it isn't the
end of the task: with several PRs open at once, each merge moves `main` under
the others, and a PR that was green an hour ago may not be now.

- **Red check** → read the log and the job summary, fix the cause on the same
  branch, push. Never skip, disable, or weaken a check to get green. If the
  failure isn't this PR's (it's red on `main` too), say so once on the PR
  instead of fixing it here.
- **Lane check red** → the branch prefix or the changed paths don't fit the
  lane. Fix the branch or the diff; for a deliberate migration, ask for the
  `migration` label — adding it re-runs the check.
- **Behind `main`, or conflicting** → merge `main` in, resolve, re-run the
  lane's checks, push.
- **Review comments** → fix and push, or answer why not, on the thread.
  Routines handle content PR comments as [`SPEC.md`](../SPEC.md) §8.5 says.
- **Blocked on something only a human can decide** → say so once on the PR,
  and stop.

**Spike PRs are the exception** ([Spikes](#spikes)): they're red by design, so
nobody watches or "fixes" them.

In a dev session, tell the user where things stand; in a routine, the PR's own
comments are the report. How a session watches is tool-specific — for Claude
Code, see [`CLAUDE.md`](../CLAUDE.md).

## Merging

- **A human reviews and merges** — the merge is the approval; there are no
  required approving reviews ([`SPEC.md`](../SPEC.md) §12.3). Agents open and
  fix PRs; they don't merge them.
- Merge when `validate` is green on the latest commit, the branch is up to
  date with `main`, and review threads are resolved.
- Land with **"Squash and merge,"** and check the commit message reads well
  on `main`.
- **Dependency updates** from Dependabot need no issue: read what changed, and
  merge when green.

## Docs-only changes

A change is **docs-only** when every changed file ends in `.md`. Anything
else in the diff — code, tests, config, a workflow, a lockfile — makes it a
code change. When in doubt, it's a code change. Guidelines
(`rulesets/*/guidelines/*.md`), skills, and `docs/routines.md` are Markdown
but change generation behavior, so they're reviewed as behavior, under the
`generation` label ([`SPEC.md`](../SPEC.md) §12.4).

- **Skip:** writing tests first. CI still runs the full dev-lane checks.
- **Issues:** a substantive change (a new doc, a rule change) gets one, filed
  as a feature request; a trivial fix (a typo, a broken link) doesn't.
- **A `SPEC.md` change** follows
  [`spec-driven-development.md`](spec-driven-development.md).
- **Still required:** correct content, links that resolve, cross-references
  updated in the same PR, no process narration in doc content, and the TL;DR.

## Spikes

A spike spends cheap code to buy understanding: whether an approach works,
which of several designs to pick, what an interface feels like to use. It's
the one place code is written to be thrown away — so it's the one place the
rules above are off. What crosses into `main` is what you learned, never the
code.

1. **Start from a question, not a task:** "Can `html-to-image` capture the
   stat block faithfully?" "A, B, or C?" Branch `spike/<question>`.
2. **Explore freely.** No issue, no tests first, no scope rules, messy commits
   welcome. Competing approaches can run as parallel spikes.
3. **Time-box it** to a session or an afternoon. A spike that keeps growing is
   answering the wrong question.
4. **Open a draft PR titled `spike: <the question>`** and write the findings
   in its description — the one required output:

   ```markdown
   ## Question
   ## What I tried
   ## What worked, and what didn't
   ## Recommendation
   ## Follow-ups   <!-- the spec edits and issues this led to -->
   ```

5. **Turn the findings into the real path:** edit the spec in a docs-only PR,
   and file issues for the work ("Explored in #N").
6. **Close the spike PR unmerged**, linking the follow-ups, and delete the
   branch. The closed PR keeps the diff and the findings on GitHub for good.

The real work then goes through the normal loop — test first, the checks, a
PR. A session may read the spike for reference, but it rewrites the code
rather than merging it.

**The guard.** `spike/` isn't a lane prefix, so the lane check fails the
required `validate` status and a spike can't be merged by accident
([`SPEC.md`](../SPEC.md) §12.4). It catches accidents, not decisions:
promoting a spike means rebuilding it through the normal loop, not renaming
its branch.
