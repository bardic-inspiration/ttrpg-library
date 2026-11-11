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
- [Gallery](../../docs/site.md#gallery): the filter tree, sort, search, URL
  state, selection, and set actions.
- [Detail page](../../docs/site.md#detail-page).
- [Accordion pages](../../docs/site.md#accordion-pages): rules pages and page
  types.
- [Print](../../docs/export.md#print).
- [CI checks](../../docs/workflow.md#ci-checks): the per-PR accessibility
  run.

## Design

### Palette

**One palette for the whole site.** v1's light and dark themes and the
theme switch (System, Light, Dark) are removed. The palette itself is the
style redesign's (#114).

### Library

- **Cards** keep v1's content and their checkbox for multi-select.
- **Export** is one Download button and one Print button. Each acts on the
  selection, or on the filtered results when nothing is selected, and opens
  the device's own save or print dialog. v1's page size dropdown goes. The
  export flows themselves, including what Download offers and how print
  picks its layout, are designed in `export.md` (#115).

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

- `spell/fireball` and `creature/lich`: printed together, stacked on the same
  page.

## Done when

- Print has no per-page mode.
- The site has one set of color tokens, with no theme attribute or switch.
- CI no longer runs the contrast test, and the docs describe the milestone
  review.

## Out of scope

- Colors, type, and the visual style: the style redesign (#114).
- The export flows: #115.
- Publishing homebrew for others: the "Later (v3)" issue (#118).
