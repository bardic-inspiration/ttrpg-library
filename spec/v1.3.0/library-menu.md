---
issue: 532
depends: []
---

# Library menu

## Goal

Show one type at a time. A mixed list of creatures, spells, and modules
doesn't help a reader, and the nested checkbox tree takes several clicks to
reach any one filter. The Library stays one page per ruleset, and its menu
stays one vertical column under search, but the type becomes a single choice
and the filters below it come from that type alone, all in view. It serves
P4 (each type's filters and their controls are registry data) and P6
(templates own presentation).

## Current

- [Gallery](../../docs/site.md#gallery): "Layout", "Filters" (the
  accordion checkbox tree, with Sources then Types), "Sort", and "URL state".
- [Type registry](../../docs/site.md#type-registry): `facets`,
  `defaultFilters`, and `defaultSort`.
- [Redirects](../../docs/site.md#redirects): type gallery URLs open the
  Library with the type checked.
- [Display](../../docs/content-model.md#display): chip fields.
- Code: `site/src/lib/gallery/tree.ts`, `config.ts`, `view.ts`, and
  `library-url.ts`.

## Design

### The menu

From top to bottom, the Library's menu holds:

1. **Search**, as now.
2. **Type**: a native `<select>` labeled "Type", listing the ruleset's types
   that have entries, by their `plural` label, in registry order. Exactly one
   type is active. Each option shows its count of entries under the current
   search and Sources, "Spells (4)", so a name search still shows which types
   hold matches.
3. **Sources**: Official and Homebrew, with Homebrew's Source and Author
   filters, as now, for every type.
4. **The type's filters**: the active type's `filters` (below), in order, each
   a labeled control with its values in view. No filter, field, or value has a
   disclosure.
5. **Rules**, as now.

The Types section of the tree, the type checkboxes, and the field nodes that
group facets go away.

### Changing type

Choosing another type clears the filters of the type it leaves, and keeps the
search and Sources. The sort returns to the new type's `defaultSort`, else
`name:asc`.

### The registry

Each type gains `filters`, an ordered list of the filters its menu shows:

```json
"filters": [
  { "path": "stats.cr", "control": "range" },
  { "path": "stats.creatureType", "control": "checkboxes" },
  { "path": "stats.size", "control": "chips" },
  { "path": "stats.immunities.conditions", "control": "combobox" }
]
```

- `path` names one of the type's `facets`. A facet left out of `filters` is
  still lifted, sorted by, and shown on cards as now.
- `label` is optional, and otherwise the wording layer's label for the path,
  as the tree reads it now.
- `control` is one of:

  | Control | For | Shows |
  |---|---|---|
  | `chips` | A short enum or a short ordered scale | A wrapping row of chips (`aria-pressed`), each with its count |
  | `checkboxes` | An enum whose values need their full names | A vertical list of checkboxes, each with its count |
  | `range` | A long numeric scale | Min and max inputs, as a range facet has now |
  | `toggle` | A boolean | One chip that filters to `true` |
  | `combobox` | A long enum | A type-ahead field that adds the chosen values as removable chips |

- A `groups` facet ([Type registry](../../docs/site.md#type-registry)) under
  `checkboxes` lists its groups indented under their parents, always open.
- A filter shows when some entry of the type has a value for it, or it's
  active.
- `defaultFilters` is removed, since nothing in the menu starts closed.
- The registry gains a per-ruleset `defaultType`: the type the Library opens
  on when the URL names none.

Values within a filter still combine as OR, and filters as AND. Counts,
search, and matching are as in [Gallery](../../docs/site.md#gallery)
"Filters".

### Sort

The sort menu offers name, date added, and the active type's facets, minus
card-only ones, in registry order. The rules for a path two checked types
share go away, since only one type is ever checked.

### URL state

`f.type` holds one type, `<ruleset>/<type>`. A URL with several reads the
first the Library has, and one with none, or none it has, reads `defaultType`.
The gallery writes the type back in every URL, so a link always names it.
Filters on another type's paths are ignored, as unknown paths are now. The
redirects from type galleries and a detail page's type link keep working
unchanged.

### Draft filters per type

A draft for the owner to edit before the build. Facets not listed stay
lifted for sort and cards.

| Type | Filters (control) |
|---|---|
| Background | Abilities (chips), Skills (combobox), Feat (checkboxes) |
| Character | Class (checkboxes), Level (range), Species (checkboxes), Background (checkboxes) |
| Class | Primary ability (chips), Hit die (chips), Spellcasting (chips) |
| Condition | None |
| Creature | CR (range), Creature type (checkboxes), Size (chips), Damage immunities (combobox), Condition immunities (combobox) |
| Encounter | XP (range), Creature types (checkboxes) |
| Equipment | Group (checkboxes), Cost (range), Damage type (chips), Properties (combobox), Mastery (chips) |
| Feat | Category (chips), Level (range), Repeatable (toggle) |
| Item | Rarity (chips), Category (checkboxes), Attunement (toggle), Cursed (toggle) |
| Map | Scale (chips) |
| Module | None |
| Species | Size (chips), Speed (range), Creature type (chips) |
| Spell | Level (chips), School (chips), Class (checkboxes), Concentration (toggle), Ritual (toggle), Casting time (chips) |
| Subclass | Class (checkboxes) |

## Cases

- `creature/adult-red-dragon` under CR 15–20 and Creature type › Dragon.
- `creature/lich`, found through Condition immunities by typing "poi" and
  choosing Poisoned.
- `spell/fireball` under Level › 3 and School › Evocation; `spell/bless` under
  Concentration.
- `feat/alert` under Category › Origin, with no other type's values offered.
- `equipment/astronomers-tools` under Group, with its groups indented and
  open.
- `module/library-anomalies`: a type with no filters shows only Search, Type,
  Sources, and Rules.
- An old link, `?f.type=dnd-5e-2024/spell,dnd-5e-2024/creature`, opens on
  Spells.

## Migration

- `config/types.json`: each type gains `filters`, from the table above as
  the owner amends it; `defaultFilters` is removed; the ruleset gains
  `defaultType`. The registry schema and `tests/` fixtures change with it.
- No entries change.

## Done when

- The Library's menu is search, the Type dropdown, Sources, the active type's
  flat filters, and Rules, with no disclosure in the filters.
- Each control renders, filters, and counts as above; tests cover each
  control, changing type, and every URL case under Cases.
- Docs: [Gallery](../../docs/site.md#gallery) and
  [Type registry](../../docs/site.md#type-registry) describe the new menu and
  keys; `docs/decisions.md` has the build's rows.
- Screenshots at 390, 820, and 1440px.

## Open questions

- **The default type.** Which type `dnd-5e-2024` opens on.
