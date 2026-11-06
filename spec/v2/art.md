---
issue: 117
depends: [style]
---

# Art

## Goal

Fill entries' `image` field with public domain and openly licensed art that
fits the style ([`style.md`](style.md)), through a repeatable workflow that
can be tuned until it finds the right images. No generated art. It serves P1
(files are the database), P5 and P9 (licensing and an original look), and P7
(art is reviewed before it publishes).

## Current

- [Images](../../docs/content-model.md#images): the `image` field, its path,
  and its size limits.
- [Licenses](../../docs/licensing.md#licenses): third-party assets are
  credited in `ATTRIBUTION.md`.
- [Work lanes](../../docs/workflow.md#work-lanes): `assets/images/` is in the
  content lane.

## Design

### Hosting

Images stay in the repo under `assets/images/`, reviewed in PRs like any
content, with the current size warning and limit. Processed line art is
small, about 30–150 KB per image, so art for the whole library fits in the
repo. No external hosting.

### Style and processing

- **What:** late-1800s and early-1900s book illustration and architectural
  drawing: art nouveau, early modern, and similar pen-and-ink work.
- **Processing:** light. Crop to the art frame's aspect ratio, convert to
  monochrome, and save as WebP or PNG at the size the site displays. The
  tint is applied by CSS from the palette at display time, so one file
  serves every accent.

### Sources and rights

- **Sources** include Wikimedia Commons, the Internet Archive's book scans,
  the Library of Congress, the Met, Smithsonian Open Access, NYPL Digital
  Collections, the Rijksmuseum, and the British Library's Flickr
  collection.
- **What can be used:**
  - anything its source marks public domain, CC0, or CC-BY;
  - anything the skill judges public domain from its creator and date:
    published in the United States before 1931, or by a creator who died
    more than 70 years ago (before 1956). The reasoning is recorded with
    the image.
- **Denylist:** a list in the repo of collections, estates, and rights
  holders to avoid even when an image's age looks safe, such as the Frank
  Lloyd Wright Foundation, estates that enforce trademarks, and collections
  whose terms restrict reuse. A candidate from one is never retrieved.
- **Provenance** travels with every image from retrieval on: source URL,
  title, creator, date, and the license or public domain basis. A committed
  image records it with its entry and is credited in `ATTRIBUTION.md`.

### The art skill

An `art` skill retrieves candidates for entries from the sources, checks
their rights and the denylist, records provenance, processes them, and posts
them for review.

### Tuning loop

Getting a good image set takes iteration. The loop runs on a `spike/`
branch, so candidates never reach `main`:

1. The skill finds and processes a round of candidates and posts them to the
   [Art Review](https://claude.ai/artifact/TkeC3AAJj5dBJYJmKdMjXP) page, a
   private claude.ai page where the owner rates each one Good, OK, or
   Rejected, with an optional note on why. Ratings save as they are made.
2. The next session reads the ratings from the page and updates the skill's
   search terms, filters, and processing from them, as a commit on the spike
   branch.
3. Repeat until the owner judges the results good enough.

Candidates are rated after processing, so a round tunes both the search and
the processing.

### Publishing art

- **The v2 build:** once tuned, the skill opens a content PR with the
  Good-rated images, setting each entry's `image` and recording its
  provenance. The owner reviews and merges it.
- **Later content:** art can come with new content or be added to existing
  entries later. Art has its own review criteria, so an entry can pass while
  its art is denied. When that happens, the two are split: the content goes
  ahead without the art, and the routine leaves a comment on the request
  issue saying so.

## Cases

- `creature/lich`: an entry whose art is found, tuned through the loop, and
  committed by the content PR.
- `spell/fireball`: an entry that passes review while its art is denied,
  split from it with a comment on the request.

## Done when

- The `art` skill retrieves, checks, processes, and posts candidates, and
  refuses anything on the denylist.
- Every committed image has provenance and an `ATTRIBUTION.md` credit, and
  validation fails an `image` without them.
- The content PR from the tuning loop has merged.

## Open questions

- **Provenance fields:** where in the entry the image's provenance lives
  (under `meta`, or beside `image`), and its exact shape.
- **Art PRs:** the branch prefix and label for an art-only content PR, and
  the request issue's template field for art submitted with content.
- **Display size and aspect:** the exact crop and pixel sizes, set when the
  UI's art frame is built.

## Out of scope

- Generated art.
- External image hosting.
- Art for authors publishing their own content: a later version (#118).
