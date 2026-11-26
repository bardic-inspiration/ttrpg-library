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
  [Redirects](../../docs/site.md#redirects): the Library at `/` across
  rulesets, the Rulesets page, and `/<ruleset>/` redirecting to the Library
  with the ruleset filter.

## Design

### The Library

- **One Library per ruleset.** Each ruleset has its own page, `/<ruleset>/`,
  holding its own Library: the gallery over that ruleset's entries, so types
  and content never mix between rulesets. The ruleset stays part of a view's
  filter state, set by the page rather than in the menu, so the filter tree
  has no Ruleset node and nothing in it groups by ruleset.
- **Maps across rulesets.** A ruleset's Library shows every map compatible
  with its ruleset. While a map belongs to one ruleset
  ([`maps.md`](maps.md)), that is its own ruleset's Library; once a map can
  serve several, it shows in each of theirs.
- **The Rulesets page** (`/rulesets/`) lists every ruleset, each linked to its
  page. Each ruleset's rules pages and Extensions page stay listed under it
  until the page's redesign (Open questions).
- **Filters** have two sections, **Sources** and **Types**, in place of the
  Ruleset node and its groups.
  - **Sources** holds **Official**, a checkbox for the ruleset's own material
    (today's author `"publisher"`: the SRD for `dnd-5e-2024`) with nothing
    under it, then **Homebrew**, a group holding **Source** and **Author**,
    the homebrew entries' sources and authors (`f.source`, `f.author`).
    Homebrew is a group, not a checkbox. Official is checked on a fresh
    Library. The section stays additive: an entry shows when it matches any
    checked box, so checking a homebrew collection adds its entries to the
    official ones.
  - **Types** holds the ruleset's types, each with its facets, as a
    ruleset's Types group does today.
- **Every filter checkbox behaves the same way:** it reads checked when its
  filter holds its value, and a click adds or removes that value. No box
  reads checked from the results alone, so Official reads checked on a fresh
  Library because the default filter holds it.
- **What the change touches:**
  - **Old links keep working** (P9). A Library URL whose `f.ruleset` names
    one ruleset opens that ruleset's page with the rest of its query, showing
    what it showed: the whole ruleset, homebrew included. `/<ruleset>/<type>/`
    redirects to `/<ruleset>/` with the type checked, and so does a detail
    page's type link.
  - **Search** in the page header, on a ruleset's page or a page of its
    entries or rules, opens or searches that ruleset's Library.
  - **The cart** stays one across rulesets, so its count and the set export
    on other pages are unchanged; on a ruleset's page, Print and Download act
    on the cart when it holds anything, as on today's Library.
  - **SRD equipment and conditions** show as cards in their ruleset's
    Library.

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
- `/dnd-5e-2024/` on a fresh load: Sources › Official checked and only
  official entries listed, no Ruleset node; checking a homebrew source under
  Homebrew › Source adds its entries.
- The fixture rulesets: each ruleset's page lists only its own types and
  entries, and `/?f.ruleset=<ruleset>` opens that page.
- `condition/fading`: a custom condition's card beside the SRD conditions'
  cards, which open their sections on the Conditions page.

## Done when

- Each ruleset has its own Library page with the Sources and Types filters,
  and the Library has the cart and cards for SRD equipment and conditions.
- The page revisions above are built, with screenshots at 390, 820, and
  1440px, and the milestone's accessibility review filed.

## Open questions

- **The home page and the Library link (#421):** with one Library per
  ruleset, `/` and the top bar's Library link need a target: the Rulesets
  page, the one ruleset's Library while the library has only one, or a
  default ruleset's Library. Search from a page outside every ruleset (About,
  Rulesets) opens the same target with the query. The ruleset pages and their
  filters can be built first; until this is decided, `/` stays today's
  Library across rulesets.

- **The About page's source link (#425):** the site is to have no GitHub
  references but Contribute, and entry pages now have none. The About page's
  link to `ATTRIBUTION.md` on GitHub stays, as licensing credit. Open: whether
  "The source is on GitHub", which duplicates Contribute, goes.

- **The Rulesets page redesign (#427):** a full redesign of the page beyond
  its list of rulesets (Design above), through a design process of its own.
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
