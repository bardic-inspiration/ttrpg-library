# CLAUDE.md

[`AGENTS.md`](AGENTS.md) is the working guide for any agent, and holds the
rules every Claude session follows:

@AGENTS.md

What follows is specific to Claude Code.

## Branch names in cloud sessions

A cloud session is assigned a branch name (`claude/...`) that isn't a lane
prefix. It would land in the dev lane, but don't use it. Branch from `main`
with the lane's name instead: `dev/<short-description>` for development, or
the `gen/` or `revise/` name
[`docs/generation.md`](docs/generation.md#the-generate-skill) gives a routine. Push and open the PR from that branch. This instruction is the
explicit permission to push to a branch other than the assigned one. Never
push to the assigned branch at all: a session can't delete a remote branch.

## Watching PRs

After opening a dev PR, subscribe to its activity (`subscribe_pr_activity`)
and end the turn; fix CI failures, conflicts, and review comments as they
arrive. Unsubscribe once the PR is merged or closed. A routine may subscribe
to its content PR too, but the run-order sweep is what guarantees comments get
handled ([Revisions](docs/generation.md#revisions)).

Every subscribed event is a turn, so watch only what may need work:

- **Content PRs from an owner-started session** (an SRD import batch, a link
  pass) aren't watched. The owner reviews and merges them, and says when the
  next step can start.
- **Once the owner turns on auto-merge**, unsubscribe; GitHub merges the PR
  when CI passes. Subscribe again only if asked to see it to green.
- **A green event needs no message.** Reply to the owner only when something
  is theirs to do or a task is finished.

Keep tool output small: filter test runs to their failures, read GitHub
items with field filters or `minimal_output`, and tail CI logs to the
failing lines.

## Sub-issues

Attach a task issue to its milestone issue with `sub_issue_write` (`add`),
then move it into place with `reprioritize` ([`AGENTS.md`](AGENTS.md) "Dev
Queue"). Read progress and order with `issue_read` (`get_sub_issues`), and
find a task's parent with `get_parent`.

## Configuration and skills

- [`.claude/settings.json`](.claude/settings.json) pre-approves the npm
  scripts and read-only git, and blocks force-pushes and reading `.env`
  files.
- [`.claude/hooks/session-start.sh`](.claude/hooks/session-start.sh)
  installs dependencies when a cloud session starts.
- [`srd-import`](.claude/skills/srd-import/SKILL.md) is the session
  workflow for SRD import stages and upkeep of SRD entries.
- [`ask-me`](.claude/skills/ask-me/SKILL.md) interviews the user when a goal
  is still fuzzy. [`grill-me`](.claude/skills/grill-me/SKILL.md)
  stress-tests a plan before it's built.
