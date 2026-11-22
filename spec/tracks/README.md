# Development tracks

Ongoing work outside a version's build: design that isn't built yet and has no
end date. Each track is a tracking issue whose sub-issues are its tasks, and
one file here holds its unbuilt design. What is built is in
[`docs/`](../../docs/README.md). This folder sits outside `docs/`, and no
skill, guideline, or routine prompt cites it.

## Tracks

| Track | Issue | Design | From |
|---|---|---|---|
| Integrations | #315 | [`integrations.md`](integrations.md) | v1.1.0's translators area (#116) and the rest of v1.1.0 Milestone 8 (#220) |
| Images | #316 | [`images.md`](images.md) | v1.1.0's art area (#117) and v1.1.0 Milestone 9's art tasks (#221) |

## Track files

Each file starts with front matter holding what GitHub doesn't: the track's
design issue, and the other track files it depends on, by file name.

```markdown
---
issue: 117
depends: []
---

# Images

## Goal
## Current
## Design
## Cases
## Migration
## Done when
## Open questions
## Out of scope
```

The sections keep this order. Goal and Design are required; leave out any
other section that doesn't apply.

- **Goal:** the problem the track solves, and the principles in
  `docs/decisions.md` it serves.
- **Current:** links to the docs and code the design changes. Left out for
  something wholly new.
- **Design:** the change. Spell out exact shapes only where they're new; link
  to the existing ones.
- **Cases:** real examples the design must handle. Cite library entries as
  `<type>/<id>` in code spans, such as `creature/lich`. These become the
  build's test fixtures.
- **Migration:** the entries and config the design changes, and how.
- **Done when:** what CI can prove. A check that needs a human or a live
  service goes to the Testing backlog instead.
- **Open questions:** what isn't settled yet. No part with an open question is
  built.
- **Out of scope:** what the track deliberately leaves out, pointing to the
  "Later (v3)" issue (#118) for what's earmarked there.

The reasons behind a design go in its PR and in `docs/decisions.md`, not here,
so nothing is lost when a built part is deleted.

## Checks

`tests/stage-spec.test.ts` checks every track file: front matter with a design
issue, dependencies that name other track files with no cycle, a title, the
sections above in order with Goal and Design present, and every `<type>/<id>`
under Cases resolving to a library entry. `npm run links` checks citations of
`spec/tracks/<file>.md#<heading>` ([Link check](../../docs/workflow.md#link-check)).

## Working with a track

- **Building a part deletes it** from the track's file, updates the docs to
  describe what now exists, and adds the reasons to
  [`docs/decisions.md`](../../docs/decisions.md). The track goes on after its
  file is emptied: the file is deleted, and new design for the track starts a
  new one.
- **Amending a design** is a small PR to the track's file that the owner
  merges. Reopening a design is normal work, not an exception.
- **A gap found while building** follows the rule in `AGENTS.md` "Rules":
  either the session decides it and records the decision in its PR, or the
  question goes into the track's Open questions.
- **Picking tasks:** tracks join the dev queue after the last milestone, in the
  order of the table above ([`AGENTS.md`](../../AGENTS.md) "Dev Queue").
