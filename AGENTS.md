# AGENTS.md

How work is done in this repo, by agents or humans. [`docs/`](docs/README.md)
describes *what is built*, including CI, lanes, labels, and repository
settings, and [`spec/v2/`](spec/v2/README.md) holds the design that isn't
built yet. This file covers *how to work*, and defers to them wherever they
overlap.

Sessions start with no memory of earlier ones. Decisions, follow-ups, and
open questions go into the docs, the stage spec, issues, and PR descriptions,
never only into a chat.

## Lanes

Every PR is in exactly one lane ([Work lanes](docs/workflow.md#work-lanes)):

- **Content:** entries and art under `content/` and `assets/images/`.
  Routines open these PRs on `gen/` and `revise/` branches, using the
  `generate` and `revise` skills ([`docs/generation.md`](docs/generation.md)). Hand-made
  entries go on `manual/` branches.
- **Development:** everything else, including the docs and the stage spec, on
  `dev/<short-description>` branches. A dev PR touches content only as a
  deliberate migration; the labeler adds the `migration` label to it.

## Rules

- **Never push to `main`.** Every change is a PR.
- **Don't invent behavior.** When the docs or the stage spec are silent,
  ambiguous, or wrong,
  ask whether a different reasonable choice would change behavior that
  something else depends on.
  - If it wouldn't, decide by the principles in
    [`docs/decisions.md`](docs/decisions.md) and record the choice in the
    PR's "Decisions" section. The owner's merge confirms it.
  - If it would, stop that item and ask (the user, or on the issue). Fix the
    stage spec before writing code that depends on it. For v2 design, the question
    goes into the area's "Open questions" in [`spec/v2/`](spec/v2/README.md)
    through a small PR. Carry on with the items that are clear.
- **Record decisions where they're made.** A PR that makes a decision lists
  it under "Decisions" and adds its row to
  [`docs/decisions.md`](docs/decisions.md) in the same PR.
- **A dev PR that changes behavior updates the docs in the same PR.** It
  describes what now exists in `docs/`, and deletes the part it built from
  the stage spec, so `main` is complete after every merge.
- **One issue per PR.** Out-of-scope work becomes an issue, not a `TODO`
  or a drive-by change. An issue that lists several items gets one PR, not
  one per item (see "Tracking work").
- **Never skip, disable, or weaken a test or check to get green.**
- **Never rewrite pushed history** (no amend, rebase, or force-push). To catch
  up with `main`, merge it in.

### Content rules

Every content session, routine or not, follows these:

- Generate and revise content only through the `generate` and `revise`
  skills, and follow them exactly.
- Routines take only `request` and `revise` issues.
- **Never change an entry's `id` or move its file.**
- **Never write a value the ruleset derives.** Write inputs, use tokens for
  derived numbers in prose, and use `adjust` only for a deliberate deviation
  ([Inputs and derived values](docs/rulesets.md#inputs-and-derived-values),
  [Text tokens](docs/rulesets.md#text-tokens)).
- Run `npm run validate` before every push; never push a failing batch.
- SRD-only rules and the blocklist apply to every text field
  ([Blocklist](docs/licensing.md#blocklist)).
- SRD entries are reproduced unmodified; custom entries never reuse an SRD
  entry's exact name or an SRD proper noun
  ([SRD and custom entries](docs/content-model.md#srd-and-custom-entries)).
- Mark review replies with `<!-- routine:handled -->`.

## Dev workflow

1. **Read** the task and the docs and stage spec sections it touches.
2. **Branch** from `main` as `dev/<short-description>`.
3. **Write tests first** for new behavior, using Vitest suites and fixtures
   in `tests/`. Bug fixes come with a test that fails before the fix.
4. **Update the docs as you go.** In the same PR, update the `docs/` files
   that describe what changed, delete the part you built from the stage spec,
   and add a row to `docs/decisions.md` for each decision the PR makes (see
   "Rules"). A renamed heading means updating its citations; the link check
   catches any you miss.
5. **Run the dev-lane checks** (below) before every push.
6. **Open a PR** from the [`dev.md`](.github/PULL_REQUEST_TEMPLATE/dev.md)
   template, titled `<area>: <summary>`. Use the area label as `<area>`
   (`ui`, `ruleset`, `generation`, `ci`), or `docs`, `spec`, `scripts`, or
   `config` where none fits. PRs are squash-merged with the title as the
   commit message, so `git log` on `main` reads one line per change. Link
   the issue with `Closes #N`.
7. **Watch it to green.** Fix red CI and conflicts on the same branch, and
   answer review comments.

Docs-only changes skip step 3. To explore an idea without committing to it,
use a `spike/<question>` branch and a draft PR. The lane check rejects that
prefix, so a spike can't merge. Record what you learned, then close the PR.

## Tracking work

Each milestone is a tracking issue holding its "done when" and its tasks as
ordered sub-issues. GitHub's milestone feature isn't used. Content issues
follow [Requests](docs/generation.md#requests).

A dev issue states what to do, the docs or stage spec section it implements,
and how to tell it's done.

Bundle small related dev issues (a few lines each, same area) into one issue
and one PR, and close the originals as duplicates. Only a larger change stays
a sub-issue of the bundle, with its own PR.

An issue with several items, such as a list of problems found in one pass, is
fixed in one PR with one commit per item, so each reads on its own in review
and the owner merges once. Title it by the area most of it touches. An item
waiting on a spec decision doesn't hold up the rest: open the PR with the
items that are ready, and add the others as commits once they're decided, or
in a follow-up PR if the first has merged. Split an item into its own
sub-issue and PR only when it's too large to review alongside the others.

### Stage spec

The v2 design lives in [`spec/v2/`](spec/v2/README.md), one file per design
area. An approved design can be amended at any time by a small PR to it that
the owner merges. Each build milestone starts with a pilot task on its area's
hardest cases, which is expected to turn up amendments.

### Testing backlog

Checks that need a human or a live service, such as repository settings
(branch protection, Pages source) or behavior seen only on GitHub, are not
milestone completion criteria. A milestone's "done when" lists only what its
own PRs and CI can prove. File each such check as its own issue, and
aggregate related checks into one issue with a checklist where possible. Keep
them under a "Testing backlog" issue, outside the dev queue's pick order, so
a pending manual check never blocks a milestone or the next task.

### Dev Queue

Milestone issues, in milestone order, and their sub-issues (GitHub's order)
are one queue. Work beyond v2 goes under the "Later (v3)" issue (#118),
outside the queue.

- **Place** every new dev issue with `sub_issue_write`. Put it before the
  first issue that depends on it, and say why in a comment. If unsure, leave
  it unattached and ask the user.
- **Pick:** place any unparented issues first, then take the first open
  task, depth-first, with no unmerged dependency. If it has an open PR, work
  that PR's CI and comments instead. If that PR is only waiting on human
  review, stop and say so. A milestone waiting only on a human check doesn't
  block the next one.

## Commands

The npm scripts are listed in
[Repository layout](docs/architecture.md#repository-layout).

| Task | Command |
|---|---|
| Install | `npm ci` |
| Validate every entry | `npm run validate` |
| Build the index and the site | `npm run build` |
| Types, `astro check`, Stylelint, links | `npm run check` |
| Cited docs, headings, and links resolve | `npm run links` |
| Unit tests, including contrast | `npm test` (one file: `npm test -- <path>`) |
| Accessibility checks on the built site | `npm run a11y` |
| Run the site locally | `npm run dev` |

**Before every push**, run what CI runs for the lane
([CI checks](docs/workflow.md#ci-checks)):

- **Content:** `npm run validate` and `npm run build`.
- **Dev:** those two, then `npm run check` and `npm test`. The PR that
  closes a milestone also runs `npm run a11y` and gets the `milestone` label
  ([Milestone PRs](docs/workflow.md#milestone-prs)).
- **Docs-only** (only root Markdown, `docs/` other than `docs/routines.md`,
  and the dev and Markdown issue templates;
  [Docs-only PRs](docs/workflow.md#docs-only-prs)): CI runs only the lane
  rules and the link check, so run `npm run links`.
- **Text-only** (docs plus Markdown under `spec/`, `.claude/skills/`, or the
  guidelines, `docs/routines.md`, or the content PR template;
  [Text-only PRs](docs/workflow.md#text-only-prs)): `npm run links` and
  `npm test`.
