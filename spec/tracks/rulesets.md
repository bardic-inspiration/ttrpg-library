---
issue: 403
depends: []
---

# Rulesets

## Goal

A second published ruleset in the library beside `dnd-5e-2024`, from a
publisher whose license allows it. It proves the ruleset module contract
on real published content, not only the fixture rulesets. It serves P4
(adding a ruleset is adding a folder), P5, and P9 (official content only
where it's licensed).

## Current

- [The ruleset module](../../docs/rulesets.md#the-ruleset-module): the
  contract every ruleset meets.
- [Fixture rulesets](../../docs/rulesets.md#fixture-rulesets): two original
  rulesets that test the generic code.
- [Source and author](../../docs/content-model.md#source-and-author):
  official content and each ruleset's publisher.
- [Licenses](../../docs/licensing.md#licenses).

## Design

Nothing is designed yet. The track holds the item until its open questions
are answered.

## Open questions

- **Which ruleset,** and under which license.
- **How it's imported:** a stage-by-stage SRD import like `dnd-5e-2024`'s, or
  a smaller set of types first.
- **Sourcebook rule additions** (#374): a sourcebook that changes rules is
  partly a ruleset variant, so whether rule additions reach the whole
  library or only the sourcebook's own entries may be settled here.
- **Ruleset-neutral maps:** one map populated by encounters from two
  rulesets, once maps have their spatial schema.
