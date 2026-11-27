# Map guideline (dnd-5e-2024)

How to write a `map` entry. The schema is `schemas/map.schema.json` and
[Maps](../../../docs/rulesets.md#maps) describes it. Its diagram follows
[Map diagrams](../../../docs/content-model.md#map-diagrams). This file covers
what the schema and the diagram checks can't: what a map is for, names, and
prose.

Every map is custom: the SRD prints no maps
([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)).
Its diagram is an original placeholder, not art, so it needs no
`ATTRIBUTION.md` credit.

## Tone and voice

- A map is a place a DM runs: a dungeon, a town, one room for a fight.
  `summary` is one plain sentence saying what the place is and how it's
  laid out ("A flooded cistern of five rooms under an old mill").
- `description` says what the place is like to arrive at, in two or three
  sentences, with no rules.

## Naming

- The place's name, in title case: "Sunken Cistern", "Harrowfield".
- Original: no SRD entry's exact name of any type, and no proper noun that
  isn't in SRD 5.2 (`config/blocklist.json` is a floor, not the whole rule).
- Each zone's `name` is what the table calls that part of the place
  ("Flooded Hall"), and its `id` the slug of the name.

## Balance targets

- A map has no rules of its own, so it has nothing to balance. Size it to
  its `scale`: a room map holds a fight's few zones, a dungeon map one zone
  per room, a town map one per district.

## Prose style

- A zone's `note` says what the zone is in a sentence or two: what's
  there, and what a visitor notices first. What happens there belongs in
  the entries that point into it, not in the map.

## Dependencies and SRD references

- **A child map's parent** must be in the library: `within` names the
  parent map by ref and one of its zones by id.
- A map references nothing else. Entries set in a zone reference the map,
  never the other way.
