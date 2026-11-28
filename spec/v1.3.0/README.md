# v1.3.0 spec

The design for v1.3.0 that isn't built yet: a UX revision of the Library and
the site's chrome, from the design brief in the v1.3.0 Spec Considerations
issue (#532).

## What this is

- **Only unbuilt design.** What the library does now is in
  [`docs/`](../../docs/README.md) and the code. A change to existing behavior
  is written relative to them.
- **Never read by routines.** It sits outside `docs/`, and no skill,
  guideline, or routine prompt cites it.
- **Emptied by building it.** The PR that builds a part deletes it here,
  updates the docs to describe what now exists, and adds the reasons to
  [`docs/decisions.md`](../../docs/decisions.md). The version is built when
  only this README is left, and then the folder is removed.

## Areas

One file per area, in build order. An area's order is its milestone's number,
and a built area leaves the table. Each area depends on the ones before it
that its front matter names.

| Order | Area | Design issue | Builds |
|---|---|---|---|
| 1 | [`library-menu.md`](library-menu.md) | #532 | One type at a time, chosen from a dropdown, with a flat filter list per type |
| 2 | [`header.md`](header.md) | #532 | A one-row header with the cart menu and one Export button; a footer of two links; no top bar or About page |
| 3 | [`layout.md`](layout.md) | #532 | Results that scroll in their own container, a static sidebar on desktop, and a thin bar on phones |

Each area becomes a build milestone, in this order. Each milestone starts with
a pilot on the area's hardest cases.

## Area files

Area files take the shape of a track file
([Track files](../tracks/README.md#track-files)): front matter with the
design issue and the areas it depends on, then the same sections in the same
order. `depends` names other areas in this folder.

## Checks

`tests/stage-spec.test.ts` checks every area file as it checks a track file
([Checks](../tracks/README.md#checks)), with dependencies resolved within
this folder. `npm run links` checks citations of
`spec/v1.3.0/<file>.md#<heading>`
([Link check](../../docs/workflow.md#link-check)).

## Working with the spec

- **An approved design can be amended at any time** by a small PR here that
  the owner merges.
- **A gap found while building** follows the rule in `AGENTS.md` "Rules":
  either the session decides it and records the decision in its PR, or the
  question goes into the area's Open questions.
