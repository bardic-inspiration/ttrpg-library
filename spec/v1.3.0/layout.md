---
issue: 532
depends: [library-menu, header]
---

# Library layout

## Goal

Keep the menu in reach. Today the Library is one long page, and scrolling down
the results scrolls the menu away. The results get their own scroll container
under a fixed header, the desktop sidebar stays put, and on phones the menu
collapses into a thin bar that doesn't block the results. It serves P10.

## Current

- [Gallery](../../docs/site.md#gallery) "Layout": the sidebar from `64rem`,
  the stacked menu and Filters button below it, and `scrollbar-gutter`.
- [Page header](../../docs/site.md#page-header).
- Tokens in `tokens/components.css` ([Tokens](../../docs/styling.md#tokens)).

## Design

### Every width

On a Library, the page fills the viewport: the header row
([header.md](header.md)) at the top, the footer's links at the bottom, and
between them the menu and the results. The results scroll inside their own
container, with Sort and the result count fixed at its head. The page itself
doesn't scroll. The results keep `scrollbar-gutter: stable` on their
container.

Other pages scroll as a page, as now.

### Desktop

From `64rem`, the menu is a sidebar that doesn't move while the results
scroll. If the menu is taller than the space between header and footer, it
scrolls on its own.

### Phones and tablets

Below `64rem`, the header row is the whole bar: "TTRPG Library", search (on
a Library, its own search, which moves out of the menu), a **Menu** button
(`aria-expanded`), the cart, and Export. Menu opens a panel over the results
holding Type, Sources, the type's filters, and Rules. The results fill the
rest of the screen.

## Cases

- `creature/bandit` among 475 creatures: scrolled to the end of the results,
  the desktop sidebar and the header are still in view.
- On a 390px phone, the bar is one row, and the first result shows without
  scrolling.

## Done when

- The results scroll in their own container on a Library; the header, the
  footer's links, and the desktop sidebar stay in view.
- On phones and tablets the bar is one row, and Menu opens and closes the
  panel, with focus moving into it and back to Menu on close.
- `npm run a11y` passes, and the reflow check at 320px passes.
- Docs: [Gallery](../../docs/site.md#gallery) "Layout".
- Screenshots at 390, 820, and 1440px.

## Open questions

- **The phone row.** Whether the site name, search, Menu, the cart, and
  Export fit one row at 390px as they are, or something shrinks: a shorter
  name, icon buttons for Menu and Export, or search behind an icon.
