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

Below `64rem`, the header is the whole bar, in three thin rows:

1. "TTRPG Library", then the cart and Export, right-justified.
2. Search, full width. On a Library it's the Library's own search, moved out
   of the menu.
3. On a Library: the Type dropdown, then a **Filters** button and a **Rules**
   button (each `aria-expanded`). Filters opens a panel over the results
   holding Sources and the type's filters; Rules opens one holding the Rules
   list. Off a Library, there's no third row.

The results fill the rest of the screen.

## Cases

- `creature/bandit` among 475 creatures: scrolled to the end of the results,
  the desktop sidebar and the header are still in view.
- On a 390px phone, the bar is three rows, and the first result shows
  without scrolling.

## Done when

- The results scroll in their own container on a Library; the header, the
  footer's links, and the desktop sidebar stay in view.
- On phones and tablets the bar is the three rows above; Filters and Rules
  each open and close their panel, with focus moving into it and back to its
  button on close.
- `npm run a11y` passes, and the reflow check at 320px passes.
- Docs: [Gallery](../../docs/site.md#gallery) "Layout".
- Screenshots at 390, 820, and 1440px.
