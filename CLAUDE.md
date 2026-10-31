# CLAUDE.md

Claude Code–specific notes. [`AGENTS.md`](AGENTS.md) is the canonical guide,
written to work with any agent, and holds the rules [`SPEC.md`](SPEC.md) §14
requires of every Claude session; Claude Code loads only this file on its
own, so it imports the guide here:

@AGENTS.md

This file adds only what's specific to Claude Code.

## Watching PRs

After opening a dev-lane PR, subscribe to its activity
(`subscribe_pr_activity`) and end the turn. CI results, review comments, and
merge conflicts wake the session; handle each one as
[`docs/workflow.md`](docs/workflow.md) "Watching CI" says. Unsubscribe once
the PR is merged or closed. Don't subscribe to a spike's draft PR — it's red
by design.

A routine may subscribe to the content PR it opened for faster turnaround,
but the run-order sweep is what guarantees review comments get handled
([`SPEC.md`](SPEC.md) §8.5).

Without that tool (a local session), check before handing back:
`gh pr checks <number> --watch`.

## Milestones

Dev-lane issues and PRs are assigned to the GitHub milestone for their
[`SPEC.md`](SPEC.md) §16 milestone: set `milestone` when filing with
`issue_write`, and on the PR
([`docs/spec-driven-development.md`](docs/spec-driven-development.md)
"Milestones"). Content issues carry none.

## Configuration

| File | What it does |
|---|---|
| [`.claude/settings.json`](.claude/settings.json) | Pre-approves the npm scripts CI runs, single-test runs, and read-only git, so sessions don't stop for permission. Blocks force-pushes and reading `.env` files — the common forms; branch protection on GitHub is the real guard for `main`. |
| [`.claude/hooks/session-start.sh`](.claude/hooks/session-start.sh) | In cloud sessions, installs dependencies at startup so the checks can run. |

## Skills

Project skills live in [`.claude/skills/`](.claude/skills/). The content
skills, `generate` and `revise`, are specified in [`SPEC.md`](SPEC.md) §8.4
and §8.5.

| Skill | When |
|---|---|
| [`ask-me`](.claude/skills/ask-me/SKILL.md) | The goal or scope is still fuzzy — interview to form intent before any plan exists. |
| [`grill-me`](.claude/skills/grill-me/SKILL.md) | A plan exists — stress-test it for failure modes before building it. |
