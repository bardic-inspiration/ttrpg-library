# Site

## Purpose

The static gallery on GitHub Pages: the type registry that configures it, the
index the build writes, the gallery, the detail pages, and the templates that
render every entry. Styling and accessibility are in [styling.md](styling.md);
exports in [export.md](export.md).

## Behavior

### Type registry

`config/types.json` holds display and generation defaults per ruleset and type.
Validation reads it only to confirm a ruleset and type are registered, and it
never decides whether a field displays; the schema does
([content-model.md](content-model.md#situational-fields)).

Per ruleset: a `label` and an `attribution` key ([licensing.md](licensing.md)).
Per type:

| Key | Purpose |
|---|---|
| `label`, `plural` | Display names |
| `template` | Card and print component; a missing template falls back to the generic layout |
| `guideline` | The type's guideline file ([generation.md](generation.md#guidelines)) |
| `facets` | The `stats.*` and `derived.*` paths lifted into `library.json` and offered as filters and sorts |
| `cardFields` | Facets shown on gallery cards |
| `defaultSort` | `<path>:<asc|desc>` |
| `defaultFilters` | Filters expanded by default; every other facet and tag stays reachable through "Add filter" |
| `summaryField` | The key stat shown in PR bodies and job summaries (CR, rarity, spell level, feat category); omitted for a rules extension type and a background, which have none |
| `gapBuckets` | How gap fill partitions the type ([generation.md](generation.md#gap-buckets)) |
| `formerly` | The type's earlier keys, whose URLs redirect ([Redirects](#redirects)) |

A facet's `kind` is `range` (numbers) or `enum` (strings, string arrays,
booleans); an omitted optional flag reads as `false`. Ordered enums (rarity,
size) declare `"order": [...]`, so sorting is semantic. `format` is an optional
display formatter:

- `cr` reads fractions ("1/8");
- `spell-level` reads 0 as "Cantrip" and any other level as "Level 3";
- `rarity` reads title case as SRD 5.2 prints it ("Very Rare");
- `title` reads a slug in title case with hyphens as spaces ("Wondrous Item"),
  matching the detail templates;
- `ability` reads an ability key by its full name ("Intelligence").

Without a `format`, a value reads as stored, which keeps tag values and free
text as written.

### Index build

1. `scripts/build-index/` reads every file under `content/`, runs the validator
   (the build fails if validation fails), computes each entry's derived values
   with its ruleset module, resolves refs, and computes back-references. It
   never computes a rules value itself.
2. It writes `site/public/library.json`, the index, and copies each entry's raw
   JSON to `site/public/data/<ruleset>/<type>/<id>.json` for export. Beside each
   copy it writes the entry's export bundle, `<id>.export.json`:
   `{ "entry": …, "derived": … }`, as an exporter receives it
   ([export.md](export.md#exporter-interface)).
3. Astro builds static pages, reading the full entries and derived values at
   build time.

Each `library.json` record holds the entry's `id`, `ruleset`, `type`, `name`,
`summary`, `url` (the detail page under the site base), `image` (the stored
path, or `null`), `facets`, `tags` (or `{}`), `createdAt`, `refs`, `refBy`, and
`search`:

- `facets` holds the registry's facet paths in registry order, read from
  `stats` and the derived values. A facet whose optional value is omitted is
  left out, except an optional flag, which reads as `false`.
- `search` holds action, trait, and spell names plus `description` and rules
  text with markup stripped. Names are every `name` in `stats` and every value
  at a `RefOrText` field, a ref read as its target's name. Rules text is every
  markdown-subset field, with markdown and ruleset tokens removed and each
  `{ref:…}` token read as its target's name.

A component ([content-model.md](content-model.md#components)) has no record,
raw file, or export bundle. Its parent's `search` adds each component's name
and the same names and text, in the order the parent lists them.

Records are sorted by ruleset, type, then `id`, and the file is written without
timestamps, so two builds of the same content are byte-identical. The index
stays lean: full entries and derived values are fetched only for export, from
the export bundles. `library.json` and `data/` are built in CI and git-ignored,
so PRs contain only entry files.

### Fresh data

`library.json`, the raw files, the export bundles, and print fragments live at
fixed URLs, and GitHub Pages lets browsers cache them for several minutes. Every
data fetch goes through `fetchFresh` (`site/src/lib/fetch-fresh.ts`), which
requests with `cache: "no-cache"`: the browser revalidates its copy before using
it, so a deploy shows on the next load, and an unchanged file costs only a
`304`. A test fails if site code calls `fetch` directly.

### Pages and navigation

| Route | Content |
|---|---|
| `/` | All entries, with a type filter, sorted by name |
| `/<ruleset>/` | All entries in the ruleset, with the same type filter and order |
| `/<ruleset>/<type>/` | Gallery for one type, with its default facets and sort |
| `/<ruleset>/<type>/<id>/` | Detail page |
| `/<ruleset>/rules/<page>/` | A rules page ([Rules pages](#rules-pages)) |
| `/<ruleset>/rules/extensions/` | The ruleset's Extensions page |
| `/print/` | Print view for one or many entries ([export.md](export.md#print)) |
| `/about/` | What the library is, SRD attribution, licenses |
| `/styleguide/` | The style guide, not linked in navigation ([styling.md](styling.md#refinement-workflow)) |

The header carries ruleset and type navigation, built from the registry. The
footer carries the SRD 5.2 attribution statement on every page. The site is
served under the base `/ttrpg-library/`
([architecture.md](architecture.md#technology)).

### Rules pages

Each page in a ruleset's `rules/pages.json` builds at
`/<ruleset>/rules/<page>/` ([Rules pages](rulesets.md#rules-pages)), from
`site/src/components/rules/`:

- **Its blocks, in order.** Prose renders as sections with headings a level
  below the page's; a primitives block and a group tree render each
  primitive and group as a section of its own.
- **An anchored section per primitive and group**, with the id
  `<type>-<id>`, so a link lands on it and two types on one page can't
  collide. A primitive's section shows its name and its rules: with its
  type's body part when its registry template has one (a condition's
  effects, or equipment's lines, as on its card), otherwise its rules text as
  paragraphs when that is all it has (a weapon property), its `tag` in
  brackets after its name when it has one (a glossary term, "Attack
  [Action]"), or its `stats` as
  labeled lines (the group it sits in isn't repeated). A group's shows its name, its `note`,
  and its `text`. Each lists its forward refs and back-refs under
  the ruleset's labels, like a detail page's Links. A union group lists its
  members as links.
- **Cross-listed primitives**, from a primitives block's `crossList`: each
  sits among the block's primitives by name as a heading with its type in
  brackets, "Blinded [Condition]", linked to its section on its own page,
  with no anchor here.
- **Its extensions**, at the bottom: the extensions whose primitives would
  sit on this page, by type or by group, in a list with a search box that
  narrows it as you type, each linked to its card.

A ruleset with a rules type that takes extensions also builds an Extensions
page at `/<ruleset>/rules/extensions/`: one searchable list per such type.
Rules pages aren't in the header yet.

A link to a primitive or group, from any entry or rules page, renders as its
name linked to its anchor; refs carry the anchors' paths alongside the names
(`refPaths` in `site/src/lib/library.ts`).

### Redirects

A renamed type keeps its old URLs working (P9). The registry lists its
earlier keys under `formerly`, such as `item`'s `["magic-item"]`, and from
them:

- **The old gallery and detail pages** are built as redirect pages:
  `/<ruleset>/<old>/` and `/<ruleset>/<old>/<id>/` send the reader to the
  same page under the current key, keeping the query and fragment, with a
  `noindex` tag, a canonical link to the new page, and a meta refresh for
  readers without JavaScript.
- **Print and gallery queries** read an old key as the current one: an
  `ids` key such as `magic-item/wand-of-wonder`, and an old value of the
  `type` filter (`f.type=magic-item`).

Entries, refs, and `library.json` use only current keys; the validator
rejects an old type like any unknown one. `site/src/lib/redirects.ts` reads
the registry's former keys for the pages, print, and the gallery.

### Gallery

**Loading.** The gallery is one Preact island (`site/src/components/gallery/`,
logic in `site/src/lib/gallery/`) shared by `/`, `/<ruleset>/`, and
`/<ruleset>/<type>/`. It fetches `library.json` once per page load, revalidated
([Fresh data](#fresh-data)), and filters it in memory. Without JavaScript, the
page shows a plain list of the route's entries by name, linked to their detail
pages.

**Cards.** Each card shows art (only when the entry has it), name, type badge,
`cardFields`, and summary. A boolean card field (concentration, ritual,
attunement) reads as a badge labeled with the facet when `true` and is left out
when `false`. A `rarity`-formatted field reads as a badge carrying
`data-rarity`. Other fields read as label and value. One column on phones, up
to four on wide screens.

**Filters.**

- A type gallery expands the registry's `defaultFilters`. Routes that span
  types (`/`, `/<ruleset>/`) have one default filter instead: `type`, an enum
  over the registered types. A default filter shows when some entry on the
  route has a value for it.
- Active filters and filters the reader added always show, and a non-default
  filter has a button to remove it.
- "Add filter" lists every facet for the current types plus every tag key in the
  current results. The current types are the type filter's values when it's
  set, otherwise every type on the route.
- Range facets show min and max inputs, which accept fractions such as `1/8`.
  Enum facets and tags show multi-select chips with counts. A chip's count is
  the number of results it matches under the search and every other active
  filter. Chips list every value present on the route in declared order (for
  ordered enums) or alphabetically, plus any selected value no entry has.
- Values within a facet combine as OR; facets combine as AND. An entry missing a
  filter's value never matches it.

**Sort.** By name, created date, or any facet, ascending or descending. Every
facet of every type on the route is a sort choice, so CR is offered on `/` as
well as on the creature gallery. Ordered enums sort by declared order, an array
facet (size) by its first item. Ties break by name, then ruleset, type, and id,
so the order never depends on `library.json` order. Entries missing the sort
value go last in either direction. A type gallery starts on the registry's
`defaultSort`; `/` and `/<ruleset>/` start on `name:asc`.

**Search.** MiniSearch over `name` (boost 3), `summary` (2), tag values (1.5),
and `search` (1), with prefix and light fuzzy matching. Search narrows within
active filters; results order by relevance when there's a query, otherwise by
the active sort.

**URL state.** Query, sort, and filters live in the query string, so any view
can be bookmarked or linked:
`?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8&f.tags.theme=fire`.
Ranges use `min..max` (either side may be empty). Keys and values are
URL-encoded, so a comma inside a value is `%2C` and a bare comma separates
values. Enum values are case-folded. The type filter is `f.type`. Unknown
parameters, filters on paths the route doesn't have, unknown sort paths, and
malformed values are ignored. The gallery rewrites the URL as the view changes,
replacing the history entry, in one canonical form: filters in registry order,
then tags by key, with the default sort and ignored parameters left out.

**Selection and set actions.**

- Cards have a checkbox. Selection lives in the page, not the URL. A selected
  entry that the filters hide stays selected and is counted in "N selected".
- Beside the result count there is one button per configured exporter that
  offers set scope, in config order, with a page size selector beside one that
  takes it ([export.md](export.md#exporter-interface)).
- An action targets the selection when anything is selected: the selected
  results in the gallery's order, then selected entries the filters hide, in
  index order. Otherwise it targets the whole filtered set in the gallery's
  order. Each button's accessible name says which ("Print 3 selected",
  "Download JSON 12 entries"), and buttons are disabled when they'd target
  nothing.
- An action first fetches the export bundles of its entries. If any fails to
  load, nothing runs, and a polite status region says so.

**Scale.** The index is loaded once and filtered in memory, sized for a few
thousand entries. Past about 2,000, revisit the index size and prebuilt search
indexes.

### Detail page

- Art (only when the entry has it), name, type, and summary.
- The full stat block or card from the type's template, then a page type's
  components, in its order: each a section with its name as a heading one
  level below the entry's, anchored at `#<type>-<id>`, holding its rules text
  as paragraphs or its other `stats` as the generic lines
  (`PageComponents`). The layout is basic until the UI redesign (#237).
  Print and PNG capture render them the same way.
- `description` as lore, visually distinct from rules text.
- Forward refs and back-refs as links
  ([content-model.md](content-model.md#references)); a page type's include
  its components' ([content-model.md](content-model.md#components)).
- Tags as chips; a chip opens the type gallery filtered by that tag.
- A provenance line: created and updated dates, and source issues linked to
  GitHub.
- Export controls below the summary, one per configured entry-scope exporter. A
  Preact island renders them once hydrated, since every export needs
  JavaScript; a failed export shows a message in a polite status region.
- `<title>` and Open Graph tags (name, summary, and art when present).

### Templates

- One component per type template, `background-card`, `condition-card`,
  `creature-stat-block`, `equipment-card`, `feat-card`, `item-card`, and
  `spell-card`, plus a `generic` fallback that renders the fixed keys,
  `stats` as a definition list, and tags. `EntryTemplate` picks the component
  from the registry's `template`, falling back to `generic`. The generic
  lines render a ref as its target's name, linked to its page or rules
  anchor; a rules page renders a primitive's `stats` with the same lines.
- The same component renders on the detail page, in PNG capture, and in print,
  with a `mode` prop (`screen`, `capture`, `print`) that adjusts only spacing,
  columns, and interactive elements.
- Each template is built from small parts with one job each (`StatBlockHeader`,
  `AbilityTable`, `PropertyLine`, `ActionList`, `ArtFrame`, …), so refining one
  part never means editing a large file. Markup is semantic: the entry name is a
  heading, section labels are subheadings, property lines and ability scores are
  definition lists or tables, and action names are inline headings.
- Each template renders the entry name as a heading at a `level` its page
  chooses (2 by default; the detail page's own `h1` sits above it), with
  sections one level below.
- Templates receive the entry and its derived values and render tokens through
  the ruleset's `tokens.ts`; they never compute rules values.
- Every template shows a `stats` field by the situational-field rule, through
  one helper (`present` and `whenPresent` in `site/src/lib/display.ts`).
- Rules text and `description` render through one sanitizing markdown helper
  (`site/src/lib/markdown.ts`): raw HTML is escaped, and links, images, and
  headings read as plain text. In every `Text` field, tokens render first, then
  markdown, and each `{ref:…}` token renders as its target's name linked to its
  page. Fields that aren't `Text` (action names, save targets, plain-string
  spells) are escaped before they join generated markdown, so a `*` displays as
  typed.
- Every inline heading prints bold italic, as SRD 5.2 prints them: the ones a
  template adds (action and trait names, "Using a Higher-Level Spell Slot.",
  "Cantrip Upgrade.", the items of an embedded stat block) and the ones rules
  text writes itself, written `***Regaining Charges.***`.
- A pipe table renders as a `<table>` with `scope="col"` header cells, inside a
  `.md-table` box that scrolls sideways on its own when the table is wider than
  its column; the page never does. A titled table puts its title in a
  `<caption>` above the headers, in the heading font and bold. The box is
  focusable and labeled "Table: " plus the title, or the column headers when
  there's none. One style in `base.css` serves every template, mode, and theme:
  headers in the heading font over an accent rule, thin rules between rows, no
  striping, and wrapping cell text, except that a one-word cell such as `9–10`
  stays on one line. Its knobs are the `--table-*` tokens; print and capture
  take their size from the surrounding text.
- A spell or item's embedded stat blocks render after its rules text, inside its
  card, with the creature stat block's parts (`EmbeddedStatBlock`): the block's
  name one heading level below the entry's, its type line, the AC, Initiative,
  HP, and Speed lines, the ability table, the remaining lines, then its Traits,
  Actions, Bonus Actions, and Reactions. Lines display as written; the ability
  table's modifiers and saves come from the derived values.
- Template tests render components with Astro's container API.

## Where the rules live

- `config/types.json`: the registry.
- `scripts/build-index/`: the index builder.
- `site/src/pages/`: routes. `site/src/components/`: the gallery, detail,
  print, and template components. `site/src/lib/`: their logic, including
  `gallery/`, `display.ts`, `markdown.ts`, `format.ts`, and `fetch-fresh.ts`.

## Extending

| To add | Touch |
|---|---|
| A filter or sort on a tag | Nothing |
| A filter or sort on a `stats` field | A facet in the registry |
| A template for a type | A component in `site/src/components/templates/`, named in the registry |
| Data storage outside the repo | `scripts/build-index/`; the site keeps reading the same `library.json` shape |
