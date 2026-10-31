# AGENTS.md

How work is done in this repo, by agents or humans. [`SPEC.md`](SPEC.md) is
the source of truth for *what to build*, including CI, lanes, labels, and
repository settings; this file covers *how to work*, and defers to the spec
wherever they overlap.

Sessions start with no memory of earlier ones. Decisions, follow-ups, and
open questions go into the spec, issues, and PR descriptions, never only into
a chat.

## Lanes

Every PR is in exactly one lane ([`SPEC.md`](SPEC.md) §12.4 "Work lanes"):

- **Content:** entries and art under `content/` and `assets/images/`.
  Routines open these PRs on `gen/` and `revise/` branches, using the
  `generate` and `revise` skills ([`SPEC.md`](SPEC.md) §8). Hand-made
  entries go on `manual/` branches.
- **Development:** everything else, including the spec and docs, on
  `dev/<short-description>` branches. A dev PR touches content only as a
  deliberate migration with the `migration` label, which a human applies.

## Rules

- **Never push to `main`.** Every change is a PR; a human merges it once
  `validate` is green.
- **Don't invent behavior.** If the spec is silent, ambiguous, or wrong, ask
  (the user, or on the issue) and fix the spec before writing code that
  depends on it.
- **A dev PR that changes behavior updates `SPEC.md` in the same PR.**
- **One concern per PR.** Out-of-scope work becomes an issue, not a `TODO`
  or a drive-by change.
- **Never skip, disable, or weaken a test or check to get green.**
- **Never rewrite pushed history** (no amend, rebase, or force-push). To catch
  up with `main`, merge it in.

### Content rules

These come from [`SPEC.md`](SPEC.md) §14:

- Generate and revise content only through the `generate` and `revise`
  skills, and follow them exactly.
- Routines take only `request` and `revise` issues.
- **Never change an entry's `id` or move its file.**
- **Never write a value the ruleset derives.** Write inputs, use tokens for
  derived numbers in prose, and use `adjust` only for a deliberate deviation
  ([`SPEC.md`](SPEC.md) §6.1, §6.4).
- Run `npm run validate` before every push; never push a failing batch.
- SRD-only rules and the blocklist apply to every text field
  ([`SPEC.md`](SPEC.md) §11).
- Mark review replies with `<!-- routine:handled -->`.

## Dev workflow

1. **Read** the task and the spec sections it touches.
2. **Branch** from `main` as `dev/<short-description>`.
3. **Write tests first** for new behavior, using Vitest suites and fixtures
   in `tests/`. Bug fixes come with a test that fails before the fix.
4. **Run the dev-lane checks** (below) before every push.
5. **Open a PR** from the [`dev.md`](.github/PULL_REQUEST_TEMPLATE/dev.md)
   template, titled `<area>: <summary>`. Use the area label as `<area>`
   (`ui`, `ruleset`, `generation`, `ci`), or `docs`, `spec`, `scripts`, or
   `config` where none fits. PRs are squash-merged with the title as the
   commit message, so `git log` on `main` reads one line per change. Link
   the issue with `Closes #N`.
6. **Watch it to green.** Fix red CI and conflicts on the same branch, and
   answer review comments.

Docs-only changes skip step 3. To explore an idea without committing to it,
use a `spike/<question>` branch and a draft PR. The lane check rejects that
prefix, so a spike can't merge. Record what you learned, then close the PR.

## Tracking work

The delivery plan is [`SPEC.md`](SPEC.md) §16. Each milestone there is one
GitHub issue. If it needs more than one PR, its tasks become sub-issues.
Content issues follow [`SPEC.md`](SPEC.md) §8.1.

A dev issue states what to do, the spec section it implements, and how to
tell it's done.

### The dev queue

The milestone issues, in [`SPEC.md`](SPEC.md) §16 order, and their
sub-issues, in the order GitHub lists them, form one queue. Every open dev
issue has a place in it. Nothing lives outside the tree except post-v1 work,
which sits under a "Later (post-v1)" issue (§16.1), opened the first time
it's needed.

**Placing a new issue.** Whoever opens a dev issue attaches it as a
sub-issue where it has to land (`sub_issue_write`, `add`), then moves it into
position (`reprioritize`). Don't just add it to the end. Put it:

- before the first issue that depends on it, in the same milestone or an
  earlier one;
- at the front of the current milestone if it fixes or follows up merged
  work;
- under "Later (post-v1)" if v1 doesn't need it.

Then comment on the issue to say where it went and why. If the right place
is a judgment call, leave it unattached and ask the user.

**Picking the next issue.** A dev session, scheduled or interactive:

1. **Triages.** It lists open dev issues with no parent, and places each one
   whose place is clear, as above. It reports the rest to the user, every
   run, until they're placed.
2. **Picks.** It walks the queue depth-first and takes the first open issue
   that:
   - is a task rather than a parent with open sub-issues;
   - has no open PR;
   - has every dependency it names already merged.

   A milestone whose tasks are all closed doesn't block later ones, even if
   items in its "Done when" are still open because they wait on a human
   (repository settings, a manual check). Say what's waiting instead.
3. **Checks open PRs first.** If the picked issue already has an open PR,
   handle the PR's CI and review comments instead of starting new work. If
   the PR is only waiting on human review, that is the bottleneck: stop and
   say so.

## Commands

The npm scripts are defined in [`SPEC.md`](SPEC.md) §4.

| Task | Command |
|---|---|
| Install | `npm ci` |
| Validate every entry | `npm run validate` |
| Build the index and the site | `npm run build` |
| Types, `astro check`, Stylelint | `npm run check` |
| Unit tests, including contrast | `npm test` (one file: `npm test -- <path>`) |
| Accessibility checks on the built site | `npm run a11y` |
| Run the site locally | `npm run dev` |

**Before every push**, run what CI runs for the lane
([`SPEC.md`](SPEC.md) §12.1):

- **Content:** `npm run validate` and `npm run build`.
- **Dev:** those two, then `npm run check`, `npm test`, and `npm run a11y`.
