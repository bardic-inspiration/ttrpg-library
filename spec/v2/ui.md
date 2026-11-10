---
issue: 113
---

# UI

## Goal

A UI designed from criteria rather than assembled, covering every v2 type.
The site is a DM's resource, used mostly to look things up and to prep
sessions. The criteria:

- **One place for all content.** Everything the library holds is reached from
  one Library and one Rulesets section.
- **Lookup is fast.** Finding an entry by name or by criteria takes the
  fewest steps, at the table as well as at a desk.
- **Export is easy.** Getting entries out, printed or downloaded, takes one
  button.
- **Device-agnostic.** It works equally well on phones, tablets, and laptops.
  None of them is the primary device.

It serves P10 (cheap, safe refinement) and P11 (weight follows the
selection). Publishing homebrew for others is out of scope for v2.

## Current

- [Pages and navigation](../../docs/site.md#pages-and-navigation): routes and
  the header.
- [Gallery](../../docs/site.md#gallery): filters, sort, search, URL state,
  selection, and set actions.
- [Detail page](../../docs/site.md#detail-page).
- [Print](../../docs/export.md#print).
- [CI checks](../../docs/workflow.md#ci-checks): the per-PR accessibility
  run.

## Design

### Navigation

The top bar is **Library | Rulesets | About | Contribute**.

- **Library** is one gallery of all content. Its filters do the navigating,
  so it replaces the per-ruleset and per-type galleries. Their old URLs
  redirect to the Library with the matching filter set (P9).
- **Rulesets** lists each ruleset's rules pages (the Glossary, Conditions,
  and one page per equipment category) and its Extensions page
  ([Rules pages](../../docs/site.md#rules-pages)).
- **About** is v1's About page.
- **Contribute** links to the repository for now.

**One palette for the whole site.** v1's light and dark themes and the
theme switch (System, Light, Dark) are removed. The palette itself is the
style redesign's (#114).

### Library

- **Search** sits on top of the filter menu and works as in v1.
- **The filter menu** is a sidebar on desktop. On phones and tablets it is a
  collapsible container, closed by default, so results show on the first
  screen.
- **Filters are a nested accordion checkbox tree** that follows the schema:
  type, then field, then any subfield, then value, such as Creature ›
  Immunities › Conditions › Poisoned, or Equipment › Weapon › Martial ›
  Melee. Values are listed vertically, replacing v1's chips, and keep their
  counts. The tree holds every facet, so v1's "Add filter" goes. A range
  facet, such as CR, keeps its min and max inputs inside its node.
- **Facets over refs** are enum facets valued by key and shown by the
  target's name, so the tree can offer them:
  - a creature's `immunities.conditions` (Creature › Immunities ›
    Conditions);
  - a spell's `classes`, in place of the derived class ids its Classes filter
    reads now ([Spells](../../docs/rulesets.md#spells));
  - a background's `stats.feat`, which the background card then shows beside
    its abilities;
  - a subclass's `stats.class`, which the subclass card then shows, and by
    which subclasses then sort by default.
- **Cards** keep v1's content and their checkbox for multi-select.
- **Export** is one Download button and one Print button. Each acts on the
  selection, or on the filtered results when nothing is selected, and opens
  the device's own save or print dialog. v1's page size dropdown goes. The
  export flows themselves, including what Download offers and how print
  picks its layout, are designed in `export.md` (#115).

### Entries and pages

- **A card entry opens on its own detail page**, as in v1, and
  back-navigation returns to the results.
- **Page types** (classes, subclasses, species) and **rules pages** are long
  pages laid out as accordion sections with a jump-to table of contents.
  Sections start collapsed. A link to a section, including a link to a
  primitive or component ([Components](../../docs/content-model.md#components)), opens it and scrolls
  to it.

### Print

Print stacks the entries it is given, one after another, packed onto as few
pages as they fill. v1's mode that starts each entry on a new page is
removed, and so is the footer that names each page's entry; the footer
carries the attribution only. Long entries still flow onto following pages
without splitting an action or trait.

### Testing

- **Layout is checked on every UI PR.** The PR includes screenshots at
  phone (390px), tablet (820px), and desktop (1440px) widths, taken with
  Playwright.
- **Accessibility is reviewed once per milestone.** Each build milestone
  ends with one comprehensive review against WCAG 2.2 AA, filed as a Testing
  backlog issue. The contrast test leaves CI and the pre-push checks. (The axe
  run already runs only on milestone PRs:
  [Milestone PRs](../../docs/workflow.md#milestone-prs).)

## Cases

- `creature/air-elemental`: reached in the filter tree through Creature ›
  Immunities › Conditions.
- `creature/lich`: a long card entry on its detail page, at all three widths.
- `spell/fireball` and `creature/lich`: printed together, stacked on the same
  page.

## Done when

- The top bar reads Library, Rulesets, About, Contribute, and the old gallery
  routes redirect to the Library with their filter.
- The filter tree is built from the schemas, and every facet of every type
  appears in it.
- Rules pages and page types render as accordion sections with a table of
  contents, and an anchor link opens its section.
- Print has no per-page mode.
- The site has one set of color tokens, with no theme attribute or switch.
- CI no longer runs the contrast test, and the docs describe the milestone
  review.

## Out of scope

- Colors, type, and the visual style: the style redesign (#114).
- The export flows: #115.
- Publishing homebrew for others: the "Later (v3)" issue (#118).
