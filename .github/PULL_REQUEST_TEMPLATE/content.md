<!--
Title: `Add <n> <type> entries` (mixed batches: `Add <n> entries`), or
`Revise <ids>: <reason>` ([The generate skill](../../docs/generation.md#the-generate-skill), [Revisions](../../docs/generation.md#revisions)). It becomes the squash commit on
main. Content PRs change only content/**, assets/images/**, and, for an
import, ATTRIBUTION.md. Delete sections that don't apply, and this comment.
-->

## Entries

| Name | Type | Summary field | Summary |
|---|---|---|---|
|  |  |  |  |

## Warnings

<!-- Every validator warning, including each formula adjustment (`adjust`)
with its reason. "None" if there are none. -->

## Self-review

<!-- docs/generation.md "Self-review". Tick each item once it holds; under an
item that can't, name the dev issue filed for it. -->

- [ ] Validate and build pass
- [ ] The tests pass (`npm test`)
- [ ] IDs are name slugs, apostrophes dropped, unique
- [ ] Every mentioned library entry or rule is a ref
- [ ] Inputs only; tokens for derived numbers; each `adjust` explained
- [ ] Every warning is listed with its reason
- [ ] No SRD name or proper noun reused, nothing blocklisted; SRD entries match the PDF
- [ ] Only the batch's files changed; Entries table complete

## Gap fill

<!-- Gap-fill runs only: the bucket that was filled. -->

## Skipped on import

<!-- Import batches only: each issue's skip-list section from `npm run import`,
in issue order, plus any entry removed for an SRD proper noun. -->

<!-- One line per fulfilled issue. -->
Closes #
