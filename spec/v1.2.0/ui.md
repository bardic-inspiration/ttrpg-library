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

- [Styling](../../docs/styling.md): tokens, the palette, the style guide at
  `/styleguide/`, and its [Standards](../../docs/styling.md#standards) for
  headings, spacing, and links.
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

### Interaction patterns

1. **Inventory** every interactive pattern: filter tree disclosures,
   accordions, contents lists, the Download menu, cards, buttons, and
   checkbox, chip, and toggle controls. Link underlines are settled
   ([Links](../../docs/styling.md#links)).
2. **One rule each** in the style guide:
   - **Disclosure:** one component, chevron on the left, rotating when open.
     The filter tree and the collapsible reference lists use it.
   - **Click targets:** the whole card opens its entry, with the cart control
     above that link.
   - **Buttons:** a fixed set of primary, secondary, and icon variants, each
     with a fixed placement.
   - **Controls:** when to use a checkbox, a chip, or a toggle.
3. **Shared components** for each, shown on `/styleguide/`.
4. **Migrate in one pass**, with a test that fails when a page builds its own
   disclosure or card link.

### Chip or text

A field's schema declares how its value reads, with a `display` keyword:
`"display": "chip"` renders it as a chip, and a field without it renders as
text. The keyword sits in the type's schema beside the field, so it serves
any ruleset, and a field shared through a ruleset's shared definitions
carries it once.

- **Cards:** a chip field shows its value alone, as a chip; a text field
  shows its label and value. This ends the repeated labels ("Level Level 2",
  "Category General").
- **Filters:** a facet on a chip field lists its values as chips rather than
  checkboxes, for small-range facets such as spell level and CR.
- **Validation:** `display` takes only `chip`, and only on a field a facet
  could read (a string, number, boolean, or array of strings); anything else
  fails (P2).

### The Library

- **Cards** keep the official star. The source moves from a badge to a
  smaller line at the bottom of the card.
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

- **Reference lists are collapsible**, with the shared disclosure.
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

- `/styleguide/` shows every shared component, and a test fails when a page
  builds its own disclosure or card link.
- The schema `display` keyword drives chips on cards and in filters, and
  validation rejects it anywhere else.
- The Library has the flattened filters, the cart, and cards for SRD
  equipment and conditions.
- The page revisions above are built, with screenshots at 390, 820, and
  1440px, and the milestone's accessibility review filed.

## Open questions

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
