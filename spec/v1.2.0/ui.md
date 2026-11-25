---
issue: 402
depends: []
---

# Site UI revision

## Goal

Settle the site's look and interaction under one structure, a style guide
with shared components, then revise the Library and the long pages on it.
The new types' pages (characters, maps, encounters, modules) are built from
these components. It serves P6 (templates own presentation), P10 (cheap, safe
refinement through tokens and a style guide), and P8 (a test enforces the
shared components).

## Current

- [Styling](../../docs/styling.md): tokens, the palette, the style guide
  at `/styleguide/`, and its
  [standards](../../docs/styling.md#hierarchy-and-standards) for text roles,
  headings, rhythm, and underlines, and its
  [shared components](../../docs/styling.md#shared-components): the
  disclosure, the card link, buttons, and the checkbox, chip, and toggle.
- [Display](../../docs/content-model.md#display): the schema's `display`
  keyword, chips on cards and in enum facets' filters.
- [Gallery](../../docs/site.md#gallery): cards, the filter tree, sort, and
  selection and set actions.
- [Detail page](../../docs/site.md#detail-page) and
  [Accordion pages](../../docs/site.md#accordion-pages): sections, the
  contents list, and links.
- [Rules pages](../../docs/site.md#rules-pages) and
  [Equipment](../../docs/rulesets.md#equipment): SRD equipment and conditions
  as sections of rules pages only.
- [Controls](../../docs/export.md#controls): Print and Download.

## Design

### The Library

- **Filters, flattened** to two sections, **Source** and **Types**, in place
  of the Ruleset node and its groups. Source holds the sources and authors,
  official ones pinned first, as today. With more than one ruleset, each
  section groups its values under each ruleset's label. A checkbox shows
  whether the current results include what it stands for, so a ruleset whose
  entries show reads checked.
- **Search and the set export move into the standard page header**, on
  every page. Search opens the Library with the query; Print and Download act
  on the cart or, on the Library, the filtered results. A detail page's own
  export controls stay where they are.

### The print cart

A cart replaces the cards' Select checkboxes.

- **Adding:** a control on each card and detail page adds the entry to the
  cart or removes it. The header shows the cart's count.
- **Persistence:** the cart lives in the browser's local storage, keyed by
  `<ruleset>/<type>/<id>`, so it survives page changes and reloads in that
  browser. Every read and write is wrapped so the site works with storage
  blocked, the cart then lasting only for the page. It isn't in the URL.
- **Acting on it:** Print and Download target the cart when it holds
  anything, in the order entries were added, and otherwise the filtered
  results, with accessible names that say which, as today.
- An entry removed from the library drops out of the cart on the next load.

### SRD equipment and conditions as cards

The SRD's equipment and conditions are rules primitives, so the Library
counts Condition and Equipment by their custom entries alone. They gain
gallery cards.

- **Each primitive has a card** in the Library under its type, filtered and
  sorted with the type's custom entries.
- **The card opens the primitive's section on its rules page.** Primitives
  have no detail page, and refs to them still land on that section.
- **Print and the cart** take a primitive's card like any other.

### Entry and long pages

- **Reference lists are collapsible**, with the shared disclosure (`Details`).
- **A ref listed under a specific label** ("Cast by", "Casts") isn't listed
  again under the generic "Referenced by".
- **No GitHub references on the site** except the Contribute link: the
  provenance line drops its source issue links ("From #134").
- **Rules pages render as text**, each section under a lower-order
  subheading, not as collapsible headings. The contents list stays.
- **A structured summary section** opens pages with several sections
  (classes, subclasses, species, rules pages) in place of today's contents
  list on page types: the page's sections grouped as the page groups them,
  with a class's features by level rather than as one link per "Level N:"
  heading. The class page's "Becoming a Barbarian …" heading is written out
  in full.
- **Class page width:** the Features table gets the room it needs, so its
  links don't wrap.

## Cases

- `class/barbarian`: the structured summary in place of 30 "Level N: …"
  links, and a Features table that fits.
- `spell/acid-arrow`: its two dragons listed once, under "Cast by".
- `spell/fireball` and `creature/mage`: a chip for the spell's level on its
  card, and a card that opens its entry anywhere on it.
- `item/ring-of-protection`: added to the cart from its page, and still in
  the cart on the Library after a reload.
- `condition/fading`: a custom condition's card beside the SRD conditions'
  cards, which open their sections on the Conditions page.

## Done when

- The Library has the flattened filters, the cart, and cards for SRD
  equipment and conditions.
- The page revisions above are built, with screenshots at 390, 820, and
  1440px, and the milestone's accessibility review filed.

## Open questions

- **Chip range facets:** a chip facet lists its values as chips "for
  small-range facets such as spell level and CR", but both are range facets,
  with min and max inputs and `min..max` URLs. Either chips stand in for the
  inputs (a pressed set filters as an enum, `f.stats.level=1,3`, and old
  range links need handling), or range facets keep their inputs and
  [`display`](../../docs/content-model.md#display) changes only their cards.
  Also: whether CR's chip reads its bare value ("1/8") or "CR 1/8". Until
  this is decided, range facets keep their inputs and CR isn't marked (#420).

- **Flattened filters and checkbox state (#421):** with one ruleset, the
  sections don't group by ruleset, so no ruleset checkbox is left. Either the
  ruleset filter (`f.ruleset`) is set only by URL and the `/<ruleset>/`
  redirects, or each section shows the ruleset's label even with one. With
  several, it's open whether the label is a checkbox for `f.ruleset` in both
  sections, in one, or in neither. Also open: whether "a checkbox shows whether
  the current results include what it stands for" covers only the ruleset set
  or types and values too, and what clicking a box does when it reads checked
  only from the results. On a fresh Library, D&D 5e's official entries show,
  but `f.ruleset` doesn't hold it, so a click that adds it would turn 965
  results into 1296 with no visible change to the box. One answer is a mixed
  state while only some of its entries show. Until this is decided, the
  Library keeps the Ruleset node and its groups.

- **The Rulesets page redesign:** a full redesign of today's bare list of
  each ruleset's rules pages, through a design process of its own. Not built
  until it's designed.

## Out of scope

- A phone filter sheet with a sticky "Show N results", and active filter
  chips.
- A way back to results (breadcrumb, prev/next), and other state and URL
  design.
- Detail page title, width, and export placement: kept.
- A compact list view, a two-column creature stat block, pin, compare, and
  recently viewed, a dark palette, and a keyboard and screen-reader pass:
  not yet discussed.
