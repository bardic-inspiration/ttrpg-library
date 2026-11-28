---
issue: 532
depends: []
---

# Header and footer

## Goal

Put the site's controls in one place on every page. The top bar's links
(Library, About, Contribute) go, the About page goes, and the header becomes
one row: the site name on the left, the cart and one Export button on the
right. Export appears nowhere else, so a reader always finds it in the same
place. The footer shrinks to two small links. It serves P9 (attribution and
stable URLs) and P6.

## Current

- [Pages and navigation](../../docs/site.md#pages-and-navigation): the top
  bar, the About page, and the footer.
- [Page header](../../docs/site.md#page-header): search and the set export.
- [Controls](../../docs/export.md#controls): Print and Download, in the
  header, on detail pages, and on rules pages.
- [Gallery](../../docs/site.md#gallery) "Cart and set actions": the cart, its
  count, and Empty cart.
- [Detail page](../../docs/site.md#detail-page): its export controls and
  "In cart".
- [SRD attribution](../../docs/licensing.md#srd-attribution): where the
  statement shows.
- Code: `site/src/components/SiteNav.astro`, `header/HeaderActions.tsx`,
  `export/ExportButtons.tsx`, `export/PagePrint.astro`, `Footer.astro`,
  `site/src/pages/about.astro`.

## Design

### The header

One row on every page:

- **Left:** "TTRPG Library", linking to the home ruleset's Library.
- **Middle:** search, off a Library, as now
  ([Page header](../../docs/site.md#page-header)).
- **Right, right-justified:** the cart, then Export.

The top bar (`SiteNav.astro`) and its links are removed.

### Export

One button, **Export**, replaces Print and Download. It's the shared menu
button ([Controls](../../docs/export.md#controls)): its menu lists **Print**
first, then the `download` exporters that offer the scope, in config order.
Choosing one closes the menu and runs it. Its scope and accessible name
follow today's set export: the cart when it holds anything ("Export 3 in
cart"), otherwise on the Library the filtered results ("Export 12 entries"),
and it's disabled when it would target nothing.

Detail pages and rules pages lose their own Print and Download
(`ExportButtons` there, `PagePrint.astro`). A detail page keeps its "In cart"
checkbox.

### The cart

The count "Cart: N" becomes a cart icon with the number beside it, directly
left of Export. It's a menu button (`aria-expanded`, named "Cart, 3 entries")
whose menu lists the cart's entries in the order added, each by name and
type, with:

- a **Remove** control per entry;
- **Clear**, which removes every entry.

A removed entry stays in the list, marked removed, until the menu closes; then
the cart's contents refresh, and every "In cart" checkbox and the count follow
it. The results' summary loses its "N in cart" and Empty cart button, which the
menu replaces.

### The footer

The footer holds two small links, **Attribution** and **GitHub**. The full
SRD statement moves off the footer to the attribution target. Printed pages
and PNG captures keep their own statements
([SRD attribution](../../docs/licensing.md#srd-attribution)).

### The About page

`/about/` is removed and redirects
([Redirects](../../docs/site.md#redirects)) to the attribution target, so old
links keep working. Its licenses list moves there too.

## Cases

- `creature/lich`'s page: the header shows the cart and Export; the page has
  no Print or Download of its own; Export acts on the cart.
- `spell/fireball` and `spell/bless` in the cart: removing Fireball in the
  cart menu marks it removed but keeps it listed; closing the menu drops it,
  and its card's "In cart" unchecks.
- An empty cart on the Library: Export reads "Export N entries" for the
  filtered results.

## Migration

- Removes `SiteNav.astro`, `about.astro`, and `PagePrint.astro`, and the
  detail page's export controls.
- [SRD attribution](../../docs/licensing.md#srd-attribution) and
  [New rulesets](../../docs/licensing.md#new-rulesets) are updated for the
  statement's new places.
- No entries change.

## Done when

- Every page's header is the one row above, with no top bar.
- Export is the only export control on any page, with Print and the download
  formats in its menu; tests cover its scope on the Library, a detail page,
  and a rules page.
- The cart menu removes, clears, and refreshes on close as above, with tests.
- The footer is two links, `/about/` redirects, and the link check passes.
- Docs: [Pages and navigation](../../docs/site.md#pages-and-navigation),
  [Page header](../../docs/site.md#page-header),
  [Controls](../../docs/export.md#controls), and
  [SRD attribution](../../docs/licensing.md#srd-attribution).
- Screenshots at 390, 820, and 1440px.

## Open questions

- **The cart menu's third action.** The brief names three things the cart
  menu does and lists two: removing an entry and clearing the cart.
- **Export off the Library with an empty cart.** On a detail page, whether
  Export acts on that entry, which keeps PNG capture (today only a detail
  page offers PNG), or is disabled until the entry is in the cart. On a rules
  page, whether Export offers the browser's print of the page.
- **The attribution target.** A small on-site page holding the SRD statement
  and licenses, or `ATTRIBUTION.md` on GitHub. CC BY 4.0 allows attribution
  through a link to a page that carries it; an on-site page keeps it under the
  site's own URLs (P9).
