---
issue: 114
depends: [ui]
---

# Style

## Goal

A visual style for the redesigned UI ([`ui.md`](ui.md)) that feels like an
architectural print from the early 20th century: early modern, innovative,
and romantic, as an unconventional take on a fantasy sourcebook. The
inspiration is Frank Lloyd Wright's Wasmuth portfolio. It serves P9 (an
original look) and P10 (cheap, safe refinement through tokens).

## Current

- [Styling system](../../docs/styling.md#styling-system),
  [Tokens](../../docs/styling.md#tokens), and
  [Themes](../../docs/styling.md#themes).
- [Visual direction](../../docs/styling.md#visual-direction): v1's
  reference-book look and the Alegreya typefaces.

## Design

### Starting point

The owner's style package in [`style-package/`](style-package/README.md) is
the starting point. It was made for the v1 interface, so the build reworks it
as the new components arrive. From it:

- **Palette:** its light palette only, a cotton-rag paper background and
  ivory surfaces with espresso-sepia ink. Its dark palette is not used: the
  site has one palette ([`ui.md`](ui.md)).
- **Typefaces:** Tenor Sans for headings, Crimson Pro for body and rules
  text, and Josefin Sans for controls, badges, and labels, all self-hosted
  through Fontsource, as v1's fonts are.
- **Shapes and ornament:** square corners, the corner piers and top rule on
  cards and stat blocks, the double-rule page frame, and its two ornaments,
  the frieze divider and the corner medallion.

### Accents

Every type has its own art-glass accent color, and so does each item rarity,
in the package's saturated, glass-like range. The package covers three types;
the build adds one for each v2 type ([`types.md`](types.md)), each meeting
the contrast bar on the palette's surfaces.

### Art

Art is late-1800s and early-1900s book illustration and architectural
drawing that is public domain or CC-licensed: art nouveau, early modern, and
similar pen-and-ink work, such as Harry Clarke's and Aubrey Beardsley's
plates. It is lightly processed, kept monochrome or tinted to fit the
palette. The style works with no art too. Sourcing, processing, and hosting
are the art workflow's (#117).

### Tokens

The token layers stay as they are, minus the theme blocks: one set of
semantic and content tokens, no `[data-theme]` selectors, and no
`prefers-color-scheme` block. The package's values move into the token
files under the repo's token names; nothing is left in `overrides.css`.

### Originality

Frank Lloyd Wright and the Wasmuth portfolio are inspiration only. Neither is
named on the site, and the design reproduces no Wright work, as v1's rule
against reproducing official art or ornament already requires.

### Rework in the build

- Padding, including the package's card styles reaching the detail page's
  header wrapper (`[data-type]` on more than cards).
- Font sizes and letter heights.
- Components the UI redesign adds: the filter tree, accordion sections, and
  the rules pages.

The spike (#207) shows the package on the v1 site at phone, tablet, and
desktop widths.

## Cases

- `creature/lich`: its detail page, with the header wrapper free of card
  styling.
- `magic-item/boots-of-levitation`: a rarity accent on an item.
- `spell/fireball`: a type accent on a spell.

## Done when

- The token files hold the palette, typefaces, and accents, with one set of
  colors and no theme selectors, and the Stylelint token rule passes.
- Every v2 type and item rarity has an accent token. Its contrast on the
  palette's surfaces is checked in the milestone's accessibility review, since
  the contrast test leaves CI ([`ui.md`](ui.md)).
- No page names Frank Lloyd Wright or the Wasmuth portfolio.

## Out of scope

- The art workflow: #117.
- The layout and components themselves: [`ui.md`](ui.md).
