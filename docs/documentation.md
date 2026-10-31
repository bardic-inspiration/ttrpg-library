# Documentation

How docs are written, named, and kept truthful. Documentation drift is a
defect.

## Source of truth

- [`SPEC.md`](../SPEC.md) is authoritative for **what to build**; code
  conforms to it ([`spec-driven-development.md`](spec-driven-development.md)).
- [`AGENTS.md`](../AGENTS.md) is authoritative for **how to work**.
- **Every fact has one home.** Other docs describe it in a line and link
  there — duplication drifts. Rules that the spec states (lanes, labels, CI
  jobs, PR titles, routine behavior) are cited, not restated.

## Present tense; history lives in git

- Docs describe the project **as it is now** — or, for the spec mid-build,
  as v1 is designed ([`spec-driven-development.md`](spec-driven-development.md)
  "What's true of `main`"). The past lives in git: squash commits, PRs, and
  issues.
- A doc that has done its job is deleted, not moved to an archive folder.
  Superseded text is replaced, not struck through or annotated.
- **No process narration.** Docs don't reference chat sessions, "as
  discussed," or session links. How a change came to be belongs in its PR
  description.

## Structure

- **Purpose line.** Every doc opens with a `# Title` and a one-line statement
  of what it's for.
- **Routing tables.** A doc that hands the reader off to others uses a table
  of link and "read when" — [`AGENTS.md`](../AGENTS.md) "Protocol docs" is the
  model. Point at another doc's table; don't copy it.
- **Stable rules apart from churn-prone detail.** Timeless rules don't embed
  what changes as the project grows (current status, which milestone is open)
  — they point at where that lives.
- **Cite the spec by section number and name** (§12.4 "Work lanes"); link
  other docs relatively, and refer to their sections by heading
  ([`spec-driven-development.md`](spec-driven-development.md) "Writing it").

## Keep in sync

- A change that alters observable behavior updates the affected docs **in the
  same PR**.
- When a shared term, identifier, heading, or spec section number changes,
  every doc that names it changes in the same PR, with identical spelling.
- Where a doc can be checked against the code mechanically — a file map, a
  command list — prefer a check in an npm script CI runs to good intentions
  ([`ci.md`](ci.md) "Enforcing project rules").

## Style

- Short, skimmable docs with links over long prose.
- Fenced code blocks for commands and payloads.

## Naming

- **Root meta-files** keep the open-source convention of `ALL-CAPS.md`:
  `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `SPEC.md`,
  `ATTRIBUTION.md`, plus `LICENSE` and `LICENSE-CONTENT`.
- **Everything under `docs/`:** `kebab-case.md`.
- **Branches, PR titles, and labels:** [`workflow.md`](workflow.md).

### Code and data

Conventions the spec already fixes ([`SPEC.md`](../SPEC.md) §5–§9):

| Thing | Convention | Example |
|---|---|---|
| Entry IDs, filenames, and URL segments | kebab-case slug | `cinder-hound.json` |
| Ruleset and type IDs, enum values | kebab-case | `dnd-5e-2024`, `magic-item`, `very-rare` |
| Tag keys | kebab-case, `^[a-z][a-z0-9-]*$` | `environment` |
| JSON keys in entries and config | camelCase | `hitDice`, `saveProficiencies` |
| TypeScript variables and functions | camelCase | `buildIndex` |
| Components and types | PascalCase | `StatBlockHeader`, `Exporter` |
| CSS custom properties | kebab-case, role-named | `--color-text-muted`, `--statblock-rule-color` |
| CSS classes | component-scoped, `block__element` | `.statblock__header`, `.card__summary` |

The split is deliberate: **data values and identifiers people see in URLs
are kebab-case; keys code reads are camelCase.** Don't "fix" one to match the
other.

## Doc audit

The docs are reconciled periodically, not continuously. An audit checks that:

- **the spec describes `main`** — or, mid-build, the v1 target — with no
  history (version annotations, amendment tables, past-tense narration);
- **only live documents exist** — nothing finished lives as a file;
- **status matches GitHub** — the §16 milestones and the GitHub milestones
  agree, and anything the docs report about what's built matches the actual
  issues, PRs, and milestones;
- **links resolve**, and cross-references — including spec section numbers —
  use identical spelling;
- **local and CI checks match** — [`AGENTS.md`](../AGENTS.md) "Commands" and
  the workflows run the same npm scripts;
- **one home per fact** — no second copy of a rule that has quietly diverged.

Any session may open a docs-only PR to fix drift it spots while working. A
broader pass is filed as its own issue. Doc fixes never ride along in an
unrelated code PR.
