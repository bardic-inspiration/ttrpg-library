# Development tracks

Ongoing work outside a version's build: design that isn't built yet and has no
end date. Each track is a tracking issue whose sub-issues are its tasks, and
one file here holds its unbuilt design. What is built is in
[`docs/`](../../docs/README.md). Like the v2 stage spec, this folder sits
outside `docs/`, and no skill, guideline, or routine prompt cites it.

## Tracks

| Track | Issue | Design | From |
|---|---|---|---|
| Integrations | #315 | [`integrations.md`](integrations.md) | v2's translators area (#116) and the rest of v2 Milestone 8 (#220) |
| Images | #316 | [`images.md`](images.md) | v2's art area (#117) and v2 Milestone 9's art tasks (#221) |

## Track files

A track file has the shape of a v2 stage spec area file: front matter with
its design issue (`issue`) and the other track files it depends on
(`depends`), a `# ` title, and the sections Goal, Current, Design, Cases,
Migration, Done when, Open questions, and Out of scope, in that order. Goal
and Design are required; leave out any other section that doesn't apply.
Cases cite library entries as `<type>/<id>` in code spans.
`tests/stage-spec.test.ts` checks every track file, as it does the stage
spec's.

## Working with a track

- **Building a part deletes it** from the track's file, updates the docs to
  describe what now exists, and adds the reasons to
  [`docs/decisions.md`](../../docs/decisions.md). The track goes on after its
  file is emptied: the file is deleted, and new design for the track starts a
  new one.
- **Amending a design** is a small PR to the track's file that the owner
  merges. No part with an open question is built.
- **Picking tasks:** tracks join the dev queue after the last milestone, in the
  order of the table above ([`AGENTS.md`](../../AGENTS.md) "Dev Queue").
