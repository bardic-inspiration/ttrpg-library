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

## Design

### Diagrams, not art

A map's picture is a generated SVG diagram, made with the entry by the
`generate` skill. It's an original diagram, not art, so the Images track's
rule against generated art doesn't apply to it, and it needs no
`ATTRIBUTION.md` credit. Art stays under the Images track's rules.

### The map type

`map` is a content type in `dnd-5e-2024` for this version, at
`content/dnd-5e-2024/map/<id>.json`. Maps become ruleset-neutral data with
the spatial schema.

- **The diagram** is at a path derived from the id,
  `assets/images/dnd-5e-2024/map/<id>.svg`, never stored. Every map has one
  (error otherwise), with the image size warning and limit.
- **`scale`:** a label for organizing the hierarchy, one of `room`,
  `dungeon`, `zone`, `region`, or `world`. It isn't a type.
- **`zones`:** the map's anchors, each an `id` (a slug, unique within the
  map) and a `name`, with an optional `note`.
- **`within`:** for a child map, the zone of its parent it details: a ref to
  the parent map and a zone id. A map is within at most one parent, and no
  map is within itself, directly or through others (error).

### The diagram file

- **Allowed:** shapes, paths, text, groups, and `<title>`. Zones are elements
  with `id="zone-<id>"`, one per zone in `stats.zones`, and no other ids
  start `zone-` (error both ways).
- **Rejected (error):** `<script>`, event handler attributes, `<foreignObject>`,
  `<image>`, any `href` or `url(…)` outside the file, and inline `style` or
  color attributes.
- **Styled by the site:** elements carry classes from a fixed set (`zone`,
  `wall`, `door`, `feature`, `label`), and the site's CSS colors them from the
  palette ([Palette](../../docs/styling.md#palette)). A class outside the set
  fails.
- **A `viewBox`** is required, so the diagram scales to any width.

### Pointing into a map

Population points into the map, never out of it. A map holds its diagram and
zones only; entries that use it reference it:

- **A ref object** may name a zone: `{ "ref": "map/<id>", "zone": "<zone-id>" }`.
  It renders "Map › Zone", linked to the zone on the map's page. A zone that
  isn't on the map fails like a missing ref.
- **A token** may too: `{ref:map/<id>#<zone-id>}`.
- **Back-references** on the map's page are grouped by zone: what's set in
  each zone (an encounter), and which child map details it.

### The map page

- The diagram inline, at the page's width, each zone an anchor at
  `#zone-<id>`. A link to a zone scrolls to it and highlights it.
- The zones in order, each with its name, note, and what's in it.
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

Map names are stand-ins.

- **A dungeon map** with five zones, one per room, and a single-room map
  within its third zone, for a boss fight.
- **A town map** with no parent, whose zones are districts.
- **A broken diagram:** a zone in `stats.zones` with no element in the SVG,
  an element `zone-9` with no zone, and an `<image>` linking outside the
  file. Each fails.

## Done when

- The `map` type validates its entry and diagram with the checks above.
- Map refs and tokens with a zone resolve, render, and fail on a missing
  zone.
- The map page shows the diagram with linked zones and back-references by
  zone, on screen and in print.
- The docs describe the type, the diagram rules, and zone refs, and the
  Images track's out-of-scope line names maps as diagrams.

## Out of scope

- The spatial schema (grid, cell parameters, linework, objects) and its
  renderer, from the `core` repo's model: a later version.
- Ruleset-neutral maps, and one map serving several rulesets.
- Map art and image underlays (Images track, #316).
- VTT asset packs mapped to map objects.
