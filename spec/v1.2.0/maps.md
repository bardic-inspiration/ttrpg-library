---
issue: 374
depends: [ui]
---

# Maps

## Goal

Placeholder maps: simple SVG diagrams with named zones, enough to work out
the library and page structure that encounters and modules point into. The
spatial schema (a grid with cell parameters, linework, objects) and its
renderer wait for the owner's `core` repo's map model, in a later version.
It serves P1 (the diagram is a reviewed file in the repo), P2 (the diagram
is checked, not trusted), and P6 (the site styles the diagram).

## Current

- [Images](../../docs/content-model.md#images): `assets/images/`, its size
  limits, and art only where it's licensed.
- [References](../../docs/content-model.md#references): ref objects,
  tokens, and back-references.
- [Work lanes](../../docs/workflow.md#work-lanes): `assets/images/` is in the
  content lane.
- [Maps](../../docs/rulesets.md#maps): the `map` type, its `scale`,
  `zones`, and `within`, with its checks.
- [Map diagrams](../../docs/content-model.md#map-diagrams): the diagram at
  its derived path, and the checks it passes.
- [References](../../docs/content-model.md#references) "A map's zones": zone
  refs and tokens, their check, and back-references with their zone.
- [Maps](../../docs/rulesets.md#maps) "map page": the diagram with linked
  zones, the zones with what's in each, the parent and child maps, print,
  and the Library card with its scale.

## Design

### Generation

`generate`'s map procedure writes the entry and its diagram together: lay
out the zones, draw them with the allowed classes, and give each its id and
name.

## Done when

- `generate` makes a valid map and diagram from an inline request.
- `docs/generation.md` describes the map procedure.

## Out of scope

- The spatial schema (grid, cell parameters, linework, objects) and its
  renderer, from the `core` repo's model: a later version.
- Ruleset-neutral maps, and one map serving several rulesets.
- Map art and image underlays (Images track, #316).
- VTT asset packs mapped to map objects.
