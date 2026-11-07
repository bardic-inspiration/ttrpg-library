# Workflow

## Purpose

How changes reach `main`: the two work lanes and the rules that keep them
apart, the CI that checks every PR, deployment, repository settings, and what
review covers. How to work day to day (branching, tests, the dev queue) is in
[`AGENTS.md`](../AGENTS.md).

## Behavior

### Work lanes

One repository holds two kinds of work. **Content** is entries and art, made by
routines. **Development** is everything that decides how content is validated,
generated, and shown. They share the ruleset module, so a schema change and the
migration of every affected entry land in one commit; separate repos would turn
that into a cross-repo version dance. The lanes are kept apart by enforced rules
within the one repo, not by convention.

| | Content lane | Dev lane |
|---|---|---|
| Purpose | Add, revise, or remove entries and art | Change the ruleset module, config, site, scripts, workflows, skills, docs, stage spec |
| Paths it may change | `content/**`, `assets/images/**` | Everything else; content paths with the `migration` label, which the labeler adds |
| Branch prefixes | `gen/`, `revise/` (routines), `manual/` (hand-made entries) | `dev/`, `dependabot/`, or any branch without a content prefix (such as a web-editor `<user>-patch-1`) |
| Opened by | Routines, or the owner for `manual/`, or a session the owner starts for SRD work | The owner, or a Claude session the owner starts |
| Lane label (auto) | `content` | `dev` |
| Area labels (auto, from paths) | none | `ui` (`site/**`), `ruleset` (`rulesets/**` except guidelines), `generation` (`rulesets/*/guidelines/**`, `.claude/skills/**`, `config/defaults.json`, `docs/routines.md`), `ci` (`.github/**`), `migration` (`content/**`, `assets/images/**`) |
| Issue templates and labels | Content request (`request`), revise request (`revise`) ([generation.md](generation.md#requests)) | Bug report (`bug`), feature request (`feature`), UI refinement (`ui`) |
| PR template | `content.md`, filled by the routine | `dev.md`: what and why, decisions, testing, screenshots for `ui`, migration notes |
| PR title | `Add <n> <type> entries`, `Revise <ids>: <reason>` | `<area>: <summary>`, such as `ui: tighten stat-block spacing` |
| CI | Content checks | Full checks |
| Review focus | Balance, tone, originality, licensing | Code, design, behavior, docs accuracy |

Merges are squashed with the PR title as the message, so `git log` on `main`
reads as two visibly distinct streams: "Add/Revise …" for content and
"`<area>:` …" for development.

**Guidelines count as development.** A guideline edit changes every future
generation run, so it's reviewed as behavior (`generation`), not as content. So
are the skills, the defaults file, and the routine prompts.

**Routines work only the content lane.** They take only `request` and `revise`
issues and push only `gen/` and `revise/` branches. Dev issues are worked in
sessions the owner starts, on `dev/` branches.

### Lane rules

The `lane` job enforces these:

- A PR's lane comes from its branch prefix: `gen/`, `revise/`, and `manual/` are
  content; every other branch is dev. `spike/` branches get no lane and fail, so
  a spike can't merge.
- A content PR fails if it changes any path outside `content/**` and
  `assets/images/**`, so routines can't alter schemas, guidelines, config, or
  the site, even by accident.
- A dev PR that changes `content/**` or `assets/images/**` gets the `migration`
  label from the labeler, and fails without it. The label keeps every content
  change made by code visible in review, and needs no manual step. A migration
  PR's body states what changed in the entries and why.
- The labeler adds `migration` a few seconds after the run starts, with the
  workflow's `GITHUB_TOKEN`, and GitHub starts no new run for a label event made
  with that token. So when a dev PR changes content and its event payload lacks
  `migration`, the `lane` job reads the PR's current labels every 5 seconds for
  up to a minute, and passes once the label appears. It fails if the label never
  comes, or the labels can't be read. Label events from people still re-run the
  job, so removing `migration` by hand fails the PR again.

### Labeling

`actions/labeler` runs in `labeler.yml` on `pull_request_target`, configured by
`.github/labeler.yml`: lane labels from the branch prefix, area labels from the
changed paths. `migration` combines the two: it goes on a PR whose branch has no
content prefix and that changes content paths. The labeler only reads PR
metadata and changed paths; it never checks out or runs PR code.

### CI checks

`validate.yml` runs on `pull_request` to `main` (`opened`, `synchronize`,
`reopened`, `labeled`, `unlabeled`, so label changes re-run the checks):

1. **`lane`** gets the lane from the branch prefix, lists changed paths against
   the base, applies the lane rules with `scripts/lane/`, and runs the link
   check ([Link check](#link-check)). It outputs the lane, whether content
   changed, whether the PR is docs-only or text-only, and whether it has the
   `milestone` label. Its scripts use only Node built-ins and run on Node's
   type stripping, so it skips `npm ci`.
2. **`content-checks`** (every PR except docs-only and text-only, after
   `lane`): set up the latest Node 22 release (`check-latest`, so a runner's
   older cached patch can't fail Astro's engine check) with npm cache,
   `npm ci`, `npm run validate`, and `npm run build`. When content changed,
   `scripts/pr-summary/` writes the job summary: changed entries with name,
   type, summary field, and summary; for creatures, the derived HP, AC, attack
   bonuses, DCs, and average damage per action; every warning, including every
   formula adjustment; and new back-links. The built site is uploaded as an
   artifact for 7 days.
3. **`dev-checks`** (dev lane, not docs-only, after `lane`, alongside
   `content-checks`): `npm run check` (types, `astro check`, Stylelint, the link
   check) and `npm test`. A text-only PR skips `npm run check`.
4. **`a11y`** (milestone PRs only, after `content-checks`): installs
   Playwright's Chromium and runs `npm run a11y` against the built site
   artifact ([Milestone PRs](#milestone-prs)).
5. **`validate`** always runs and needs all of the above. It passes only if each
   succeeded or was skipped by lane, by docs-only or text-only, or for want of
   the `milestone` label. It's the single required status check, so branch
   protection never depends on which jobs a lane runs.

Content PRs get fast feedback, since they can't change code; dev PRs get the
types and tests; a milestone PR gets every check.

### Docs-only PRs

A PR is docs-only when it changes at least one path and every changed path is
one no code, test, or build reads: a Markdown file at the repo root, anything
under `docs/` except `docs/routines.md`, a Markdown issue template, or
`.github/PULL_REQUEST_TEMPLATE/dev.md`. It runs only the `lane` job, so the lane
rules and the link check still apply. The list is `isDocsPath` in
`scripts/lane/`. When a test, script, or the build starts reading one of these
paths, remove it from the list in the same PR.

### Text-only PRs

A PR is text-only when it isn't docs-only and every changed path is docs or
Markdown that tests read but no build, type, or style check does: anything under
`spec/`, `.claude/skills/`, or `rulesets/*/guidelines/` ending in `.md`,
`docs/routines.md`, and `.github/PULL_REQUEST_TEMPLATE/content.md`. It skips
`content-checks`, and `dev-checks` runs only `npm test`; the lane job's link
check still applies. The list is `isTestTextPath` in `scripts/lane/`. When the
build, `validate`, or a type or style check starts reading one of these paths,
remove it from the list in the same PR. Any other change (code, config, schemas,
content, issue forms) gets the full checks.

### Milestone PRs

The PR that closes a milestone's last task carries the `milestone` label, added
by hand. It gets every check whatever its paths, so it is never docs-only or
text-only, and it adds the `a11y` job: `npm run a11y` against the built site
([Accessibility](styling.md#accessibility)). Adding the label re-runs
`validate`. Other PRs don't run the accessibility checks.

### Link check

Docs are cited by file and heading ([docs/README.md](README.md#headings-and-citations)).
`npm run links` (`scripts/links/`) scans every tracked text file and fails on:

- a citation `docs/<file>.md#<heading>` or `spec/v2/<file>.md#<heading>` whose
  file or heading doesn't exist;
- a relative Markdown link, in a Markdown file, whose target or heading doesn't
  exist;
- a section-number citation (`§` and a number).

Entries, test fixtures, and the lockfile aren't scanned. It runs in the `lane`
job, so docs-only and text-only PRs get it, and in `npm run check`.

### Deploy

`deploy.yml` runs on push to `main` and on `workflow_dispatch`: the same
install, validate, and build steps, then `actions/upload-pages-artifact` and
`actions/deploy-pages`. Permissions are `contents: read`, `pages: write`, and
`id-token: write`, in the concurrency group `pages` without cancelling runs in
progress. The Pages source is GitHub Actions.

### Repository settings

Set by hand by the owner:

- **Visibility:** public.
- **Branch protection on `main`:** require the `validate` check and up-to-date
  branches; require pull requests (no direct pushes, including from routines);
  block force-pushes and deletion. No required approvals: routines open PRs
  under the owner's identity, GitHub blocks self-approval, and the merge is the
  approval.
- **Merge method:** squash only, with the PR title as the commit message.
  Delete head branches after merge.
- **Labels:** the content issue labels ([generation.md](generation.md#labels)),
  the lane and area labels above, the dev issue labels, and `milestone`
  ([Milestone PRs](#milestone-prs)).

### Dependencies

Dependabot opens grouped, monthly npm and GitHub Actions updates on
`dependabot/` branches. They go through the dev lane with the full checks.

### Review

| Check | CI | Human review |
|---|---|---|
| Envelope and `stats` schemas, unknown keys rejected | Yes | |
| File path, ID, and name uniqueness | Yes | |
| Derived values | Not stored, so nothing to check | |
| Text tokens valid; no literal derived numbers in creature prose | Yes | |
| Formula adjustments (`adjust`, damage `bonus`) | Warning | Confirm each one |
| References resolve; deletions don't orphan refs | Yes | |
| Blocklist | Yes | Edit the blocklist for false positives |
| Site builds | Yes | |
| Balance against guideline targets (custom entries) | | Yes |
| Flavor, tone, originality (custom entries) | | Yes |
| Fidelity to SRD 5.2 (SRD entries) | | Yes |
| Rules legality beyond the checks | | Yes |

Review is driven by comments on the PR ([generation.md](generation.md#revisions));
merging is the only step that publishes.

### Escape hatch

Content lives only under `content/` and `assets/images/`, and
`scripts/build-index/` is the one place the site reads it. If the lanes ever
need separate repositories (outside contributors, a second consumer of the
content), `git filter-repo` can extract those two folders with history, and the
ruleset module would become a versioned package both repos depend on.

## Where the rules live

- `.github/workflows/validate.yml`, `deploy.yml`, and `labeler.yml`;
  `.github/labeler.yml` and `.github/dependabot.yml`.
- `scripts/lane/`, `scripts/links/`, and `scripts/pr-summary/`.
- `.github/PULL_REQUEST_TEMPLATE/` and `.github/ISSUE_TEMPLATE/`.

## Extending

| To change | Touch |
|---|---|
| Which paths are docs-only | `isDocsPath` in `scripts/lane/`, with its test |
| An area label | `.github/labeler.yml`, and the table above |
| A required check | The `validate` job's `needs`, so the single required check still covers it |
