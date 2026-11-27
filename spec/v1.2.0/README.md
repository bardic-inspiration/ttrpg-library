# v1.2.0 spec

The design for v1.2.0 that isn't built yet. It comes from the design briefs
under the v1.2.0 Spec Considerations issue (#118): arrangements (#374),
characters (#398), and the site UI revision (#402).

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

One file per area, in build order; an area's order is its milestone's number, and a
built area leaves the table. Each area depends on the ones before it
that its front matter names.

| Order | Area | Design issue | Builds |
|---|---|---|---|
| 3 | [`ui.md`](ui.md) | #402 | The style guide, shared components, and the Library and page revisions |
| 6 | [`encounters.md`](encounters.md) | #374 | The `encounter` type, the kit, and the difficulty calculator |
| 7 | [`modules.md`](modules.md) | #374 | The `module` type, containment, and its kit parts |

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
`spec/v1.2.0/<file>.md#<heading>`
([Link check](../../docs/workflow.md#link-check)).

## Working with the spec

- **An approved design can be amended at any time** by a small PR here that
  the owner merges.
- **A gap found while building** follows the rule in `AGENTS.md` "Rules":
  either the session decides it and records the decision in its PR, or the
  question goes into the area's Open questions.

## Deferred from #118

- **A second published ruleset:** the Rulesets track (#403),
  [`spec/tracks/rulesets.md`](../tracks/rulesets.md).
- **The character sheet builder** and other authoring tools: v2.0.0 (#370).
- **A prebuilt search index:** cut. Search is a name filter
  ([Gallery](../../docs/site.md#gallery) "Search"), which needs no search index.
