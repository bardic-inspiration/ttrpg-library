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

One row on every page from `64rem`; below it, the same controls stack into
the phone bar ([layout.md](layout.md)):

- **Left:** "TTRPG Library", linking to the home ruleset's Library.
- **Middle:** search, off a Library, as now
  ([Page header](../../docs/site.md#page-header)).
- **Right, right-justified:** the cart, then Export.

The top bar (`SiteNav.astro`) and its links are removed.

### Export

One button, **Export**, replaces Print and Download. It's the shared menu
button ([Controls](../../docs/export.md#controls)): its menu lists **Print**
first, then the `download` exporters that offer the scope, in config order.
Choosing one closes the menu and runs it.

Export acts on the cart, and only the cart, on every page: its accessible name
is "Export 3 in cart", and it's disabled while the cart is empty. The Library's
filtered results are no longer a scope; a reader adds entries to the cart to
export them, and a single entry is exported the same way.

Detail pages lose their own Print and Download (`ExportButtons` there), and
keep their "In cart" checkbox. Rules pages lose their Print
(`PagePrint.astro`) and have no export: they're for reference on the web.

### PNG for the cart

PNG becomes a cart format, one image per entry
([PNG](../../docs/export.md#png)):

- **Capture fragments.** The build emits each card entry's capture source at
  `capture/<ruleset>/<type>/<id>/`, as it emits print fragments
  ([Print](../../docs/export.md#print) "Print fragments"): the markup
  `CaptureSource.astro` puts on a detail page now, which the detail page no
  longer carries. At export, `capture.ts` fetches only the cart's fragments
  and captures each in turn, as it captures one now.
- **Files.** One entry downloads as `<id>.png`. Several download as one zip,
  `library-<YYYYMMDD>.png.zip`, holding `<type>-<id>.png` per entry, in cart
  order.
- **Scope.** PNG is in Export's menu while the cart holds a card entry. A page
  type (class, subclass, species) has no capture source, so it's skipped and
  listed in the export report ([Controls](../../docs/export.md#controls)). If
  a fragment fails to load or a capture fails, nothing downloads, and the
  status says which entry.

### The cart

The count "Cart: N" becomes a cart icon with the number beside it, directly
left of Export. It's a menu button (`aria-expanded`, named "Cart, 3 entries")
whose menu lists the cart's entries in the order added, each by name and
type, with:

- a **Remove** control per entry;
- **Clear**, which removes every entry;
- **Close**, which closes the menu, as Escape and moving focus out of it do.

A removed entry stays in the list, marked removed, until the menu closes; then
the cart's contents refresh, and every "In cart" checkbox and the count follow
it. The results' summary loses its "N in cart" and Empty cart button, which the
menu replaces.

### The footer

The footer holds two small links, **Attribution** and **GitHub**.
Attribution links to an Attribution section in the repository's `README.md`
on GitHub, and GitHub to the repository. The full SRD statement moves off the
footer to that section. Printed pages keep their own statement
([SRD attribution](../../docs/licensing.md#srd-attribution)).

### The About page

`/about/` is removed, and its content (what the library is, the SRD
statement, and the licenses) moves into the README's Attribution section,
which links `ATTRIBUTION.md` for the full credits. `/about/` redirects
([Redirects](../../docs/site.md#redirects)) to that section, so old links
keep working.

## Cases

- `creature/lich`'s page: the header shows the cart and Export; the page has
  no Print or Download of its own; Export acts on the cart, and is disabled
  while it's empty.
- `spell/fireball` alone in the cart: PNG downloads `fireball.png`. With
  `creature/lich` added, PNG downloads one zip of two images.
- `spell/fireball` and `spell/bless` in the cart: removing Fireball in the
  cart menu marks it removed but keeps it listed; closing the menu drops it,
  and its card's "In cart" unchecks.
- An empty cart on the Library: Export is disabled, whatever the filters
  show.
- A rules page: no Print, and the header's Export acts on the cart.

## Migration

- Removes `SiteNav.astro`, `about.astro`, and `PagePrint.astro`, and the
  detail page's export controls and capture source; the build emits capture
  fragments instead.
- `README.md` gains the Attribution section.
- [SRD attribution](../../docs/licensing.md#srd-attribution) and
  [New rulesets](../../docs/licensing.md#new-rulesets) are updated for the
  statement's new places.
- No entries change.

## Done when

- Every page's header is the row above, with no top bar.
- Export is the only export control on any page, with Print and the download
  formats in its menu, and acts on the cart alone; tests cover it on the
  Library, a detail page, and a rules page.
- PNG exports the cart as one image, or a zip of one image per entry, with
  tests for one entry, several, a page type skipped, and a failed capture.
- The cart menu removes, clears, closes, and refreshes on close as above, with
  tests.
- The footer is two links, `/about/` redirects, and the link check passes.
- Docs: [Pages and navigation](../../docs/site.md#pages-and-navigation),
  [Page header](../../docs/site.md#page-header),
  [Controls](../../docs/export.md#controls), [PNG](../../docs/export.md#png), and
  [SRD attribution](../../docs/licensing.md#srd-attribution).
- Screenshots at 390, 820, and 1440px.
