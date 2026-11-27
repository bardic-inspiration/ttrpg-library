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

## Design

### The map page

- The diagram inline, at the page's width, each zone an anchor at
  `#zone-<id>`. A link to a zone scrolls to it and highlights it.
- The zones in order, each with its name, note, and what's in it: its
  back-references grouped by zone (`zoneRefs` in `site/src/lib/refs.ts`),
  what's set there (an encounter) and which child map details it.
- Its parent, linked, and its child maps.
- Print: the diagram at full width, then the zones.

### In the Library

- **Card:** the diagram as a thumbnail, name, and scale.
- **Facets:** none yet. They're judged once maps exist.
- **Where:** in `dnd-5e-2024`'s Library, the ruleset a map belongs to in
  this version, since each ruleset's Library shows its own entries
  ([Gallery](../../docs/site.md#gallery)). A map that serves several rulesets
  shows in each of their Libraries, once one can (Out of scope).

### Generation

`generate`'s map procedure writes the entry and its diagram together: lay
out the zones, draw them with the allowed classes, and give each its id and
name.

## Cases

Map names are stand-ins. The fixtures in `tests/fixtures/map/` hold the
dungeon, its room map, the town, and a broken diagram; the cases below use
them.

- **A dungeon map** with five zones, one per room, and a single-room map
  within its third zone, for a boss fight: both maps' pages show the link.
- **A town map** with no parent, whose zones are districts, on its page and
  in print.

## Done when

- The map page shows the diagram with linked zones and back-references by
  zone, on screen and in print.
- The docs describe the map page.

## Out of scope

- The spatial schema (grid, cell parameters, linework, objects) and its
  renderer, from the `core` repo's model: a later version.
- Ruleset-neutral maps, and one map serving several rulesets.
- Map art and image underlays (Images track, #316).
- VTT asset packs mapped to map objects.
