# AGENTS.md — Canonical Guide for AI Coding Agents

This is the **authoritative guide** for how work is done in this repository, by
agents or humans. If another doc disagrees with this one, this one wins —
except that [`SPEC.md`](SPEC.md) is the source of truth for *what to build*,
including the CI, lanes, and repository settings it specifies; this file is
the source of truth for *how to work*.

Work is done by AI sessions that start with no memory of earlier ones.
Nothing carries over except what's in the repo and on GitHub — issues, PRs,
review threads, and the commit history — so every rule below exists to make
one session's work legible to the next.

## Purpose & scope

What the project is, and what it deliberately isn't, lives in one place:
[`SPEC.md`](SPEC.md) §1 "Summary" and §1.2 "Non-goals for v1". The delivery
plan is [`SPEC.md`](SPEC.md) §16, mirrored by GitHub milestones
([`docs/spec-driven-development.md`](docs/spec-driven-development.md)
"Milestones").

## Two lanes

One repo holds two kinds of work, kept apart by branch prefix, labels, and a
CI lane check ([`SPEC.md`](SPEC.md) §12.4 "Work lanes" is the contract):

- **Content** — entries and art under `content/` and `assets/images/`. Opened
  by routines on `gen/` and `revise/` branches (or by hand on `manual/`),
  through the `generate` and `revise` skills.
- **Development** — everything else: the ruleset module, config, site,
  scripts, workflows, skills, docs, and the spec. Worked in sessions you start,
  on `dev/` branches.

A PR is in exactly one lane. A dev PR touches content only as a deliberate
migration, with the `migration` label — ask for it; it's applied by hand.

## How work happens

Two modes build; a spike explores. Every change reaches `main` the same way
— a PR, a green `validate` check, a human merge — whichever mode produced it.
A spike never reaches `main` at all ([`docs/workflow.md`](docs/workflow.md)
"Spikes").

| | Dev session | Content routine | Spike |
|---|---|---|---|
| Lane | Development | Content | Neither — never merges |
| Who's there | The user, in the loop | Nobody, until review | Usually the user |
| Where the task comes from | Chat, or a dev-lane issue (`bug`, `feature`, `ui`) | `request` and `revise` issues, review comments, or the gap-filler ([`SPEC.md`](SPEC.md) §8.2 "Routine run order") | A question |
| Where the task is recorded | The PR description — file an issue only for work this session won't do | The issue, and the PR body | The findings, in a draft PR |
| When blocked | Ask the user | One question on the issue, `needs-info`, move on ([`SPEC.md`](SPEC.md) §8.2) | Record it — a dead end is a finding |
| After opening the PR | Watch CI to green, and report | Revise from review comments ([`SPEC.md`](SPEC.md) §8.5) | File the follow-ups, then close it unmerged |

The thread through all three: **the task is the prompt, the PR is the
response, review is the evaluation, and the squash commit on `main` is the
record** — for a spike, the closed PR's findings are the record.

## Hard rules

These hold for every change, whatever the task says. A change that breaks one
is wrong even if CI is green.

- **Never push to `main`.** Every change is a PR; a human merges it.
- **One lane per PR**, on a branch with that lane's prefix
  ([`SPEC.md`](SPEC.md) §12.4).
- **Red CI is never merged**, and tests or checks are never skipped,
  disabled, or weakened to get green ([`docs/ci.md`](docs/ci.md)).
- **Don't silently invent behavior.** If the spec or the task is ambiguous or
  looks wrong, resolve it in the spec rather than guessing in code.
- **The spec's design principles and governing decisions hold** —
  [`SPEC.md`](SPEC.md) §1.3 "Design principles" and §2 "Governing decisions".
- **One concern per PR**, and only what its task asks for
  ([`docs/workflow.md`](docs/workflow.md) "Scope").
- **A dev PR that changes behavior updates `SPEC.md` in the same PR**, and
  uses the `dev.md` PR template.
- **A PR you open is yours until it's merged or closed** — watch its CI and
  fix what fails ([`docs/workflow.md`](docs/workflow.md) "Watching CI").
- **Spike code never merges.** A spike's output is its findings; the real
  work is rebuilt through the working loop.
- **The repo is the memory.** Decisions, follow-ups, and open questions go
  into the spec, issues, and PR descriptions — never only into a chat the next
  session can't see.

### Content rules

For every change to an entry, by a routine or by hand:

- Generate and revise content through the `generate` and `revise` skills, and
  follow them exactly ([`SPEC.md`](SPEC.md) §8.4, §8.5).
- Routines take only `request` and `revise` issues; dev-lane issues are for
  dev sessions.
- **Never change an entry's `id` or move its file.**
- **Never write a value the ruleset derives.** Write inputs, use tokens for
  derived numbers in prose, and use `adjust` only for a deliberate deviation
  ([`SPEC.md`](SPEC.md) §6.1, §6.4).
- **Run `npm run validate` before every push**; never push a failing batch.
- SRD-only rules and the blocklist apply to every text field
  ([`SPEC.md`](SPEC.md) §11).
- Mark review replies with `<!-- routine:handled -->` ([`SPEC.md`](SPEC.md)
  §8.5).

## Repo layout

[`SPEC.md`](SPEC.md) §4 "Repository structure" is the map. The working-guide
files on top of it:

```
/
├── AGENTS.md          # this file — how to work
├── SPEC.md            # what to build
├── CLAUDE.md          # Claude Code: imports this file, adds tool specifics
├── CONTRIBUTING.md    # setup for humans
├── docs/              # protocol docs (routing table below)
└── .claude/           # Claude Code settings, hooks, skills
```

## Working loop (dev lane)

1. **Take one task** — from chat, or a dev-lane issue.
2. **Read before you write:** the task, the `SPEC.md` sections it cites, and
   every doc it references. `git log` on the files you'll touch is context
   too — each commit on `main` is one whole PR.
3. **Branch from `main`** as `dev/<short-description>`
   ([`docs/workflow.md`](docs/workflow.md) "Branches").
4. **Test first.** A failing test, the minimal code to pass it, then refactor
   ([`docs/testing.md`](docs/testing.md)).
5. **Run the dev-lane checks** (Commands, below). Green before every push.
6. **Open one PR** from the `dev.md` template. Its title becomes the commit on
   `main` ([`docs/workflow.md`](docs/workflow.md) "Pull requests"). If it
   changes behavior, it updates `SPEC.md` too.
7. **Watch it to green** — fix red CI and conflicts on the same branch, answer
   review. A human merges.

Changing only Markdown? Step 4 doesn't apply
([`docs/workflow.md`](docs/workflow.md) "Docs-only changes"). Running a spike?
This loop doesn't apply at all ([`docs/workflow.md`](docs/workflow.md)
"Spikes"). The content lane's loop is the routine run order
([`SPEC.md`](SPEC.md) §8.2).

### Protocol docs — read when

| Read | When |
|---|---|
| [`docs/spec-driven-development.md`](docs/spec-driven-development.md) | Reading, writing, or changing `SPEC.md`; the spec is silent or wrong; tracking work against milestones. |
| [`docs/workflow.md`](docs/workflow.md) | Anything Git or GitHub: issues, scope, branching, committing, opening or watching a PR, merging, docs-only changes, spikes. |
| [`docs/testing.md`](docs/testing.md) | Writing tests or fixtures. |
| [`docs/ci.md`](docs/ci.md) | Changing CI or the npm scripts it runs; CI fails in a way you don't understand. |
| [`docs/documentation.md`](docs/documentation.md) | Writing or editing any doc, naming files or identifiers, auditing docs for drift. |

## Commands

The npm scripts are defined in [`SPEC.md`](SPEC.md) §4.

| Task | Command |
|---|---|
| Install | `npm ci` |
| Validate every entry | `npm run validate` |
| Build the index and the site | `npm run build` |
| Types, `astro check`, Stylelint | `npm run check` |
| Unit tests, including contrast | `npm test` |
| Run one test file, or a few | `npm test -- <path-or-pattern>` |
| Accessibility checks on the built site | `npm run a11y` |
| Run the site locally | `npm run dev` |
| Visual snapshots, on demand | `npm run snapshots` |

**Before every push**, run what CI runs for the PR's lane
([`docs/ci.md`](docs/ci.md)):

- **Content lane:** `npm run validate` and `npm run build`.
- **Dev lane:** those two, then `npm run check`, `npm test`, and
  `npm run a11y`.

No script modifies tracked files, so green locally means green in CI.

## When in doubt

- **The spec is silent, ambiguous, or wrong** → don't guess. If proceeding
  means guessing at behavior or breaking a governing decision, stop: raise it
  (with the user, or on the issue), and resolve it by editing the spec before
  writing code that depends on it
  ([`docs/spec-driven-development.md`](docs/spec-driven-development.md)).
- **Adjacent work** — an edge case, a follow-on idea, tech debt — becomes its
  own issue, not a `TODO` and not part of this PR
  ([`docs/workflow.md`](docs/workflow.md) "Scope").
- **Doc drift you spot while working** → fix it in a separate docs-only PR,
  or file it ([`docs/documentation.md`](docs/documentation.md) "Doc audit").
