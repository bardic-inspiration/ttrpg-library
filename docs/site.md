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
| `defaultSort` | `<path>:<asc|desc>`: the sort the Library opens on from the type's old gallery URL and its detail page's type link ([Redirects](#redirects)) |
| `defaultFilters` | Filter tree nodes that start open while the type is checked; every other facet and tag stays in the tree, closed |
| `summaryField` | The key stat shown in PR bodies and job summaries (CR, rarity, spell level, feat category); omitted for a rules extension type and a request-only content type (background, species, class, subclass), which have none |
| `gapBuckets` | How gap fill partitions the type ([generation.md](generation.md#gap-buckets)) |
| `formerly` | The type's earlier keys, whose URLs redirect ([Redirects](#redirects)) |

A facet's `kind` is `range` (numbers) or `enum` (strings, string arrays,
booleans); an omitted optional flag reads as `false`. Ordered enums (rarity,
size) declare `"order": [...]`, so sorting is semantic. A facet's
`vocabulary` names a phrase book vocabulary ([Wording](#wording)), and each
value reads by its display name there, the same name its page shows:
`"vocabulary": "skill"` reads `sleight-of-hand` as "Sleight of Hand", and a
`rarity` facet also shows as a badge on cards. Otherwise `format` is an
optional display formatter:

- `cr` reads fractions ("1/8");
- `spell-level` reads 0 as "Cantrip" and any other level as "Level 3";
- `title` reads a slug with no vocabulary, such as an equipment group's id,
  in title case ("Hand Tools").

Without either, a value reads as stored, which keeps tag values and free text
as written.

Two flags change what a facet's values are:

- **`ref`:** the values are refs ([References](content-model.md#references)).
  The index lifts each as its key (`condition/poisoned`), and the gallery
  reads it by its target's name and sorts by that name, in values and in
  sorted records. A creature's `stats.immunities.conditions`, a spell's
  `stats.classes`, a background's `stats.feat`, and a subclass's
  `stats.class` are ref facets.
- **`groups`:** the values are the type's leaf groups
  ([Rules groups](rulesets.md#rules-groups)), offered nested as the groups
  file nests them. Choosing a group matches every leaf group in it, and a
  union group its parts' leaves, so `f.stats.group=martial-weapons` matches a
  `martial-melee-weapons` entry. Equipment's `stats.group` is one, so its
  category is the tree's top level rather than a facet of its own.

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
| `/` | The Library: every entry in one gallery ([Gallery](#gallery)) |
| `/<ruleset>/`, `/<ruleset>/<type>/` | Redirects to the Library with the matching filter ([Redirects](#redirects)) |
| `/<ruleset>/<type>/<id>/` | Detail page |
| `/rulesets/` | Each ruleset's rules pages and its Extensions page |
| `/<ruleset>/rules/<page>/` | A rules page ([Rules pages](#rules-pages)) |
| `/<ruleset>/rules/extensions/` | The ruleset's Extensions page |
| `/print/` | Print view for one or many entries ([export.md](export.md#print)) |
| `/about/` | What the library is, SRD attribution, licenses |
| `/styleguide/` | The style guide, not linked in navigation ([styling.md](styling.md#refinement-workflow)) |

The top bar reads **Library | Rulesets | About | Contribute**
(`site/src/components/SiteNav.astro`). Contribute links to the repository. The
current page's link is marked `aria-current="page"`, and Rulesets is marked
current on every rules page too. The
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
The Rulesets page (`/rulesets/`) lists each ruleset's rules pages in
`pages.json` order, then its Extensions page when it has one.

A link to a primitive or group, from any entry or rules page, renders as its
name linked to its anchor; refs carry the anchors' paths alongside the names
(`refPaths` in `site/src/lib/library.ts`).

Each rules page is an accordion page ([Accordion pages](#accordion-pages)):
its untitled opening prose, then its table of contents (`pageContents` in
`site/src/lib/rules.ts`), then its sections. Each titled prose section, each
primitive, and the Extensions list is a section; a prose section's own
subsections show inside it. A group stays open, its heading, note, text, and
links over its members' sections and the groups nested in it. A cross-listed
primitive is a line among the sections, not a section. The contents list each
titled prose section, each primitive (not a cross-listed one), each group with
its subgroups nested under it, and Extensions.

### Accordion pages

Rules pages and page types (classes, subclasses, species, and any page type
whose components render after its template) are long pages laid out as
accordion sections with a jump-to table of contents
(`site/src/components/templates/parts/`):

- **A section** (`Accordion`) is a `<details>` that starts collapsed, its
  heading inside the `<summary>`, which toggles it. Its id is its anchor:
  `<type>-<id>` for a primitive, group, or component, and `section-<slug>` for
  any other titled section (`sectionId` in `site/src/lib/accordion.ts`), such
  as "Core Barbarian Traits" at `#section-core-barbarian-traits`.
- **The table of contents** (`TableOfContents`) is a `nav` labeled
  "Contents" after the page's opening, a list of links to the sections in
  page order, with nested sections listed under their heading, in as many
  columns as fit.
- **A link to a section**, or to anything inside one, opens it and every
  section around it, then scrolls to it: on load, on a new hash, and on a
  click on a link to the hash already showing. This includes every link to a
  primitive, group, or component, from any page. Without JavaScript, a
  section still opens from its heading.
- **Printing the page** from the browser opens every section first and closes
  the ones that were closed afterwards.
- **What stays open.** A page's untitled opening prose, a class's Features
  table, a species' lines and opening sentence, and a heading that holds
  sections (a group, a class's Class Features, an option list) with its
  intro.
- **Page types.** A class page's sections are its Core Traits, "Becoming a
  …", each feature, each option, its spell list, and its subclasses; Class
  Features and each option list are open headings over theirs, and nest
  their features or options in the contents. A subclass page's sections are
  its features, and a species page's its traits. Components that render after
  a template are one section each.
- **Print and PNG capture** use the same components with `mode` `print` or
  `capture`: each section renders as a plain section with its heading, and
  there is no table of contents.

### Redirects

Old URLs keep working (P9). A redirect page has a `noindex` tag, a canonical
link to the new page, a meta refresh for readers without JavaScript, and a
script that sends the reader on with their own query added after the target's,
so a parameter they brought wins, and the fragment kept
(`redirectScript` in `site/src/lib/redirects.ts`).

**Old galleries.** The per-ruleset and per-type galleries are gone; their URLs
redirect to the Library with the matching filter set
(`site/src/lib/gallery/library-url.ts`):

- `/<ruleset>/` to `/?f.ruleset=<ruleset>`.
- `/<ruleset>/<type>/` to `/?sort=<defaultSort>&f.ruleset=<ruleset>&f.type=<type>`,
  so the view opens as the type's gallery did: its registry `defaultSort`
  (left out when it is `name:asc`), and its `defaultFilters` open because the
  type is checked. A detail page's type link goes to the same view.

**Renamed types.** The registry lists a type's earlier keys under `formerly`,
such as `item`'s `["magic-item"]`, and from them:

- **The old pages** are built as redirect pages:
  `/<ruleset>/<old>/<id>/` sends the reader to the same page under the
  current key, and `/<ruleset>/<old>/` to the Library filtered to the current
  type.
- **Print and gallery queries** read an old key as the current one: an
  `ids` key such as `magic-item/wand-of-wonder`, and an old value of the
  `type` filter (`f.type=magic-item`).

Entries, refs, and `library.json` use only current keys; the validator
rejects an old type like any unknown one. `site/src/lib/redirects.ts` reads
the registry's former keys for the pages, print, and the gallery.

### Gallery

**Loading.** The Library at `/` is one Preact island
(`site/src/components/gallery/`, logic in `site/src/lib/gallery/`). It fetches
`library.json` once per page load, revalidated ([Fresh data](#fresh-data)), and
filters it in memory. Without JavaScript, the page shows a plain list of every
entry by name, linked to its detail page.

**Layout.** Search sits on top of the filter menu. On desktop, from a viewport
of `64rem`, the menu is a sidebar beside the results and always shows. On
phones and tablets it stacks above the results in a container closed by
default, so results show on the first screen; a Filters button
(`aria-expanded`) opens it. The breakpoint and the columns are tokens in
`tokens/components.css` ([styling.md](styling.md#tokens)). Sort, the result
count, and the set actions head the results.

**Cards.** Each card shows art (only when the entry has it), name, type badge,
`cardFields`, and summary. A boolean card field (concentration, ritual,
attunement) reads as a badge labeled with the facet when `true` and is left out
when `false`. A `rarity`-formatted field reads as a badge carrying
`data-rarity`. Other fields read as label and value. One column on phones, up
to four on wide screens.

**Filters** are a nested accordion checkbox tree built from the registry
(`site/src/lib/gallery/tree.ts`): type, then field, then any subfield, then
value, such as Creature › Immunities › Conditions › Poisoned.

- **Rulesets.** A Ruleset node, each ruleset a checkbox for the ruleset
  filter (`f.ruleset`), comes first when the library holds more than one
  ruleset, or the filter is active.
- **Types.** Then the types, each a checkbox for the type filter (`f.type`)
  with its count, and a disclosure holding its facets. A type shows when the
  library has entries of it, or it's checked.
- **Fields.** A type's facets follow in registry order. Facets whose paths
  share a field below `stats` or `derived` sit in a node named for it by the
  wording layer's `label`: `stats.immunities.damage` and
  `stats.immunities.conditions` sit in Immunities, the six ability scores in
  Abilities. A field only one facet sits in adds no node, so `stats.ac.value`
  reads as AC. A facet shows when some entry of its type has a value for it,
  or it's active.
- **Tags** follow the types as one Tags node, holding every tag key in the
  library and any tag filtered on.
- **Values.** An enum facet or tag lists its values vertically as checkboxes,
  each with its count: the entries of its type it matches under the search and
  every other active filter. Values come in declared order (ordered enums),
  by name (ref facets), or alphabetically, plus any selected value no entry
  has. A groups facet's values nest, each group with its own disclosure. A
  range facet's node holds min and max inputs, which accept fractions such as
  `1/8`.
- **Open nodes.** A checked type's registry `defaultFilters` start open, in
  its node and, for a tag, in Tags. Every node holding an active filter starts
  open, down to the value. The reader opens and closes the rest.
- Values within a facet combine as OR; facets combine as AND. An entry missing a
  filter's value never matches it. A path two types share (`stats.level` on
  spells and feats) is one filter: each type lists its own entries' values, and
  checking one checks it under both.
- The tree's ref names and groups come from the build: the gallery island
  passes the names of every ref a ref facet holds, and each grouped type's
  groups (`site/src/lib/gallery/facet-data.ts`). A category reads by its
  `noun` and a group by its `qualifier`, else by name: Equipment › Group ›
  Weapon › Martial › Martial Melee Weapons.

**Sort.** By name, created date, or any facet, ascending or descending. Every
facet of every type is a sort choice, so CR is offered alongside name.
Ordered enums sort by declared order, an array
facet (size) by its first item. Ties break by name, then ruleset, type, and id,
so the order never depends on `library.json` order. Entries missing the sort
value go last in either direction. The Library starts on `name:asc`.

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
parameters, filters on paths the Library doesn't have, unknown sort paths, and
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
  (`PageComponents`), unless its template places them itself
  (`PLACES_COMPONENTS` in `site/src/lib/template.ts`), as the species page
  prints its traits as titled paragraphs and the class and subclass pages
  print their features and options in their own sections. On screen a page
  type is an accordion page ([Accordion pages](#accordion-pages)); print and
  PNG capture show every section open, the species page's traits as titled
  paragraphs.
- A card entry's page has no sections to collapse. It is reached from the
  Library, and the browser's Back returns to the results, since the Library
  keeps its state in the URL ([Gallery](#gallery)).
- `description` as lore, visually distinct from rules text.
- Forward refs and back-refs as links
  ([content-model.md](content-model.md#references)); a page type's include
  its components' ([content-model.md](content-model.md#components)).
- The type, linked to the Library filtered to it ([Redirects](#redirects)).
- Tags as chips; a chip opens the Library filtered to the entry's ruleset,
  type, and that tag.
- A provenance line: created and updated dates, and source issues linked to
  GitHub.
- Export controls below the summary, one per configured entry-scope exporter. A
  Preact island renders them once hydrated, since every export needs
  JavaScript; a failed export shows a message in a polite status region.
- `<title>` and Open Graph tags (name, summary, and art when present).

### Templates

- One component per type template, `background-card`, `class-page`,
  `condition-card`, `creature-stat-block`, `equipment-card`, `feat-card`,
  `item-card`, `species-page`, `spell-card`, and `subclass-page`, plus a `generic` fallback that renders the fixed keys,
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

### Wording

Every string a reader sees is **stored text**, written in an entry (rules text
and lines kept as printed), or **composed text**, built by a template from
structured fields: a subtitle, a labeled line, an intro sentence, a list of
links. Stored text is rendered, never rewritten. Composed text is built only
through the wording layer, for SRD and custom entries alike, so both read in
one house style ([SRD and custom entries](content-model.md#srd-and-custom-entries)).

- **`lib/wording/`** is ruleset-independent English, shared by the site, the
  exporters, and the build:
  - a **phrase** is composed text as a list of parts: plain text, markdown
    already written (a `Text` field placed in a line), or a link by key with
    optional display text. `toMarkdown` renders it for templates, links as
    `{ref:…}` tokens; `toPlain` reads it for search and exports.
  - **grammar:** one `titleCase` (minor words lowercase but first),
    `capitalize`, `label` (a key as a sentence-case label), `list` ("A, B, and
    C", or "or"), `plural` and `counted` ("y" to "ies", else "s", with the
    phrase book's irregular ones), and `article` ("a" or "an" by first letter,
    with exceptions).
- **`rulesets/<ruleset>/phrases.json`**, the phrase book, holds the ruleset's
  wording as data: each fixed sentence by key with `{slot}` holes
  (`"condition.intro": "While you have the {name} condition, you experience
  the following {effects}."`), the display name of each enum value by
  vocabulary (`ability`, `skill`, `creatureType`, `rarity`, …), and its
  irregular plurals and articles. `sentence` fails when a slot is missing or
  unused, and a vocabulary lookup fails on an unknown value, so the book and
  its callers can't drift. The ruleset module exports it as `phrases`.
- **Composers** (`site/src/lib/<type>.ts`, through `site/src/lib/wording.ts`)
  only compose: they pick fields, fill sentences, and look up names.
  `tests/wording-layer.test.ts` fails when a module in `site/src/lib/` or a
  template or rules component defines its own casing, list, plural, or
  article helper, or holds a fixed sentence (four lowercase words in a row
  in a string). Static page copy, such as the About page, is written, not
  composed, and isn't checked.

## Where the rules live

- `config/types.json`: the registry.
- `lib/wording/` and `rulesets/<ruleset>/phrases.json`: the wording layer.
- `scripts/build-index/`: the index builder.
- `site/src/pages/`: routes. `site/src/components/`: the gallery, detail,
  print, and template components. `site/src/lib/`: their logic, including
  `gallery/`, `display.ts`, `markdown.ts`, `format.ts`, and `fetch-fresh.ts`.

## Extending

| To add | Touch |
|---|---|
| A filter or sort on a tag | Nothing |
| A filter or sort on a `stats` field | A facet in the registry |
| A template for a type | A component in `site/src/components/templates/`, named in the registry, and a composer in `site/src/lib/` |
| Wording for a type | Its sentences and vocabulary in `rulesets/<ruleset>/phrases.json` |
| A filter that reads display names | `vocabulary` on its facet in the registry |
| Data storage outside the repo | `scripts/build-index/`; the site keeps reading the same `library.json` shape |
