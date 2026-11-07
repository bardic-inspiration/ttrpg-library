# v2 stage spec

The design for v2 that isn't built yet. Its shape was decided in #197.

## What this is

- **Only unbuilt design.** What the library does now is in [`docs/`](../../docs/README.md)
  and the code. A change to existing behavior is written relative to them.
- **Never read by routines.** It sits outside `docs/`, and no skill, guideline,
  or routine prompt cites it.
- **Written in the v2 design sessions** (#110), one file per design area. A
  session ends when the owner merges its PR; that merge approves the design.
- **Emptied by building it.** The PR that builds a part deletes it here,
  updates the docs to describe what now exists, and adds the reasons to
  [`docs/decisions.md`](../../docs/decisions.md). The stage is finished when
  only this README is left, and then the folder is removed.

## Areas

One file per area, named by its short name, in the design order #110 sets:
`linking.md` (#111), `types.md` (#112), `ui.md` (#113), `style.md` (#114),
`export.md` (#115), `translators.md` (#116), `art.md` (#117). Every area's
design session has written its file.

## Status

There is no status table, because GitHub and the file tree already hold the
status:

- **In design or approved:** the area's design issue is open or closed. #110's
  sub-issues show progress across areas.
- **Building:** the v2 build milestone issues and their sub-issues.
- **Built:** the area's file, or the part of it, is gone from this folder.

## Area files

Each file starts with front matter holding what GitHub doesn't: the design
issue, and the areas this one depends on, by file name.

```markdown
---
issue: 112
depends: [linking]
---

# Types

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

- **Goal:** the problem the area solves, and the principles in
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
- **Out of scope:** what the area deliberately leaves out, pointing to the
  "Later (v3)" issue (#118) for what's earmarked there.

The reasons behind a design go in its PR and in `docs/decisions.md`, not here,
so nothing is lost when a built part is deleted.

## Checks

`tests/stage-spec.test.ts` checks every area file: front matter with a design
issue, dependencies that name other area files with no cycle, a title, the
sections above in order with Goal and Design present, and every `<type>/<id>`
under Cases resolving to a library entry.

## Working with the stage spec

- **A design PR** writes or changes an area file. The owner's merge approves
  it.
- **An approved design can be amended at any time** by a small PR here that
  the owner merges. Reopening a design is normal work, not an exception.
- **Each build milestone starts with a pilot** on the area's hardest cases.
  The pilot is expected to turn up amendments; a gap found there is the
  milestone working.
- **A gap found while building** follows the rule in `AGENTS.md` "Rules":
  either the session decides it and records the decision in its PR, or the
  question goes into the area's Open questions.
