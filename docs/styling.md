# Styling

## Purpose

How the site looks and how that's kept accessible and easy to change. Most
visual changes are an edit to one tokens file, every rendered state can be seen
on one page, and tests catch accessibility regressions.

## Behavior

### Styling system

- Plain modern CSS: custom properties, nesting, cascade layers, and container
  queries. No CSS framework, preprocessor, or CSS-in-JS. The target is the last
  two versions of evergreen browsers.
- Component styles live in each Astro component's scoped `<style>` block. A
  Preact island can't carry one, so its styles sit in one stylesheet beside its
  components, imported by the island (`components/gallery/gallery.css`) and
  linted like any other.
- Global styles are a small, fixed set of files in `site/src/styles/`, loaded in
  this layer order:

  ```css
  @layer reset, tokens, base, layout, components, utilities, overrides;
  ```

  Each scoped `<style>` block wraps its rules in `@layer components { … }`,
  because unlayered styles would beat every layer. `overrides.css` is an empty
  file reserved for quick experiments, which always win without specificity
  fights.
- Class names are stable, readable, and component-scoped
  (`.statblock__header`, `.card__summary`), so an experiment can target
  anything.

### Tokens

| File | Holds | Edit it to change |
|---|---|---|
| `tokens/primitives.css` | Raw values: palette, font families, type scale, spacing, radii, shadows, durations | The palette or the scales |
| `tokens/semantic.css` | Meanings mapped to primitives: `--color-bg`, `--color-text`, `--color-accent`, `--font-heading`, `--space-card`, … | What a role looks like |
| `tokens/components.css` | Per-component knobs that default to semantic tokens: `--statblock-rule-color`, `--card-min-width`, `--grid-gap`, `--table-*`, … | One component's look without touching its code |
| `tokens/content.css` | Data-driven accents: one variable per entry type and item rarity | Type and rarity colors |
| `tokens/print.css` | Print sizing and margins for the wide and narrow print layouts, and the page-width breakpoint between them ([Print layout](export.md#print-layout)) | Print density, margins, or the breakpoint |

- **Components use only semantic, component, and content tokens**, never
  primitives or literal values. A color, font, size, spacing, radius, shadow, or
  duration written as a literal outside `tokens/` fails Stylelint in
  `npm run check`: hex, named, and functional colors, length and time units,
  and literal font families, weights, line heights, and shadows. Percentages,
  viewport units, `0`, `auto`, and keywords are allowed.
  `tests/stylelint.test.ts` proves each rule fires.
- **Accents come from data attributes**, not per-type CSS. Cards and stat
  blocks carry `data-type` (and `data-rarity` for items), and one rule maps each
  to `--accent`. A new type needs one variable in `content.css`; without one it
  falls back to `--color-accent`. Tokens built on `--accent` are re-declared on
  `[data-type]` and `[data-rarity]`, so each element takes its own accent.
- **Layout values are tokens too**: card minimum width, gaps, stat-block column
  gap, and container-query breakpoints. The gallery's desktop breakpoint is a
  media query in `tokens/components.css` that switches its layout knobs
  (`--gallery-columns` and the filter menu's display), since a media query
  can't read a custom property
  ([Gallery](site.md#gallery) "Layout").

### Palette

- The site has one palette: warm paper and ink. Its colors are one set of
  semantic tokens (and type and rarity colors) on `:root`, with no theme
  attribute, no `prefers-color-scheme` block, and no theme switch. Screen,
  print, and PNG capture all render with it. `tests/site/palette.test.ts`
  fails if a theme attribute or color-scheme query returns to the site's
  source.

### Visual direction

- **Feel:** a clean reference book: warm paper surfaces, dark ink text, thin
  colored rules between stat-block sections, small-caps headings. The design is
  original; it doesn't reproduce official book art, textures, ornaments, or
  logos.
- **Typefaces:** the Alegreya superfamily (OFL), self-hosted via `@fontsource`:
  Alegreya SC for headings and stat-block labels, Alegreya for body and rules
  text, Alegreya Sans for controls and badges. Only weights 400, 500, 700, and
  400 italic load. Self-hosting keeps PNG captures faithful.
- **Type scale:** a modular scale (ratio 1.2), `--font-size--1` to
  `--font-size-5`, fluid with `clamp()` on screen and fixed point sizes in
  print.
- **Icons:** a few Lucide icons (ISC) inlined as SVG components in
  `site/src/icons/`, colored with `currentColor`. Entry types have no icons; the
  type badge carries the label.

### Hierarchy and standards

The style guide's standards, which the tokens implement and `/styleguide/`
shows.

- **Text roles.** Each role reads one semantic token:

  | Role | Token | Step |
  |---|---|---|
  | Display (unused by pages today) | `--text-display` | 5 |
  | Page title, `h1` | `--text-h1` | 4 |
  | Page section, `h2` | `--text-h2` | 3 |
  | Subsection, `h3` | `--text-h3` | 2 |
  | Minor heading, `h4` | `--text-h4` | 1 |
  | `h5` and `h6` | `--text-h5`, `--text-h6` | 0 |
  | Body and rules text | `--text-body` | 0 |
  | Labels, counts, badges, notes, the footer | `--text-small` | −1 |

- **Headings.** A page has one `h1`, its title. A page heading's size comes
  from its level, in `base.css`. A component's own headings (a card's name, a
  stat block's name and section headings) take their level from where the
  component nests (`Heading.astro`), so their size comes from a component
  token instead: `--card-title-size`, `--statblock-title-size`,
  `--statblock-heading-size`. The site title and a detail page's summary line
  read `--site-title-size` and `--entry-summary-size`. Headings use
  `--font-heading` (small caps) at the label weight and the tight leading.
- **Stat block sections.** Every section heading inside a stat block carries
  the `statblock-heading` class, which `StatBlock.astro` styles once: the
  stat block heading font, the entry's accent, and `--statblock-heading-size`.
  That covers a creature's Traits and Actions, an item's Spells, a class's,
  subclass's, or species' sections (an `Accordion`'s `headingClass`), and the
  name of a stat block embedded in an item or spell (`StatBlockHeader`'s
  `section`), which reads as a section of the entry that holds it. A section
  nested in one, such as a class feature under Class Features or an embedded
  stat block's Actions, adds `statblock-heading--nested` and reads
  `--statblock-subheading-size`, a step smaller (the `h5` role). The print
  view maps each of these tokens to its print size
  ([Print layout](export.md#print-layout)).
- **Rhythm.** The gap a flow of siblings takes is one of four tokens, aliases
  of the spacing scale:

  | Token | Between |
  |---|---|
  | `--flow-line` | A label and its value, a heading and the list under it |
  | `--flow-text` | Paragraphs and list items of one text |
  | `--flow-block` | Blocks of one section: a stat block and its notes, accordion sections, a rules group's members, the main column's children |
  | `--flow-section` | A page's sections: a detail page's parts, a rules page's sections |

  Inside a component (a card, a stat block, a control), its own gaps read
  the `--space-*` scale or its component tokens.
- **Underlines.** Links in running text (rules text, lore, ref lists, the
  footer) stay underlined, so they never rely on color alone. Links in
  headings (card titles among them), in a `nav` (the site nav, the contents
  list), and in the site header underline only on hover and focus. The link
  to the current page (`aria-current`, the site nav's) keeps a heavier
  underline (`--border-width-strong`) at rest, so it isn't marked by color
  alone. One rule in `base.css` sets this; a component doesn't set a link's
  underline itself. `tests/site/hierarchy.test.ts` checks the heading sizes,
  the stat block section headings in screen and print, the rhythm tokens, and
  the underline rule.

### Shared components

Every interactive pattern has one rule and one component, in
`site/src/components/shared/`, styled by `shared.css` beside them. Pages and
other components build these patterns only through them.
`tests/site/shared-components.test.ts` scans `site/src/` and fails when a file
outside that folder renders its own `<details>`, `<summary>`, `aria-expanded`,
`<button>`, or checkbox, renders a card without `CardLink` (or with an `<a>` of
its own), or restyles the chevron, the disclosure, or the card link.
`/styleguide/` shows each one. A shared component's rules sit in the
`components` layer, so a page's rule for the same element ties with them on
layer, and the order the bundled stylesheets land in isn't fixed. Where a page
sets a property a shared rule also sets, as the Filters toggle sets `display`
to hide on desktop, its selector outranks the shared one on specificity
(`.gallery__menu > .gallery__filters-toggle` over `.disclosure`), and
`tests/site/gallery/filters-toggle.test.ts` checks it.

- **Disclosure** (`Disclosure.tsx`, and `Disclosure.astro` for Astro pages,
  with the same markup). One toggle, with the chevron on its left, pointing
  right when closed and turning down when open. `DisclosureButton` opens a
  panel it names with `aria-controls`; it can show only its chevron
  (`iconOnly`), with its label as its accessible name. `Details` is a
  `<details>` whose `<summary>` is the toggle. The filter tree, the Filters
  menu's toggle, accordion sections, a detail page's link lists, and the
  export report use it.
- **Click targets** (`CardLink.tsx`). The whole card opens its entry: the
  title's link covers the card, and the card's root carries `linked-card`,
  which lifts every other control on the card (the "In cart" checkbox) above
  that link and shows the link's focus ring around the card.
- **Buttons** (`Button.tsx`, and `Button.astro` for Astro pages). A fixed set
  of variants, each with a fixed placement:

  | Variant | For | Placement |
  |---|---|---|
  | Primary | A place's one main action: Print | First in its row |
  | Secondary | Every other action: Download, Clear filters, Empty cart | After the primary, or first when there is none |
  | Icon | An icon alone, named by its `label` for assistive technology | At the end of the row or card it acts on |

  `MenuButton` is a secondary button that opens a small menu below it, as
  Download does ([Controls](export.md#controls)). Choosing an item closes the
  menu, returns focus to the button, and runs it. Escape closes it and
  returns focus too, and it closes when focus leaves it.
- **Controls** (`Controls.tsx`):
  - A **checkbox** (`Checkbox`, the box and its label) is one of a list of
    independent choices, any number of them on: filter types and values, and
    the "In cart" control on cards and detail pages.
  - A **chip** (`Chip`, `aria-pressed`) is one value of a small range, such as
    a spell level, shown as the value alone: a chip facet's filter values
    ([Display](content-model.md#display)).
  - A **toggle** (`Toggle`, `role="switch"`) is one setting of the view, on or
    off by itself, not one of a list.

### Accessibility

Target: WCAG 2.2 AA.

- **Contrast.** Text, muted text, accent, and every type and rarity color
  reach 4.5:1 or more on `--color-bg` and `--color-surface`;
  `--color-control-border` and `--color-focus` reach 3:1 or more. No unit test
  checks the pairs: axe checks rendered contrast on milestone PRs, and the
  milestone review checks the pairs ([Milestone review](workflow.md#milestone-review)).
- **Color is never the only signal.** Rarity, type, and concentration and
  ritual badges always carry a text label.
- **Keyboard.** Every control is reachable and operable by keyboard, in visual
  order. Focus is always visible through a shared `--focus-ring`. Escape closes
  popovers.
- **Semantics.** The gallery's result count is announced in a polite live region.
  The filter tree, in a section labelled "Filters", is a nested list of
  disclosure buttons, each with `aria-expanded` and `aria-controls` naming the
  panel it opens. A type, or a value that holds groups, pairs its checkbox with
  its own button, named "<type> filters" or "Groups in <value>". A facet's
  values are a list labelled by its button, each a labelled checkbox whose
  count reads as "<n> entries"; a range facet's Min and Max inputs are a
  `role="group"` labelled by its button. Art takes alt text from the entry
  name.
- **Motion.** Transitions use duration tokens, which become `0ms` under
  `prefers-reduced-motion: reduce`; `tests/site/motion.test.ts` checks every
  one.
- **Zoom and reflow.** Layouts work at 320 CSS px wide and at 200% zoom without
  horizontal scrolling. Data tables scroll inside their own box.
- **Automated check.** `npm run a11y` runs axe-core through Playwright on the
  built site and fails on any
  serious or critical violation. It serves `site/dist` under the site base and
  checks each ruleset's Library and the About page.
  From `library.json` it adds the first record's ruleset's Library filtered to its type
  and its first facet value, the first detail page of each type that has an
  entry, and the print view of those entries, checked once loaded (with
  `window.print` stubbed). Then it checks every rules page in each ruleset's
  `rules/pages.json`, plus its Extensions page when it has one. It launches
  Playwright's Chromium, and retries with `/opt/pw-browsers/chromium` if that
  fails and the path exists, as in cloud sessions. CI runs it only on the PR that closes a milestone
  ([Milestone PRs](workflow.md#milestone-prs)).
- **Milestone review.** Everything axe can't check is reviewed by a human once
  per milestone against WCAG 2.2 AA ([Milestone review](workflow.md#milestone-review)).

### Refinement workflow

- **Style guide.** `/styleguide/` (unlinked, `noindex`; the source is
  `site/src/styleguide/StyleGuide.astro`, added as a route only in the repo's
  own build, [Library root](site.md#library-root)) renders from the test
  fixtures: every token as a swatch or sample; the type scale and typefaces;
  the heading levels, the link underlines, and the rhythm; the shared
  components in their states;
  every template in each mode, with print previews in the wide and narrow print layouts; gallery
  cards with and without art; filter controls in their states; and the export
  controls with Download's menu closed and open. Edit a
  token, and every affected
  surface updates under `npm run dev`.
- **Stress fixtures:** a creature with legendary actions and spellcasting, a
  long item, a cantrip and a 9th-level spell, and a very long name. Layouts
  are judged against the hard cases.
- **Snapshots on demand.** `npm run snapshots [label]` captures the style guide,
  the home page (the first entry's ruleset's Library), and one detail page per
  type from the built site, full-page at 390, 820, and 1440px wide (an 800px viewport height), into the git-ignored
  `snapshots/<label>/` folder as `<page>-<width>.png`. These are the widths a
  UI PR shows ([UI screenshots](workflow.md#ui-screenshots)). A label is one
  plain folder name; without one it's the current UTC time. It's not a CI
  gate, so deliberate design changes never fight a failing snapshot test.
- **UI changes are dev work**, on `dev/` branches, labeled `ui` automatically.
  Routines never touch `site/`; the lane check rejects it.

## Where the rules live

- `site/src/styles/`: the layers and `tokens/`.
- `stylelint.config.mjs` and `tests/stylelint.test.ts`.
- `site/src/components/shared/` and `tests/site/shared-components.test.ts`.
- `tests/site/motion.test.ts`, `tests/site/palette.test.ts`, and
  `site/src/lib/design-tokens.ts`.
- `scripts/a11y/`, `scripts/snapshots/`, and `scripts/browser/`.

## Extending

| To change | Edit |
|---|---|
| A role's color | `tokens/semantic.css` |
| The palette everywhere | `tokens/primitives.css` |
| A type or rarity color | `tokens/content.css` |
| Fonts or the type scale | `tokens/primitives.css` (families and scale) and `semantic.css` (roles) |
| A heading level's size or the rhythm | `tokens/semantic.css` (`--text-h*`, `--flow-*`) |
| A component heading's size | `tokens/components.css` (`--card-title-size`, `--statblock-*-size`, …) |
| Card size, grid density, gaps | `tokens/components.css` |
| Print density, margins, or the page-width breakpoint | `tokens/print.css` |
| Stat-block structure or order | The template's parts in `site/src/components/templates/` |
| A disclosure, button, card link, or control, everywhere it appears | Its component in `site/src/components/shared/`, or its knobs in `tokens/components.css` (`--disclosure-*`, `--button-*`, `--chip-*`, `--toggle-*`) |
| A quick experiment | `overrides.css`, then move the result into tokens or the component |
