# CI

How CI gates and publishes this repo. The workflows themselves are specified
in [`SPEC.md`](../SPEC.md) §12 "CI/CD and repository settings" — that's the
contract for their jobs and triggers; this doc is how to work with them and
the rules for changing them.

| Workflow | Runs on | Does |
|---|---|---|
| `validate.yml` | Every PR to `main`, and on label changes | Lane check, then the lane's checks; reports one required status, `validate` ([`SPEC.md`](../SPEC.md) §12.1) |
| `deploy.yml` | Push to `main`, manual dispatch | Validate, build, publish to GitHub Pages ([`SPEC.md`](../SPEC.md) §12.2) |
| `labeler.yml` | Every PR (`pull_request_target`) | Lane and area labels from branch prefix and paths; never checks out PR code ([`SPEC.md`](../SPEC.md) §12.4) |

## One required check

`validate` is the only required status check. It passes when every job the
lane needs succeeded, and jobs a lane doesn't need count as skipped — so
branch protection never depends on which jobs a lane runs.

- **Content lane:** validate every entry, build the site, and write the job
  summary — changed entries, derived numbers for creatures, every warning and
  formula adjustment. Content PRs can't change code, so they get the fast
  path.
- **Dev lane:** all of that, plus `npm run check`, `npm test` (including
  contrast), and `npm run a11y` against the built site.

There's no docs-only fast path: a Markdown-only PR is in the dev lane and
gets the full checks.

## Local and CI run the same scripts

CI runs npm scripts, never inline logic that a local run can't reproduce. The
lane's scripts, run locally before a push ([`AGENTS.md`](../AGENTS.md)
"Commands"), are the same ones CI runs — so green locally means green in CI,
and adding a check means adding it to an npm script that CI already runs.
The lane check and the job summary are about PR metadata and reporting, not
code, so they live only in CI.

## What every workflow does

1. **Be reproducible.** Node 22 LTS, install with `npm ci` from the committed
   lockfile, and keep tests deterministic ([`testing.md`](testing.md)).
2. **Use least privilege.** `permissions: contents: read` unless a job needs
   more (deploy needs `pages: write` and `id-token: write`; the labeler needs
   to write labels). The checks need no secrets. PR-controlled text — titles,
   branch names, labels — reaches a script only through `env`, never
   interpolated into it.
3. **Never run PR code with write access.** `pull_request_target` workflows
   read metadata and changed paths only.
4. **Stay fast and bounded.** Every job has a timeout, superseded runs on the
   same branch are cancelled (deploy excepted: its concurrency group never
   cancels in progress), and npm is cached. If CI gets slow, parallelize
   jobs — don't drop checks.
5. **Pin actions by major version**, kept current by Dependabot's monthly
   grouped updates ([`SPEC.md`](../SPEC.md) §12.4 "Dependencies").

## Enforcing project rules

A rule in [`SPEC.md`](../SPEC.md) that a machine can check belongs in an npm
script CI runs — as a validator check, a test, or a lint rule — not in
reviewers' memories. The spec already places most of them: entry rules in the
validator ([`SPEC.md`](../SPEC.md) §6.8), design-value rules in Stylelint
(§9.6), contrast in Vitest and accessibility in axe (§9.7), lane rules in the
lane job (§12.4). Each names the spec section it enforces
([`testing.md`](testing.md)).

## Changing CI

- A change to `.github/` or to an npm script CI runs is a code change, never
  docs-only, and goes through the dev lane (area `ci`).
- A change to a workflow's jobs, triggers, or required status is a spec change
  too: update [`SPEC.md`](../SPEC.md) §12 in the same PR.
- **Weakening a check** — removing a stage, loosening a threshold, adding
  `continue-on-error`, excluding files, downgrading an error to a warning —
  needs its own issue saying why. It never rides along in an unrelated PR.
