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
  structured summary, with a class's features by level, the class page's
  width, and links.
- [Rules pages](../../docs/site.md#rules-pages), as text, and
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

### The Rulesets page

- **A full redesign** of the Rulesets page, beyond today's list of each
  ruleset linked to its Library, with its rules pages and its Extensions
  page. Its design is open ("Open questions"), and nothing here is built until
  it's designed.

## Done when

- The Rulesets page is redesigned and built, with screenshots at 390, 820,
  and 1440px.

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
