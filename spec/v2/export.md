---
issue: 115
depends: [ui]
---

# Export

## Goal

Getting entries out of the library in as few steps as possible, for the
three places they go:

- **Data for other software:** VTTs and other TTRPG content sites.
- **Digital files** for viewing and sharing in chat channels.
- **Paper copies** for the table.

It serves the UI's "export is easy" criterion ([`ui.md`](ui.md)), P1 (no
runtime services), and P11 (weight follows the selection).

## Current

- [Exporter interface](../../docs/export.md#exporter-interface): exporters,
  scopes, and controls.
- [JSON](../../docs/export.md#json), [PNG](../../docs/export.md#png), and
  [Print](../../docs/export.md#print).
- [Export config](../../docs/export.md#export-config): page sizes and PNG
  settings.

## Design

### Controls

Every place that exports has at most two buttons, **Print** and
**Download**, as the UI design sets out.

- **Print** opens the print view, which opens the device's print dialog, as
  in v1. A PDF is saved from that dialog.
- **Download** opens a small format menu listing the formats that offer the
  current scope: **PNG**, **JSON**, and each format translator's format as
  `translators.md` (#116) adds them. Choosing one downloads the file.

| Where | Print | Download |
|---|---|---|
| A card entry's detail page | Yes | PNG, JSON, translators |
| The Library, for the selection or the filtered results | Yes | JSON, translators |
| A page type's page (class, subclass, species) | Yes | No |
| A rules page | Yes | No |

Printing a page type or a rules page prints all its sections expanded.

### Print layout

The print view no longer takes a page size. The reader picks the paper in
the print dialog, and the layout adapts to the printed page's width: the
two-column stat-block layout on a wide page such as Letter or A4, and one
column with smaller type on a narrow page such as Half-Letter or a 4 × 6
card. The page sizes in `config/export.json` give way to the width
breakpoints between those layouts, kept as print tokens. Entries stack, as
the UI design sets out.

### Formats

- **JSON** stays v1's raw-file export: one entry's file, or an array for a
  set.
- **PNG** stays v1's capture, for a single entry.
- **Format translators** are further exporters behind Download, designed in
  `translators.md` (#116).

### No dynamic API

The data lane is file downloads. VTTs and content sites import files in
their own formats, which translators produce. The static per-entry files
(`data/<ruleset>/<type>/<id>.json`) and `library.json` stay published at
stable URLs, an informal read-only feed for anything that fetches by URL.

## Cases

- `creature/lich`: Download › PNG captures it at the wide width; Print fits
  it in two columns on Letter and one column on a 4 × 6 card.
- `spell/fireball` and `creature/lich`, selected in the Library: Download ›
  JSON saves both as one array, and the menu offers no PNG.

## Done when

- Detail pages and the Library show only Print and Download, and Download's
  menu lists exactly the formats that offer its scope.
- The print view has no page size control or `size` parameter, and its
  layout switches between one and two columns by printed page width.
- Page types and rules pages have Print and no Download, and print with
  every section expanded.

## Out of scope

- One-click PDF without the print dialog: dropped for v2.
- A server API and connecting live apps: later versions, once there is a
  server (#118).
- Each translator's target format: `translators.md` (#116).
