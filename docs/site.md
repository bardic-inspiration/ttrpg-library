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

Per ruleset: a `label`, its display name in its Library's heading and title,
on the Rulesets page, and in the redirects from its old pages. Per type:

| Key | Purpose |
|---|---|
| `label`, `plural` | Display names |
| `template` | Card and print component; a missing template falls back to the generic layout |
| `guideline` | The type's guideline file ([generation.md](generation.md#guidelines)) |
| `facets` | The `stats.*` and `derived.*` paths lifted into `library.json` and offered as filters and sorts |
| `cardFields` | Facets shown on gallery cards; whether one reads as a chip is its schema's ([Display](content-model.md#display)) |
| `defaultSort` | `<path>:<asc|desc>`: the sort the Library opens on from the type's old gallery URL and its detail page's type link ([Redirects](#redirects)) |
| `defaultFilters` | Filter tree nodes that start open when the Library opens with the type checked; every other facet stays in the tree, closed |
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
- `spell-level` reads 0 as "Cantrip" and any other level as its number;
- `title` reads a slug with no vocabulary, such as an equipment group's id,
  in title case ("Hand Tools").

Without either, a value reads as stored, which keeps free text as written. A
format reads the value alone, never the field's label: where a value needs
naming, the display adds the label once ("Level: 3", "CR: 1/8").

Two flags change what a facet's values are:

- **`ref`:** the values are refs ([References](content-model.md#references)).
  The index lifts each as its key (`condition/poisoned`), and the gallery
  reads it by its target's name and sorts by that name, in values and in
  sorted records. A creature's `stats.immunities.conditions`, a spell's
  `stats.classes`, a background's `stats.feat`, a subclass's
  `stats.class`, and equipment's `stats.weapon.properties` and
  `stats.weapon.mastery` are ref facets.
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
   JSON to `site/public/data/<ruleset>/<type>/<id>.json` for export (another
   library's own folder for another library; [Library root](#library-root)). Beside each
   copy it writes the entry's export bundle, `<id>.export.json`:
   `{ "entry": …, "derived": …, "names": … }`, as an exporter receives it
   ([export.md](export.md#exporter-interface)). `names` holds the name of each
   entry and rule the entry links to, by `<type>/<id>`.
3. Astro builds static pages, reading the full entries and derived values at
   build time.

Each `library.json` record holds the entry's `id`, `ruleset`, `source` (or
`null`), `author`, `type`, `name`, `summary`, `url` (the detail page under the site base), `image` (the stored
path, or `null`), `facets`, `createdAt`, `refs`, and `refBy`. `facets` holds
the registry's facet paths in registry order, read from `stats` and the
derived values. A facet whose optional value is omitted is left out, except
an optional flag, which reads as `false`.

A component ([content-model.md](content-model.md#components)) has no record,
raw file, or export bundle.

A primitive of a rules type that takes extensions and is in the registry, such
as an SRD condition or piece of equipment, has a record too, so it gets a
gallery card beside its type's custom entries (`cardedPrimitives` in
`lib/rules.ts`). Its record reads as the ruleset's own: `source` `null`,
`author` `"publisher"`, `summary` empty, `url` its section on its rules page,
`image` `null`, and `createdAt` `null`, since a primitive has no `meta`. Its
facets read its `stats` and its derived values as an extension's do, and its
`refs` and `refBy` are its links. Its raw copy is its rules file, and its
export bundle's `entry` is the primitive with its ruleset: `ruleset`, `type`,
`id`, `name`, and `stats`.

Records are sorted by ruleset, type, then `id`, and the file is written without
timestamps, so two builds of the same content are byte-identical. The index
stays lean: full entries and derived values are fetched only for export, from
the export bundles. `library.json` and `data/` are built in CI and git-ignored,
so PRs contain only entry files.

### Library root

The site and `build:index` read one library: a folder holding `content/`,
`rulesets/`, and `config/types.json`. It's the repo itself unless
`LIBRARY_ROOT` names another folder, relative to the repo root.
`lib/library-root.ts` resolves it, and `site/astro.config.mjs` maps the
`@library` import alias to it, which every glob of entries, ruleset modules,
rules files, and phrase books, and every registry import, goes through. Site
code that's specific to `dnd-5e-2024` imports that ruleset directly.

Each library has its own folders, so another build never overwrites the
library's:

| Library | Index and data | Built site |
|---|---|---|
| The repo | `site/public/` | `site/dist/` |
| Any other, by its folder's name | `site/public-<name>/` | `site/dist-<name>/` |

The fixture rulesets ([Fixture rulesets](rulesets.md#fixture-rulesets)) are
the other library. `npm run build:originals` builds their site into
`site/dist-originals/`, and `npm run dev:originals` indexes them and serves
it. Both set `LIBRARY_ROOT` through `scripts/with-library/`, so they work in
any shell. That site has the same pages as the library's, without the style guide,
which renders the repo's example fixtures
([styling.md](styling.md#refinement-workflow)). It's never deployed: the
`originals` CI job uploads it as an artifact for 7 days
([CI checks](workflow.md#ci-checks)).

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
| `/` | Redirects to the home ruleset's Library ([Redirects](#redirects)) |
| `/<ruleset>/` | The ruleset's Library: its entries in one gallery ([Gallery](#gallery)) |
| `/<ruleset>/<type>/` | Redirects to the ruleset's Library with the type checked ([Redirects](#redirects)) |
| `/<ruleset>/<type>/<id>/` | Detail page |
| `/rulesets/` | Each ruleset, linked to its Library, with its rules pages and its Extensions page |
| `/<ruleset>/rules/<page>/` | A rules page ([Rules pages](#rules-pages)) |
| `/<ruleset>/rules/extensions/` | The ruleset's Extensions page |
| `/print/` | Print view for one or many entries ([export.md](export.md#print)) |
| `/about/` | What the library is, SRD attribution, licenses |
| `/styleguide/` | The style guide, not linked in navigation ([styling.md](styling.md#refinement-workflow)); only the repo's library has it ([Library root](#library-root)) |

The top bar reads **Library | Rulesets | About | Contribute**
(`site/src/components/SiteNav.astro`), then the print cart's count ("Cart: 3";
[Gallery](#gallery) "Cart and set actions"), shown once its script runs.
Search and the set export follow it in the header ([Page header](#page-header)).
Library, and the site name before the top bar, open the home ruleset's Library,
the registry's first ruleset (`homeRuleset` in
`site/src/lib/gallery/library-url.ts`): `dnd-5e-2024`'s, the library's only
one. Contribute links to the repository. The current page's link is marked
`aria-current="page"`; Library is marked current (`aria-current="true"`) on
every other ruleset's Library, and Rulesets on every rules page. The
footer carries the SRD 5.2 attribution statement on every page. The site is
served under the base `/ttrpg-library/`
([architecture.md](architecture.md#technology)); a preview build's pages
also carry a preview notice above the header ([Deploy](workflow.md#deploy)).

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
  the ruleset's labels, like a detail page's Links, with its links to
  homebrew (an extension or a custom entry) after them under a "Homebrew"
  label, as an SRD page's [Homebrew links](#detail-page). A union group
  lists its members as links.
- **Cross-listed primitives**, from a primitives block's `crossList`: each
  sits among the block's primitives by name as a heading with its type in
  brackets, "Blinded [Condition]", linked to its section on its own page,
  with no anchor here.
- **Its extensions**, at the bottom: the extensions whose primitives would
  sit on this page, by type or by group, in a list with a search box that
  narrows it as you type, each linked to its card.
- **A Print button** after its title, which prints the page with every
  section open, and no Download ([Controls](export.md#controls)). The
  Extensions page has none.

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

- **A section** (`Accordion`) is the shared disclosure
  ([Shared components](styling.md#shared-components)), a `<details>` that
  starts collapsed, its heading inside the `<summary>`, which toggles it. Its id is its anchor:
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

**The home URL.** `/` is a redirect page to the home ruleset's Library
([Pages and navigation](#pages-and-navigation)). Its script (`homeScript` in
`site/src/lib/gallery/library-url.ts`) reads an old Library link's
`f.ruleset`: when its first value is a registered ruleset, the reader goes to
that ruleset's Library instead. The query and fragment come along, so
`/?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/spell` opens
`/dnd-5e-2024/?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/spell`, showing the
whole ruleset, homebrew included, as it did.

**Old type galleries.** The per-type galleries are gone;
`/<ruleset>/<type>/` redirects to
`/<ruleset>/?sort=<defaultSort>&f.ruleset=<ruleset>&f.type=<ruleset>/<type>`
(`typeLibrary` in `site/src/lib/gallery/library-url.ts`), so the view opens as
the type's gallery did: the whole ruleset, its registry `defaultSort` (left out
when it is `name:asc`), and its `defaultFilters` open because the page opens
with the type checked. A detail page's type link goes to the same view.

**Renamed types.** The registry lists a type's earlier keys under `formerly`,
such as `item`'s `["magic-item"]`, and from them:

- **The old pages** are built as redirect pages:
  `/<ruleset>/<old>/<id>/` sends the reader to the same page under the
  current key, and `/<ruleset>/<old>/` to the ruleset's Library filtered to the
  current type.
- **Print and gallery queries** read an old key as the current one: an
  `ids` key such as `magic-item/wand-of-wonder`, and an old value of the
  `type` filter, bare or with its ruleset (`f.type=magic-item`,
  `f.type=dnd-5e-2024/magic-item`).

Entries, refs, and `library.json` use only current keys; the validator
rejects an old type like any unknown one. `site/src/lib/redirects.ts` reads
the registry's former keys for the pages, print, and the gallery.

### Page header

Every page's header holds the top bar ([Pages and navigation](#pages-and-navigation)),
then search and the set export (`site/src/components/header/HeaderActions.tsx`,
one Preact island in `layouts/Base.astro`). On narrow screens they wrap below
the top bar.

- **Search** is a form, labeled "Search", whose field (placeholder "Name")
  opens a ruleset's Library with the query, `/<ruleset>/?q=<query>`, so it
  works without JavaScript: on a ruleset's Library, or one of its entries' or
  rules pages, that ruleset's; on every other page, the home ruleset's
  (`pageRuleset` in `site/src/lib/gallery/library-url.ts`). The query reads as
  the Library's search ([Gallery](#gallery) "Search") under the default
  filters. On a Library it searches the gallery as the reader types instead,
  keeping the other filters and the sort, and shows the query the Library's
  URL holds.
- **The set export** is Print and Download ([Controls](export.md#controls)).
  On a Library, they act on the cart when it holds anything, and on the
  filtered results otherwise ([Gallery](#gallery) "Cart and set actions"). On
  every other page, they act on the cart: Print and Download first load
  `library.json`, so the cart's entries drop out when the library no longer
  has them, and are disabled while the cart is empty. Each button's accessible
  name says what it targets ("Print 3 in cart", "Download 12 entries"). They
  need JavaScript, so they render once the island hydrates. A detail page's
  and a rules page's own export controls stay on the page.
- The gallery and the header talk through window events
  (`site/src/lib/library-view.ts`): the gallery publishes its query, records,
  and results as they change, and the header asks it to search.

### Gallery

**One Library per ruleset.** Each ruleset's Library, at `/<ruleset>/`, is one
Preact island (`site/src/components/gallery/`, logic in
`site/src/lib/gallery/`) over that ruleset's entries alone, so types and
content never mix between rulesets: its filters, sorts, and types are the
ruleset's part of the registry (`rulesetRegistry` in
`site/src/lib/gallery/library-url.ts`). The ruleset stays part of the view's
filter state (`f.ruleset`, see "Filters"), set by the page and old links
rather than in the menu. The cart is one across rulesets
([Cart and set actions](#gallery)).

**Loading.** The island fetches `library.json` once per page load, revalidated
([Fresh data](#fresh-data)), and filters it in memory; the cart reads every
ruleset's records from it. Without JavaScript, the page shows a plain list of
each of the ruleset's entries by name, linked to its detail page.

**Layout.** Search and the set export sit in the page header
([Page header](#page-header)). On desktop, from a viewport
of `64rem`, the menu is a sidebar beside the results and always shows. On
phones and tablets it stacks above the results in a container closed by
default, so results show on the first screen; a Filters button
(`aria-expanded`) opens it. The breakpoint and the columns are tokens in
`tokens/components.css` ([styling.md](styling.md#tokens)). Sort, the result
count, and the cart's count head the results. The page keeps the scrollbar's
room (`scrollbar-gutter: stable` in `layout.css`) whether or not it scrolls, so
the menu and results don't shift sideways as filtering makes the page shorter
or longer than the window.

**Cards.** Each card shows art (only when the entry has it), name, type badge,
`cardFields`, summary, and source. The whole card opens its entry, and its
cart control sits above that link ([Cart and set actions](#gallery))
([Shared components](styling.md#shared-components)).

- **SRD equipment and conditions.** Each primitive with a record
  ([Index build](#index-build)) has a card under its type, filtered, counted,
  and sorted with the type's custom entries: Condition counts the SRD's 15
  conditions and the custom ones. The card is official, so it shows on a fresh
  Library and has the star; it has no summary or source line, and sorting by
  date added puts it last. It opens the primitive's section on its rules page,
  since a primitive has no detail page, and refs to it still land there. Print
  and the cart take it like any other card, and its print fragment is its
  type's template ([Print](export.md#print)). Without JavaScript, the Library's
  list links it to that section.

- **Official star.** An official entry's card has a star in the top right
  corner, beside its name ([Source and author](content-model.md#source-and-author)),
  named "Official" for assistive technology and on hover. Every card keeps the
  star's slot, a fixed column beside the name, so a name wraps the same with
  or without the star.
- **Source line.** The entry's `source` is a smaller, muted line after the
  summary, above the cart control, so it never reads as a type or rarity. It shows in
  full however long it is, wrapping when it's longer than the card's line. An
  entry with no source has no source line.

A boolean card field (concentration, ritual,
attunement) reads as a badge labeled with the facet when `true` and is left out
when `false`. A `rarity`-formatted field reads as a badge carrying
`data-rarity`. A chip field ([Display](content-model.md#display)) reads as
`<label>: <value>`, a badge per value: a spell's level reads "Level: 2" or
"Level: Cantrip", a creature's CR "CR: 1/8". Other fields read as a label
line and its value ("Level" and "2"). One column on phones, up
to four on wide screens.

**Filters** are a nested accordion checkbox tree built from the registry
(`site/src/lib/gallery/tree.ts`), in two sections, **Sources**, then
**Types**, each a top-level node open at the start. Nothing in it groups by
ruleset, since a Library holds one. Types hold their fields, then any
subfield, then values, such as Types › Creature › Immunities › Conditions ›
Poisoned. Sources, with the ruleset filter the page and old links set, are the
**ruleset set**, which is additive: it chooses which entries are in the
results at all. The types and their facets narrow those entries. Every filter
checkbox behaves the same way: it reads checked when its filter holds its
value, and a click adds or removes that value.

- **Sources** ([Source and author](content-model.md#source-and-author)):
  - **Official** is a checkbox for the author filter's `"publisher"`
    (`f.author=publisher`): the ruleset's own material, such as the SRD for
    `dnd-5e-2024`. It has nothing under it and always shows.
  - **Homebrew** is a group, not a checkbox, holding the **Source** and
    **Author** filters (`f.source`, `f.author`) over the ruleset's other
    entries. Each lists its values like a facet (below), with no official
    source and no `"publisher"`. Homebrew shows when either has a value, and
    opens around an active filter.
- **The ruleset set.**
  - **Additive.** An entry is in the results when it matches any checked
    box in Sources, or the ruleset filter (`SCOPE_PATHS` in
    `site/src/lib/gallery/config.ts`, `applyFilters` in `view.ts`): checking
    Bardic's Compendium of Test Fixtures beside Official adds the
    collection's entries to the official ones. With nothing in the set
    checked, no entry is.
  - **The ruleset filter** (`f.ruleset`) holds the page's ruleset when a link
    asks for the whole ruleset, homebrew included, as old links and the
    redirects from type galleries do ([Redirects](#redirects)). It has no box,
    so Official reads unchecked while it alone shows the official entries.
  - **Default.** A fresh Library has Official checked, so it shows only
    official content. Clear filters clears the other filters and returns the
    set to this default; it shows while either differs from a fresh Library.
  - **Counts.** Official, a source, or an author counts what checking it adds:
    its entries under the search and the other filters, whatever else in the
    set is checked.
- **Types** holds the ruleset's types, each a checkbox for the type filter
  (`f.type`) under its key, `<ruleset>/<type>`, with its label, its count, the
  entries of it among the results (so checking one type leaves the others at
  0), and a disclosure holding its facets. A type shows when the Library has
  entries of it, or it's checked.
- **Fields.** A type's facets follow in registry order. Facets whose paths
  share a field below `stats` or `derived` sit in a node named for it by the
  wording layer's `label`: `stats.immunities.damage` and
  `stats.immunities.conditions` sit in Immunities, the six ability scores in
  Abilities. A field only one facet sits in adds no node, so `stats.ac.value`
  reads as AC. A facet shows when some entry of its type has a value for it,
  or it's active.
- **Values.** An enum facet lists its values vertically as checkboxes,
  or, on a chip field ([Display](content-model.md#display)), as a wrapping
  row of chips (`aria-pressed`) whose values don't nest, each with its count: the entries of its type it matches under the search and
  every other active filter. Values come in declared order (ordered enums),
  by name (ref facets), or alphabetically, plus any selected value no entry
  has. A groups facet's values nest, each group with its own disclosure. A
  range facet's node holds min and max inputs, which accept fractions such as
  `1/8` and decimals. Each filters as the reader types, whenever its text reads
  as a number or is empty, so `1/` and `1.` on the way to `1/8` and `1.5`
  change nothing. While an input has focus its text stays as typed; when focus
  leaves, it shows the filter's value (`0.125` reads `1/8` for CR).
- **Open nodes.** When the tree first shows, from the page's URL, a checked
  type's registry `defaultFilters` start open, in its node, and every node holding an active filter starts open, down to the value
  (`openAtStart` in `tree.ts`). From then on, only a node's own disclosure opens
  or closes it, and only that node: checking or unchecking a type or a value,
  and Clear filters, never opens or closes any node. A node keeps its state while
  a node around it is closed.
- **A shared path** stays in its own type's part of the tree. An enum value
  shows checked, and starts open, only under the types whose entries have it,
  so a link checking Feat › Category › Origin leaves Item › Category closed; a
  selected value no entry has shows under each type, so it can be cleared. A
  shared range starts open only under a checked type, or under each type when
  none is checked.
- Values within a facet combine as OR; facets combine as AND. An entry missing a
  filter's value never matches it. Matching compares strings
  case-insensitively; a value displays in its stored case. A path two types share (`stats.level` on
  spells and feats) is one filter: each type lists its own entries' values, and
  a value checked under one applies to both. Each type still reads the path by
  its own facet: its vocabulary's labels, its declared order when sorting, and
  its own groups when matching (`recordDef` in `config.ts`), so Starships &
  Galaxies' items and celestial bodies, which share `stats.kind`, keep their
  own kinds.
- The tree's ref names and groups come from the build: the gallery island
  passes the names of every ref a ref facet holds, and each grouped type's
  groups (`site/src/lib/gallery/facet-data.ts`). A category reads by its
  `noun` and a group by its `qualifier`, else by name: Equipment › Group ›
  Weapon › Martial › Martial Melee Weapons.

**Sort.** By name, created date, or a facet, ascending or descending. The
menu offers the facets of the types the ruleset set and type filter allow, in
registry order (`sortChoices` in `site/src/lib/gallery/config.ts`): with Spell
checked, it lists name, date added, level, school, and the spell's other
facets, but not CR. With no type checked, every type's facets are offered.
The ruleset filter limits the types to its rulesets only while no source or
author is checked, since those add entries from any ruleset. A path two checked types share (`stats.level` on spells and feats) is one
choice, labeled as the first of them in registry order labels it. When a
filter change leaves the chosen sort off the menu, the sort returns to
`name:asc`. Ordered enums sort by declared order, an array
facet (size) by its first item. Ties break by name, then ruleset, type, and id,
so the order never depends on `library.json` order. Entries missing the sort
value go last in either direction. The Library starts on `name:asc`.

**Search.** A filter on names: an entry matches when its `name` contains the
query, ignoring case and accents, so "barb" and "BARB" find the Barbarian and
"naive" finds "Naïve". Nothing else is searched, not the summary, the rules
text, or a component's name: "Rage" doesn't find the Barbarian. A blank query
matches everything. Search narrows the results like any other filter, and they
keep the active sort, so "bandit" by CR descending lists the Bandit Captain
before the Bandit. There's no search index: the query is matched against the
records in memory.

**URL state.** Query, sort, and filters live in the query string, so any view
can be bookmarked or linked:
`?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8`.
Ranges use `min..max` (either side may be empty). The ruleset set is
written only when it differs from the default: a query naming any of
`f.ruleset`, `f.source`, or `f.author` sets the whole set, so `?f.type=spell`
shows official spells and `?f.ruleset=dnd-5e-2024&f.type=spell` every spell,
and `f.ruleset=` with no value is an empty set. Keys and values are
URL-encoded, so a comma inside a value is `%2C` and a bare comma separates
values; a `/` stays as is. Enum values are case-folded. The type filter is
`f.type`, and its values are `<ruleset>/<type>`, as the data nests a type in
its ruleset (`f.type=dnd-5e-2024/spell`). A bare type id reads as that type
in the Library's ruleset, so `?f.type=spell` shows its official spells, and
the gallery writes it back qualified. Unknown
parameters, filters on paths the Library doesn't have (such as an old
`f.tags.theme`), a sort the filters
don't offer (wherever the filters come in the query), and malformed values are
ignored; of several sorts, the last one offered applies. The gallery rewrites the URL as the view changes,
replacing the history entry, in one canonical form: the ruleset, source,
author, and type filters, then the facets in registry order, with the default sort and ignored parameters left out.

**Cart and set actions.**

- **The print cart** gathers entries to print or download
  (`site/src/lib/cart.ts`). Each card, and each detail page beside its export
  controls, has the shared checkbox "In cart"
  (`components/cart/CartToggle.tsx`), named with the entry's name for
  assistive technology. Checking it adds the entry to the end of the cart, and
  unchecking it removes it. The header shows the cart's count, "Cart: 3",
  after the top bar's links ([Pages and navigation](#pages-and-navigation)).
- The cart lives in the browser's local storage under `ttrpg-library:cart`,
  as a list of `<ruleset>/<type>/<id>` keys in the order they were added, so
  it survives page changes and reloads in that browser, and every open tab
  follows it. Every read and write is wrapped: with storage blocked or
  unreadable, the cart lasts only for the page. It isn't in the URL. The
  cart controls and the count need JavaScript, so they show only once their
  island or script runs.
- When the Library loads `library.json`, or the header's Print or Download
  loads it on another page, entries it no longer has drop out of the cart.
  A detail page's count can include them until then.
- The results' summary says "N in cart", with an **Empty cart** button, while
  the cart holds anything.
- Print and Download sit in the page header ([Page header](#page-header),
  [Controls](export.md#controls)); Download's menu offers the set-scope
  formats.
- An action targets the cart when it holds anything: its entries in the order
  they were added, whatever the filters show. Otherwise, on the Library, it
  targets the whole filtered set in the gallery's order. Each button's accessible name says
  which ("Print 3 in cart", "Download 12 entries"), and both are disabled
  when they'd target nothing.
- An action whose exporter reads entries in full, such as Open5e, first
  fetches the export bundles of its entries. If any fails to load, nothing
  runs, and a polite status region says so. Print and JSON read only the
  entries' keys, so they fetch no bundles
  ([Exporter interface](export.md#exporter-interface)).

**Scale.** The index is loaded once and filtered in memory, sized for a few
thousand entries. Past about 2,000, revisit the index size.

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
  its components' ([content-model.md](content-model.md#components)). Each
  label's links are a shared disclosure (`Details`,
  [Shared components](styling.md#shared-components)) that starts open, with
  the label as its toggle. A target listed under a specific label isn't
  listed again under the generic "References" or "Referenced by"
  ([The ruleset module](rulesets.md#the-ruleset-module)).
- **Homebrew links.** On an official entry's page, links to homebrew entries
  ([Source and author](content-model.md#source-and-author)) are moved out of Links into a
  **Homebrew** section after it, under the same labels: a custom spell that
  names an SRD class is listed there under "Spells", not in the class's
  spell list. A label with links on both sides shows in both sections, and
  a page without homebrew links has no Homebrew section. A homebrew page's
  links aren't split (`splitHomebrew` in `site/src/lib/refs.ts`).
- The type, linked to its ruleset's Library filtered to it ([Redirects](#redirects)).
- A provenance line: created and updated dates. It doesn't name the entry's
  source issues: an entry page links nothing on GitHub but the nav's Contribute
  link. An imported entry's line adds "Adapted from a work by <author>",
  linked to the source, "licensed under <license>", linked to its legal code
  ([Meta](content-model.md#meta)).
- Export controls below the summary: Print and Download, or Print alone on a
  page type ([Controls](export.md#controls)), and the "In cart" checkbox
  ([Cart and set actions](#gallery)). A Preact island renders them once
  hydrated, since every export needs JavaScript; a failed export shows a
  message in a polite status region.
- `<title>` and Open Graph tags (name, summary, and art when present).

### Templates

- One component per type template, `background-card`, `class-page`,
  `condition-card`, `creature-stat-block`, `equipment-card`, `feat-card`,
  `item-card`, `species-page`, `spell-card`, and `subclass-page`, plus a `generic` fallback that renders the fixed keys,
  `stats` and then the ruleset's derived values as one definition list. A derived value is labeled as a stored one is, from its key, and
  listed in the order the ruleset's module returns it. Each text in `stats`
  renders the ruleset's text tokens through its module's `renderTokens`
  ([Text tokens](rulesets.md#text-tokens)); a template's `module` prop
  supplies the module where the library's own isn't the entry's, as in tests. `EntryTemplate` picks the component
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
  there's none. One style in `base.css` serves every template and mode:
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
    `{ref:…}` tokens; `toPlain` reads it as plain text for subtitles and exports.
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
| A filter or sort on a `stats` field | A facet in the registry |
| A template for a type | A component in `site/src/components/templates/`, named in the registry, and a composer in `site/src/lib/` |
| Wording for a type | Its sentences and vocabulary in `rulesets/<ruleset>/phrases.json` |
| A filter that reads display names | `vocabulary` on its facet in the registry |
| Data storage outside the repo | `scripts/build-index/`; the site keeps reading the same `library.json` shape |
