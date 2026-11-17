# Export

## Purpose

Getting entries out of the library: JSON as the native data, PNG for Discord
and VTTs, and print-ready pages for PDF. Exporters are pluggable, so format
translators can be added without gallery changes.

## Behavior

### Exporter interface

Each exporter is a module in `site/src/exporters/` and is listed in
`config/export.json`:

```ts
interface Exporter {
  id: string;                         // "json", "png", "print"
  label: string;                      // button text
  scopes: Array<"entry" | "set">;     // single entry, filtered or selected set, or both
  run(items: Array<{ entry: Entry; derived: Derived }>, options: ExportOptions): Promise<void>;
}
```

- `ExportOptions` carries the scope and the site base URL (ending in `/`), plus
  optional injected
  browser IO (fetch, download, clock, capture, open a page), so exporters are
  testable without a DOM.
- The registry (`site/src/exporters/index.ts`) maps the ids in
  `config/export.json` to modules, in config order; an id without a module is a
  build error.
- The detail page and the gallery build their controls from the exporters that
  offer the scope they need. The detail page has its entry and derived values at
  build time; a gallery set action fetches them from each entry's export bundle
  ([site.md](site.md#index-build)). Every exporter receives real items in either
  scope.
- A failed export does nothing and says so in a polite status region.

Format translators (Foundry VTT, Open5e, and others) are further exporters that
map an entry and its derived values to the target format. Most targets store
computed numbers, so translators read `derived` rather than recomputing.

### JSON

- Entry scope downloads the entry's raw file as `<id>.json`: inputs only, no
  derived values.
- Set scope fetches each entry's raw file and downloads one array as
  `library-<YYYYMMDD>.json`, dated by the reader's clock. If any file fails to
  fetch, nothing downloads.
- Raw files come from `data/<ruleset>/<type>/<id>.json` under the site base.

### PNG

- Renders the type template in `capture` mode at a fixed CSS width, off-screen,
  and captures it with `html-to-image` at the configured scale. Entry scope
  only. The file is `<id>.png`; if capture fails, nothing downloads.
- The detail page builds the capture source: a `<template
  data-capture="<id>">` (`components/detail/CaptureSource.astro`) holding the
  art when present, the template in `capture` mode, and the short SRD
  attribution as a footer. As a `<template>`,
  it is inert and outside the accessibility tree. At export,
  `site/src/lib/capture.ts` clones it into an off-screen host, waits for fonts
  and art, captures it, and removes the host; `html-to-image` loads only then.
- A creature with legendary actions or more than six actions captures at the
  wide width, with the stat block in two columns and no section split across
  them.
- Fonts are self-hosted and embedded, so the capture matches the screen.

### Print

- `/print/?ids=spell/a,creature/b` or `/print/?<gallery query>` renders
  entries in `print` mode. It takes no page size; the reader picks the paper in
  the print dialog ([Print layout](#print-layout)). `ids`
  lists `<type>/<id>` keys and prints them in the given order, ignoring repeats.
  Without `ids`, the query is read as the Library's, with the gallery's own
  parsing and filtering, so `f.type` narrows by type, and results print in the
  gallery's order.
- **Print fragments.** The build emits each entry's print fragment at
  `print/<ruleset>/<type>/<id>/`: the template in `print` mode
  (`components/print/PrintEntry.astro`) as bare markup. The print view
  (`components/print/PrintView.tsx`, logic in `site/src/lib/print.ts` and
  `print-run.ts`) resolves its entries against `library.json`, fetches only
  their fragments, and inserts them. Page weight follows the selection, not the
  library. If an id names no entry, a fragment fails to load, or nothing
  matches, the page shows a message and the print dialog doesn't open.
- The print view injects the `@page` footer rule at runtime. It sets no page
  size, so the paper chosen in the dialog holds. Its Print button opens the
  dialog again.
- Entries stack, one after another, packed onto as few pages as they fill.
  Long stat blocks flow onto following pages with `break-inside: avoid` on
  actions and traits, so no action is split.
- Each page's footer, in the `@page` bottom margin, carries the short SRD
  attribution only; it names no entry. The site footer, with the full
  statement, prints after the last entry. The header and the print controls
  don't print, and print has no art.
- The reader saves as PDF from the browser's print dialog, which opens once the
  entries are in and fonts load.
- The print exporter (entry and set scope) opens the print view in a new tab
  with `?ids=…`, or in the same tab if the browser blocks it.

### Print layout

The layout follows the printed page's width, which the reader sets by picking
the paper in the print dialog. `tokens/print.css` holds both layouts and the
one breakpoint between them, `@media print and (width < 6.5in)`:

| Layout | Pages | Stat block | Body type | Margin |
|---|---|---|---|---|
| Wide | 6.5in and wider: US Letter, A4 | Two columns | 9.5pt | 0.5in |
| Narrow | Under 6.5in: US Half-Letter, a 4 × 6 in card | One column | 8pt | 0.3in |

- The breakpoint sits between the widest narrow page (Half-Letter, 5.5in) and
  the narrowest wide page's printable width (A4 inside its margins, about
  7.3in), so a page lands on the same side whether a browser measures the page
  or the area inside its margins. Chromium measures the page.
- The `@page` margins are in `tokens/print.css` beside the breakpoint, since a
  narrow card wants a narrower margin. A media query can't read a custom
  property, so the breakpoint is written once, as that `@media` rule.
- On screen the print view shows the wide layout. The style guide previews
  each layout by setting `data-print-layout` on a preview.

### Export config

`config/export.json` holds the PNG settings (`scale`, `width`, and `wideWidth`), and `exporters`,
the exporter ids in button order. An id joins the list in the PR that adds its
module.

## Where the rules live

- `config/export.json`.
- `site/src/exporters/`: the interface (`types.ts`), registry, IO, and one
  module per exporter.
- `site/src/lib/capture.ts`, `print.ts`, `print-run.ts`;
  `site/src/components/detail/` and `site/src/components/print/`.

## Extending

| To add | Touch |
|---|---|
| A print density, margin, or breakpoint | `tokens/print.css` ([Print layout](#print-layout)) |
| An export format or translator | One exporter module, listed in `config/export.json` |
