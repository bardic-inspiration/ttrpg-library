---
issue: 402
depends: []
---

# Tags and search

## Goal

Make search a filter on names, which shrinks the index before the UI
revision builds on it. Tags are already gone. It serves P11 (a lean index).

## Current

- [Index build](../../docs/site.md#index-build): `search` in each
  `library.json` record.
- [Gallery](../../docs/site.md#gallery): MiniSearch over name, summary, and
  `search`, with results in relevance order while searching.

## Design

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

- Tests and fixtures that build search records: fixed in one pass
  ([`AGENTS.md`](../../AGENTS.md) "Dev workflow").

## Done when

- `library.json` records have no `search`, and MiniSearch isn't a
  dependency.
- The Library filters by name substring and keeps the active sort with a
  query.
- The docs above describe what's built.

## Out of scope

- Searching rules text or component names, which name-only search gives up.
