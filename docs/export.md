# Export

## Purpose

Getting entries out of the library: JSON as the native data, PNG for Discord
and VTTs, print-ready pages for PDF, and format translators that move entries
to and from other platforms' formats, starting with Open5e. Exporters are
pluggable, so a translator is added without gallery changes.

There is no dynamic API. The data lane is file downloads; the static per-entry
files (`data/<ruleset>/<type>/<id>.json`) and `library.json` stay published at
stable URLs, an informal read-only feed for anything that fetches by URL.

## Behavior

### Exporter interface

Each exporter is a module in `site/src/exporters/` and is listed in
`config/export.json`:

```ts
interface Exporter {
  id: string;                         // "json", "png", "print"
  kind: "print" | "download";         // the Print button, or a format in Download's menu
  label: string;                      // "Print", or the format's name: "PNG", "JSON"
  scopes: Array<"entry" | "set">;     // single entry, filtered or selected set, or both
  types?: string[];                   // the entry types it offers on an entry's page; all when absent
  run(items: Array<{ entry: Entry; derived: Derived; names?: Names }>, options: ExportOptions): Promise<ExportReport | void>;
}

interface ExportReport {
  downloaded: boolean;                // false when nothing in the scope exported
  skipped: Skip[];                    // what the format left out (Translators)
}
```

- `ExportOptions` carries the scope and the site base URL (ending in `/`), plus
  optional injected
  browser IO (fetch, download, clock, capture, open a page), so exporters are
  testable without a DOM.
- The registry (`site/src/exporters/index.ts`) maps the ids in
  `config/export.json` to modules, in config order; an id without a module is a
  build error.
- The detail page and the gallery build their [controls](#controls) from the
  exporters that offer the scope they need (`configuredControls` in the
  registry); the detail page also passes its entry's type, so an exporter with
  `types` appears only on those entries' pages. The detail page has its entry,
  derived values, and the names of the entries and rules it links to at build
  time; a gallery set action fetches them from each entry's export bundle
  ([site.md](site.md#index-build)). Every exporter receives real items in either
  scope.
- A failed export does nothing and says so in a polite status region. An
  exporter that resolves with a report gets a status line saying how many
  things didn't carry over, or that nothing in the scope exports, and the
  report below it ([Controls](#controls)).

### Controls

Every place that exports shows at most two buttons, **Print** and
**Download** (`components/export/ExportButtons.tsx`). Each acts on its place's
scope: the entry, or the Library's selection, or its filtered results when
nothing is selected.

- **Print** runs the `print` exporter.
- **Download** opens a small menu of the `download` exporters that offer the
  scope, in config order. Choosing a format closes the menu and downloads the
  file. The menu is a disclosure: the button carries `aria-expanded`, Escape
  closes the menu and returns focus to Download, and it closes when focus
  leaves it. With no format for the scope, there is no Download button.

| Where | Print | Download |
|---|---|---|
| A card entry's detail page | The print view | PNG, JSON, and Open5e for the types it covers |
| The Library, for the selection or the filtered results | The print view | JSON, Open5e |
| A page type's page (class, subclass, species) | The print view | None |
| A rules page | The browser's print of the page | None |

- **A page type** is a type that lists components
  ([content-model.md](content-model.md#components); `isPageType` in
  `site/src/lib/library.ts`). Its detail page has no Download, so it carries no
  PNG capture source. The print view renders it in `print` mode, with every
  section open.
- **A rules page** isn't an entry, so it has no print fragment. Its Print button
  (`components/export/PagePrint.astro`, a small script with no Preact) opens the
  browser's print dialog for the page, and the accordion opens every section
  before it prints ([Accordion pages](site.md#accordion-pages)).
- **The export report.** After a download that left something out, the status
  line says "Downloaded Open5e. 12 things didn't carry over." and a closed
  disclosure, "What didn't carry over" (`components/export/ExportReport.tsx`),
  lists each skip under its entry's name: the field's path, then the reason.
  When nothing in the scope exports, nothing downloads, and the status says
  "Nothing here exports as Open5e." with the same list.
- Every control needs JavaScript: the detail page's and the Library's render
  once their island hydrates, and a rules page's stays hidden until its script
  runs. None of them print.

Format translators are further exporters that map an entry and its derived
values to the target format ([Translators](#translators)). Most targets store
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
  gallery's order. The page is given the build's facet data, as the Library's
  island is (`libraryFacetData` in `site/src/lib/gallery/facet-data.ts`), so
  a group filter matches every group in it and a ref facet sorts by its
  targets' names ([site.md](site.md#gallery)).
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

### Translators

A translator is one module for one target format, in
`site/src/translators/<target>/`, with two sides (`Translator` in
`site/src/translators/types.ts`):

- **Export** maps entries, their derived values, and the names of what they
  link to into one file in the target format. It's offered as a `download`
  exporter in `site/src/exporters/`, for card entries and sets, and only on
  the entry types it covers. The exporter loads the translator only when a
  download runs.
- **Import** maps a file in the target format to library entries, inputs
  only, without `summary` or `meta`: the import script writes those, and a
  routine opens the content PR ([Imports](generation.md#imports)). Names in structured fields resolve against the target
  ruleset's entries and rules (`ImportContext`).

**What doesn't translate** is skipped and reported, never guessed. Each side
returns a list of skips, each `{ entry, path, reason }`: the entry
(`<type>/<id>`, or on import the record's name), where in it (empty for the
whole entry), and why.

- Export lists everything the file leaves out or changes: a field the target
  has no place for, a link that became plain text, an entry type it doesn't
  cover, and anything that won't read back the same. The site shows the list
  after the download ([Controls](#controls)).
- Import lists everything it skipped: a record it can't read, a name that
  matches no entry, and a number that disagrees with what the ruleset derives
  from the imported inputs. The ruleset wins: import writes no `adjust`.

**Tests, in CI** (`tests/translators/`):

- **Round trip.** For every library entry a translator covers, export then
  import returns the same name, text fields, and `stats`, except where the
  export reported a skip: every difference must sit at, inside, or around a
  reported path.
- **Target schema.** Every exported record validates against the target's
  published schema, vendored beside the translator.
- **Field names.** Every field the export writes appears in a record taken
  from the target by hand (`tests/fixtures/<target>/`), or is named by its
  schema.
- Loading exported files into each target by hand is a Testing backlog issue.

### Open5e

The first translator (`site/src/translators/open5e/`) maps `dnd-5e-2024`
entries to and from records of the [Open5e API](https://api.open5e.com/v2/).

- **Types:** creature to `Creature`, spell to `Spell`, item to `MagicItem`,
  condition to `Condition`, and equipment to `Item`, with its weapon and
  armor summaries. Page types, rules pages, and every other type aren't
  covered: Download doesn't offer them, and a set export skips and lists them.
- **The file** is one object of record lists keyed by Open5e endpoint:
  `{ "creatures": […], "spells": […], "magicitems": […], "conditions": […],
  "items": […] }`, with only the lists that have records. Entry scope
  downloads `<id>.open5e.json`, set scope `library-<YYYYMMDD>.open5e.json`.
  Import also takes a single record, a list of records, or a page of API
  results (`{ "results": […] }`), telling a lone record's type by its fields.
- **The document.** Every record names the library as its Open5e document,
  `ttrpg-library`, and is keyed `ttrpg-library_<id>`, as Open5e keys a
  document's records.
- **Links, on export:** a `{ref:…}` token in text becomes its display text
  or its target's name, and each is reported. A structured ref becomes the
  name in Open5e's field for it: a spell's classes, a creature's condition
  immunities, the spells in a creature's Spellcasting, a weapon's
  properties and mastery. A ref with no Open5e field (gear, an item's spells
  and base item) is reported.
- **Links, on import:** a name in a structured field becomes a ref when it
  exactly matches the name of one entry or rule of that type in the ruleset.
  Names in prose stay plain text. Each unresolved name is listed; a
  Spellcasting spell keeps its name as text.
- **Derived values, on export:** export reads `derived` for AC, hit points
  and the hit dice formula, save and skill bonuses, initiative, passive
  Perception, proficiency bonus, CR and XP, and each attack's bonus and
  damage. Traits and actions are their SRD 5.2 stat block text, as the site
  composes it (`actionBlock`, `spellcastingBlock`), with tokens rendered as
  numbers; attacks also fill Open5e's structured `attacks`.
- **Derived values, on import:** import writes inputs only. A hit dice
  string becomes `hitDice`; a save, skill, or initiative bonus becomes a
  proficiency or expertise, worked out from the ability modifier and PB. An
  action's text becomes a structured attack or save when it parses and,
  rendered again, reproduces its source; otherwise it stays as text and is
  listed. An attack's ability is the one whose modifier and PB give its
  bonus, and a save's the one that gives its DC; when several do, Strength
  for a melee attack, Dexterity for a ranged one, Constitution for a save,
  then table order. In a creature's prose, a damage roll whose average
  matches becomes `{dmg:…}`, and a DC becomes `{dc:<ability>}`, except an
  escape DC or an ability check's, which stay `{dc=<n>}`
  ([Text tokens](rulesets.md#text-tokens)).
- **Not carried:** `summary`, `description`, `tags`, and `image`; a
  creature's extra sizes, swarm, descriptors, gear, lair, speed and senses
  notes, condition immunity notes, and legendary action uses and intro (so
  its legendary actions don't import); an item whose rarity varies (not
  exported), its base item, charges, spells, and curse; embedded stat blocks;
  and any `adjust`. Each is reported where it occurs.
- **Defaults Open5e requires:** an item without a size exports Open5e's
  default, Tiny, and a magic item a weight of `0.000`, as Open5e gives its
  SRD items.
- **Schema** (`open5e.schema.json`, `schema.ts`): Open5e's OpenAPI component
  schemas for these records, copied from `https://api.open5e.com/schema/`.
  Where the live API and the schema disagree, the export follows the live
  API, and the check applies a listed correction (`CORRECTIONS`), each backed
  by a fixture in `tests/fixtures/open5e/`: nulls for related records a
  record lacks, integer speeds listing only the creature's, a skill list of
  only proficient skills, an action's cross-references as an object, and
  readOnly fields the live records leave out (`is_magic_item`, a weapon's
  `is_melee`, a condition's `crossreferences`), which the export still writes.

### Export config

`config/export.json` holds the PNG settings (`scale`, `width`, and `wideWidth`), and `exporters`,
the exporter ids: Print, PNG, JSON, and Open5e. Their order is the order of Download's formats. An id joins the list in the PR that adds its
module.

## Where the rules live

- `config/export.json`.
- `site/src/exporters/`: the interface (`types.ts`), registry, IO, and one
  module per exporter.
- `site/src/translators/`: the translator interface (`types.ts`) and one
  folder per target; `site/src/components/export/ExportReport.tsx`.
- `site/src/lib/capture.ts`, `print.ts`, `print-run.ts`;
  `site/src/components/export/` (Print and Download),
  `site/src/components/detail/`, and `site/src/components/print/`.

## Extending

| To add | Touch |
|---|---|
| A print density, margin, or breakpoint | `tokens/print.css` ([Print layout](#print-layout)) |
| An export format | One `download` exporter module, listed in `config/export.json`; it joins Download's menu wherever it offers the scope |
| A translator | A folder in `site/src/translators/` with its export and import sides, its schema, and fixtures from the target in `tests/fixtures/<target>/`; an exporter that wraps it, with `types`; its round-trip, schema, and field-name tests ([Translators](#translators)) |
