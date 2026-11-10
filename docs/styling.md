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
| `tokens/semantic.css` | Meanings mapped to primitives, per theme: `--color-bg`, `--color-text`, `--color-accent`, `--font-heading`, `--space-card`, … | What a role looks like in light or dark |
| `tokens/components.css` | Per-component knobs that default to semantic tokens: `--statblock-rule-color`, `--card-min-width`, `--grid-gap`, `--table-*`, … | One component's look without touching its code |
| `tokens/content.css` | Data-driven accents: one variable per entry type and item rarity | Type and rarity colors |
| `tokens/print.css` | Print and capture sizing per page size | Print density per page size |

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

### Themes

- Light and dark are sets of semantic tokens (and type and rarity colors) under
  `[data-theme="light"]` and `[data-theme="dark"]`, plus a
  `prefers-color-scheme` block for the system default. The attribute sits on
  `<html>`, or on any element to scope a theme to it; tokens built from theme
  colors are re-declared on `[data-theme]` so they re-resolve inside a scoped
  theme. Light is also the plain `:root` default, and the dark blocks apply on
  `screen` only.
- The header has a System / Light / Dark radio group (`site/src/lib/theme.ts`,
  `ThemeToggle.astro`). The choice is stored in `localStorage`, with reads and
  writes wrapped so the toggle falls back to System; choosing System clears it.
  An inline `<head>` script sets `data-theme` before first paint.
- Print and PNG capture always render with the light tokens. Print gets them
  because the dark blocks are screen-only.

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

### Accessibility

Target: WCAG 2.2 AA.

- **Contrast.** `tests/contrast.test.ts` parses `semantic.css` and
  `content.css` for both themes, resolving `var()` through `primitives.css`, and
  checks the declared pairs: text, muted text, accent, and every type and
  rarity color on `--color-bg` and `--color-surface` at 4.5:1 or more;
  `--color-control-border` and `--color-focus` at 3:1 or more.
- **Color is never the only signal.** Rarity, type, and concentration and
  ritual badges always carry a text label.
- **Keyboard.** Every control is reachable and operable by keyboard, in visual
  order. Focus is always visible through a shared `--focus-ring`. Escape closes
  popovers.
- **Semantics.** The gallery's result count is announced in a polite live region.
  Filter groups use `fieldset` and `legend`. Art takes alt text from the entry
  name.
- **Motion.** Transitions use duration tokens, which become `0ms` under
  `prefers-reduced-motion: reduce`; the contrast suite checks every one.
- **Zoom and reflow.** Layouts work at 320 CSS px wide and at 200% zoom without
  horizontal scrolling. Data tables scroll inside their own box.
- **Automated check.** `npm run a11y` runs axe-core through Playwright on the
  built site, in both themes (from the browser's color scheme), and fails on any
  serious or critical violation. It serves `site/dist` under the site base and
  picks its pages from `library.json`: the home page, the first record's type
  gallery filtered by its first facet value, the first detail page of each type
  that has an entry, the print view of those entries, checked once loaded
  (with `window.print` stubbed), and every rules page in each ruleset's
  `rules/pages.json`, plus its Extensions page when it has one. It launches Playwright's Chromium, and retries
  with `/opt/pw-browsers/chromium` if that fails and the path exists, as in
  cloud sessions. CI runs it only on the PR that closes a milestone
  ([Milestone PRs](workflow.md#milestone-prs)).

### Refinement workflow

- **Style guide.** `/styleguide/` (unlinked, `noindex`) renders from the test
  fixtures: every token as a swatch or sample; the type scale and typefaces;
  every template in each mode, with print previews at each page size; gallery
  cards with and without art; and filter controls in their states. It has a
  light/dark switch and a side-by-side view. Edit a token, and every affected
  surface updates under `npm run dev`.
- **Stress fixtures:** a creature with legendary actions and spellcasting, a
  long item, a cantrip and a 9th-level spell, a very long name, and an
  entry with many tags. Layouts are judged against the hard cases.
- **Snapshots on demand.** `npm run snapshots [label]` captures the style guide,
  the home page, and one detail page per type from the built site, in both
  themes, at 1280 × 800 full-page, into the git-ignored `snapshots/<label>/`
  folder as `<page>-<theme>.png`. A label is one plain folder name; without one
  it's the current UTC time. It's not a CI gate, so deliberate design changes
  never fight a failing snapshot test.
- **UI changes are dev work**, on `dev/` branches, labeled `ui` automatically.
  Routines never touch `site/`; the lane check rejects it.

## Where the rules live

- `site/src/styles/`: the layers and `tokens/`.
- `stylelint.config.mjs` and `tests/stylelint.test.ts`.
- `tests/contrast.test.ts` and `site/src/lib/design-tokens.ts`.
- `scripts/a11y/`, `scripts/snapshots/`, and `scripts/browser/`.

## Extending

| To change | Edit |
|---|---|
| A color in one theme | `tokens/semantic.css` |
| The palette everywhere | `tokens/primitives.css` |
| A type or rarity color | `tokens/content.css` |
| Fonts or the type scale | `tokens/primitives.css` (families and scale) and `semantic.css` (roles) |
| Card size, grid density, gaps | `tokens/components.css` |
| Print density per page size | `tokens/print.css` |
| Page sizes and margins | `config/export.json` |
| Stat-block structure or order | The template's parts in `site/src/components/templates/` |
| A theme | One token block in `semantic.css` and an option in the toggle |
| A quick experiment | `overrides.css`, then move the result into tokens or the component |
