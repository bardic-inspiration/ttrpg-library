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
  the print cart and set actions.
- [Detail page](../../docs/site.md#detail-page) and
  [Accordion pages](../../docs/site.md#accordion-pages): sections, the
  contents list, and links.
- [Rules pages](../../docs/site.md#rules-pages) and
  [Equipment](../../docs/rulesets.md#equipment): SRD equipment and conditions
  as sections of rules pages, and as Library cards that open those sections
  ([Index build](../../docs/site.md#index-build)).
- [Controls](../../docs/export.md#controls): Print and Download.
- [Page header](../../docs/site.md#page-header): search and the set export on
  every page.
- [Pages and navigation](../../docs/site.md#pages-and-navigation) and
  [Redirects](../../docs/site.md#redirects): one Library per ruleset at
  `/<ruleset>/`, with Sources and Types filters, `/` opening the home
  ruleset's, and the Rulesets page listing each ruleset.

## Design

### Entry and long pages

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
- `spell/fireball` and `creature/mage`: a chip for the spell's level on its
  card, and a card that opens its entry anywhere on it.
- `item/ring-of-protection`: added to the cart from its page, and still in
  the cart on the Library after a reload.
- `condition/fading`: a custom condition's card beside the SRD conditions'
  cards, which open their sections on the Conditions page.

## Done when

- Each ruleset has its own Library page with the Sources and Types filters,
  and the Library has the cart and cards for SRD equipment and conditions.
- The page revisions above are built, with screenshots at 390, 820, and
  1440px, and the milestone's accessibility review filed.

## Open questions

- **The About page's source link (#425):** the site is to have no GitHub
  references but Contribute, and entry pages now have none. The About page's
  link to `ATTRIBUTION.md` on GitHub stays, as licensing credit. Open: whether
  "The source is on GitHub", which duplicates Contribute, goes.

- **The Rulesets page redesign (#427):** a full redesign of the page beyond
  its list of rulesets, each linked to its Library, through a design process of its own.
  Not built until it's designed.

## Out of scope

- A phone filter sheet with a sticky "Show N results", and active filter
  chips.
- A way back to results (breadcrumb, prev/next), and other state and URL
  design.
- Detail page title, width, and export placement: kept.
- A compact list view, a two-column creature stat block, pin, compare, and
  recently viewed, a dark palette, and a keyboard and screen-reader pass:
  not yet discussed.
