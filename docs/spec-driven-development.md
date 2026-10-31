# Spec-Driven Development

What the spec is for, how to build from it, and how to keep it useful long
after the first build.

[`SPEC.md`](../SPEC.md) is the source of truth for **what to build** — the
content model, rulesets, site, exports, CI, lanes, and repository settings;
[`AGENTS.md`](../AGENTS.md) is the source of truth for **how to work**. Code
conforms to the spec — the spec is never reverse-engineered from code.

## Three tenses, three homes

Docs rot when the design, the plan to build it, and the history of how it was
decided blur together. A cold-start session has to be able to tell which
statements describe the system.

| Kind | Tense | Lives in | A session reads it |
|---|---|---|---|
| **Design** | Present — what the system is and must do | `SPEC.md` §1–§15 and the appendix | Always: the sections its task cites |
| **Plan** | Future — the order it's built in | `SPEC.md` §16 "Delivery plan", mirrored by GitHub milestones | When picking or scoping work |
| **History** | Past — what changed, and why | Squash commits, PRs, and issues | On demand, never by default |

**The repo holds the design and the plan; git and GitHub hold the past.**
Nothing finished lives as a file in the tree — no changelogs, decision
records, or archives.

## Writing it

- **Present tense.** "The validator rejects unknown `stats` keys" — not "we
  decided the validator will…", not "(refined in v1.1)". Superseded text is
  replaced, never struck through or annotated.
- **Testable.** Every behavioral statement can become an acceptance criterion.
  If it can't, it isn't precise enough yet.
- **Rationale in a line, deliberation in the PR.** A rule that looks arbitrary
  or easy to reverse carries a short "why" — the spec's
  [§2.1](../SPEC.md#21-changes-from-the-preliminary-design) table is the
  model — so nobody undoes it by accident. The options weighed and the debate
  go in the PR description.
- **Cite by section number and name.** The spec numbers its sections and
  cross-references them (`§12.4`); other docs do the same, adding the heading
  ("§12.4 "Work lanes"") so a citation still makes sense if numbering shifts.
  Renumbering a section means updating every doc that cites it, in the same
  PR.
- **One home per fact** ([`documentation.md`](documentation.md)). Other docs
  point at the spec; the spec doesn't copy them.

## What's true of `main`

Until v1 is complete ([`SPEC.md`](../SPEC.md) §16), the spec describes the v1
design, and `main` is built toward it milestone by milestone: a section is
true of `main` once the milestone that builds it has closed. A session working
mid-build reads the spec as the target, and the code as how far it has got.

After v1, `main` and the spec move together: a behavior change updates the
spec in the same PR. Work too big for one PR gets a milestone, and the spec
text it will make true is marked **`Planned (<milestone>):`** until the
milestone closes.

## Using it

- **Issues cite the spec.** A dev-lane task names the spec section it
  implements, and its acceptance criteria are derived from that section's
  statements ([`workflow.md`](workflow.md) "Issues").
- **Read before you write.** A session reads the cited sections before
  touching code ([`AGENTS.md`](../AGENTS.md) "Working loop").
- **Spec and code change together.** A dev PR that changes behavior updates
  the spec in the same PR, so the two never disagree on `main`.
- **Ambiguity stops work.** If the spec is silent or looks wrong, don't invent
  behavior. Raise it — with the user, or on the issue — and resolve it by
  editing the spec before writing the code that depends on it.
- **Disagreement is a bug.** If code and spec disagree on `main`, one of them
  is wrong: file an issue, decide which, and fix that one.
- **History is in git.** `git log -- SPEC.md` lists every spec change. To find
  why a line says what it does, `git blame` it (or
  `git log -S '<phrase>' -- SPEC.md`): the commit's ` (#N)` leads to the PR
  and its reasoning. There is no changelog file, amendment table, or spec
  version.

## Milestones

The delivery plan is [`SPEC.md`](../SPEC.md) §16: six milestones, each with a
"Done when" that can be verified. GitHub milestones mirror it one-to-one, and
dev-lane issues and PRs are assigned to them; content issues carry none
([`SPEC.md`](../SPEC.md) §12.4 "Tracking").

1. **Open a milestone's work.** File its tasks as dev-lane issues, each citing
   the spec section it implements, with `Depends on #N` where order matters,
   and assigned to the milestone.
2. **Build.** Sessions work the tasks through the working loop
   ([`AGENTS.md`](../AGENTS.md) "Working loop").
3. **Check it's done.** When a milestone's issues are merged, walk its "Done
   when" against `main`, run the full dev-lane checks, and confirm the spec
   describes what shipped. File any gap as a new issue in the same
   milestone. Close the milestone only when "Done when" holds.

A milestone holds only order and done-criteria. Design deliberation happens in
issues and PRs, and its outcome goes into the spec.

## Keeping it lean

The doc audit ([`documentation.md`](documentation.md) "Doc audit") checks that
the spec describes `main` (or, mid-build, the target), carries no history,
and that no `Planned` marker outlives its milestone.

Periodically, a **conformance audit** checks `main` against the whole spec,
including the seams no single issue owned. Its findings are ordinary `bug` and
`feature` issues.
