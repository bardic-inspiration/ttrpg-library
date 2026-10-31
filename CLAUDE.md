# CLAUDE.md

[`AGENTS.md`](AGENTS.md) is the working guide for any agent, and holds the
rules [`SPEC.md`](SPEC.md) §14 requires of every Claude session:

@AGENTS.md

What follows is specific to Claude Code.

## Branch names in cloud sessions

A cloud session is assigned a branch name (`claude/...`) that isn't a lane
prefix, so the lane check would fail its PR. Don't use it. Branch from `main`
with the lane's name instead: `dev/<short-description>` for development, or
the `gen/` or `revise/` name [`SPEC.md`](SPEC.md) §8.4 and §8.5 give a
routine. Push and open the PR from that branch. This instruction is the
explicit permission to push to a branch other than the assigned one. Never
push to the assigned branch at all: a session can't delete a remote branch.

## Watching PRs

After opening a dev PR, subscribe to its activity (`subscribe_pr_activity`)
and end the turn; fix CI failures, conflicts, and review comments as they
arrive. Unsubscribe once the PR is merged or closed. A routine may subscribe
to its content PR too, but the run-order sweep is what guarantees comments get
handled ([`SPEC.md`](SPEC.md) §8.5).

## Sub-issues

Attach a task issue to its milestone issue with `sub_issue_write`, and read
progress with `issue_read` (`get_sub_issues`).

## Configuration and skills

- [`.claude/settings.json`](.claude/settings.json) pre-approves the npm
  scripts and read-only git, and blocks force-pushes and reading `.env`
  files.
- [`.claude/hooks/session-start.sh`](.claude/hooks/session-start.sh)
  installs dependencies when a cloud session starts.
- [`ask-me`](.claude/skills/ask-me/SKILL.md) interviews the user when a goal
  is still fuzzy. [`grill-me`](.claude/skills/grill-me/SKILL.md)
  stress-tests a plan before it's built.
