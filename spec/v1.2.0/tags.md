---
issue: 402
depends: []
---

# Tags and search

## Goal

Remove tags, which were placeholders, and make search a filter on names.
Both shrink the index and the filter menu before the UI revision builds on
them. It serves P3 (one place per fact: organization comes from typed
fields and arrangements, not free-form tags) and P11 (a lean index).

## Current

- [Tags](../../docs/content-model.md#tags): the open `tags` map, and every
  key a `tags.<key>` filter.
- [Index build](../../docs/site.md#index-build): `tags` and `search` in each
  `library.json` record.
- [Gallery](../../docs/site.md#gallery): the Tags node in the filter tree,
  `f.tags.*` in the URL, and MiniSearch over name, summary, tag values, and
  `search`.
- [Detail page](../../docs/site.md#detail-page): tags as chips.
- [Type registry](../../docs/site.md#type-registry): `tags.theme` in most
  types' `defaultFilters`.
- [Requests](../../docs/generation.md#requests) and
  [Defaults](../../docs/generation.md#defaults): request tags and
  `defaults.tags`, applied by the `generate` skill.

## Design

### Tags removed

- **The envelope has no `tags`.** The schema rejects the key, like any
  unknown key (P2).
- **Gone with it:** the `tags` record field in `library.json`, the Tags
  node in the filter tree, tag chips on detail pages, `tags.*` paths in
  `defaultFilters`, the request form's Tags field, `defaults.tags`, and the
  `generate` and `revise` skills' tag steps.
- **Old URLs:** an `f.tags.*` parameter is ignored, as any filter on a path
  the Library doesn't have already is.
- P2's "Organization (tags) stays open" is retired: P2 applies to every
  field.

### Search filters by name

- **Search matches the entry's name only:** a case- and accent-insensitive
  substring match of the query against `name`. It's a filter: it narrows
  the results like any other, and they keep the active sort.
- **No relevance order.** The sort control always shows the active sort, and
  "Sorted by relevance while searching" goes.
- **No search index.** MiniSearch is removed, and `library.json` records lose
  `search`. The query stays in the URL as `q`.
- A component's name no longer finds its parent: "Rage" doesn't find the
  Barbarian, since the Barbarian's name doesn't contain it.

## Cases

- `class/barbarian`: a search for "barb" finds it; a search for "rage"
  doesn't.
- `spell/acid-arrow`: searches for "ACID" and "arrow" both find it.
- `creature/bandit` and `creature/bandit-captain`: a search for "bandit"
  with the sort on CR descending lists the captain first.

## Migration

- Strip `tags` from every entry that has it: one migration commit, made by a
  script, under the `migration` label.
- Remove `tags.*` from every type's `defaultFilters` in `config/types.json`,
  and `tags` from `config/defaults.json`.
- Tests and fixtures that build entries with tags or search records: fixed in
  one pass ([`AGENTS.md`](../../AGENTS.md) "Dev workflow").

## Done when

- Validation rejects `tags` on an entry, and no entry has it.
- `library.json` records have neither `tags` nor `search`, and MiniSearch
  isn't a dependency.
- The Library filters by name substring, keeps the active sort with a query,
  and ignores `f.tags.*`.
- The docs above describe what's built, and `docs/decisions.md` records the
  retired half of P2.

## Out of scope

- Searching rules text or component names, which name-only search gives up.
