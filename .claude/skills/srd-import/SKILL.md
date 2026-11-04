---
name: srd-import
description: Import SRD 5.2 entries into the library for an SRD import stage (SPEC.md §8.1), and manage SRD entries already imported, such as a link pass, a correction, or the QA/QC review. Covers picking batches, transcribing from the SRD PDF, verifying against it, filing format gaps, and the PRs. Use in a session the owner starts for a Milestone 7 stage or for SRD entry upkeep. Entry rules come from the generate and revise skills; this skill is the session workflow around them.
---

# SRD import

How a session imports SRD content and keeps it right. `SPEC.md` §5.9 and
§8.1 are the source of truth. The `generate` skill
(`.claude/skills/generate/SKILL.md`, "SRD entries") holds the rules for
writing each entry, and the `revise` skill
(`.claude/skills/revise/SKILL.md`) holds the rules for changing one. Follow
both exactly; this skill adds the workflow that makes a large import
consistent.

**Priority.** Consistent, streamlined machinery beats exact typographic
matching. If matching a detail of the SRD would take a per-entry workaround
because of how the templates render, don't add one: the detail goes in the
nearest free-text field as printed, or, if the templates own it, it's listed
under §5.9 "Formatting" as not matched. When a new kind of detail comes up,
update §5.9 in a dev PR rather than working around it.

## Inputs

- **A stage issue** under Milestone 7 (§16), without the `request` label.
  Don't claim it with `in-progress`.
- **Upkeep** of imported entries: a link pass, a `revise` issue about an SRD
  entry, or the QA/QC review issue.

## Step 1: Read

- The stage issue and its comments, and `SPEC.md` §5.9, §6, and §8.1.
- `rulesets/dnd-5e-2024/srd-manifest.json`: every SRD entry with its type and
  tier.
- For each type in the stage: its schema in
  `rulesets/dnd-5e-2024/schemas/`, its guideline's token and dependency
  sections in `rulesets/dnd-5e-2024/guidelines/`, the tokens in
  `rulesets/dnd-5e-2024/tokens.ts`, and the derivations in
  `rulesets/dnd-5e-2024/derive.ts`.
- A few entries of that type already in `content/dnd-5e-2024/` with
  `meta.source.srd`, as the pattern to match.

## Step 2: Pick the batches

Run `npm run srd-coverage -- --type <type> --tier <tier>` for the stage's
tier. One batch is every missing entry of one type: batches are separated by
type, never by count, and have no size limit (§8.3). Work the types in
dependency order: spells first, then magic items and creatures, which refer
to spells.

## Step 3: Survey the batch for format gaps

Before writing entries, check every entry of the batch against the schema:
header forms (casting times, ranges, durations, recharge notation, speeds,
senses), tables, embedded stat blocks, and any structured field the type
defines. List each form the schema or the template can't hold.

- A gap that recurs with a fixed shape is a **format fix**: file a dev issue
  under Milestone 7, placed before the stage (`AGENTS.md` "Dev Queue"), and
  fix it in a dev PR that may add the entries that motivated it (§8.1).
- A one-off detail goes in the nearest free-text field as printed (§5.9); it
  isn't a gap.
- Entries blocked on a format fix wait for it. Import the rest of the batch
  now; the blocked ones come in with the fix or the next batch of that type.

## Step 4: Transcribe from the PDF

Transcribe from the text layer of `docs/SRD_CC_v5.2.pdf`, never from memory.
For a batch of more than a few entries, write a throwaway extraction script
in the session's scratch space (never in the repo), so every entry goes
through the same rules. What worked:

- **Order by baseline.** Read characters with their font, size, and text
  matrix, and order them by the matrix baseline, not by the `top` value,
  which is off for bold and italic fonts. Split the two columns at the page
  midline (x = 297) and read the left column first. Stream order is
  unreliable at column breaks.
- **Fonts identify structure.** Each chapter uses its own fonts: entry names,
  header labels and values, body text, and bold, italic, and bold-italic runs
  each have one font and size. Map them per type, and report any character
  in an unexpected font: it's an entry the rules missed.
- **Paragraphs.** A new paragraph starts at a line that begins with a bold or
  bold-italic run ending in ".", at a bullet, at a first-line indent, or after
  a vertical gap larger than a normal line. A hanging indent is not a break.
- **Hyphens at line ends.** Join a word broken across lines unless the
  hyphenated form occurs whole on one line elsewhere in the SRD (build that
  vocabulary from the extraction). Keep a short list of words to always join
  for the cases the vocabulary gets wrong. Never add a space after a
  line-ending "-" or "—".
- **Styles.** Emit `*italic*`, `**bold**`, and `***bold italic***` from the
  fonts. An inline heading is bold italic (§9.5).
- **Text clean-up.** Normalize whitespace and straight quotes in text fields.
  Keep the curly apostrophe in a `name` where the manifest has one, so the
  coverage report matches.
- **Missing text.** A heading or passage absent from the text layer (Acid
  Splash's heading) is transcribed by hand from the page and checked twice.

## Step 5: Convert to entries

Write entries by the `generate` skill's SRD rules. Parse each header field
into its structured field with strict patterns, and stop on any form the
patterns don't match instead of guessing. Lessons from the first import:

- **Inputs from printed numbers.** Store inputs, never derived values (§6.1).
  A creature's proficiency bonus is a printed skill or save bonus minus its
  ability modifier; its Hit Dice come from the HP formula; an attack's
  ability is the one whose modifier matches both the to-hit and the damage
  modifier. In prose, derived numbers are tokens from
  `rulesets/dnd-5e-2024/tokens.ts`. An escape DC or a DC no rule derives is
  the authored `{dc=n}` form.
- **When no input reaches the SRD number,** set `adjust` or a damage `bonus`
  with the reason "matches SRD". When the SRD's own number is inconsistent
  with its inputs (a misprint), keep the derived value, and record the
  misprint in the PR body.
- **Hand-written structured fields.** Charges, spells cast, and save DCs an
  item's text states are written per entry from its text, then checked: list
  every entry whose text mentions charges or casting but has no such field.
- **Summaries** are one plain, factual line per entry, written for it.
- **Links.** A mention of an entry already in the library, or in the same
  batch, is a `{ref:<type>/<id>}` link or a ref. Anything else stays plain
  text, and gets linked by the link pass once it's imported.
- `meta.source.issues` is `[<stage>]`.

## Step 6: Verify

Before pushing, check every entry against the PDF by what the site renders,
not by the JSON:

- Render each entry through the template code in `site/src/lib/creature.ts`,
  `site/src/lib/spell.ts`, or `site/src/lib/magic-item.ts`, and compare it
  line by line with the PDF text of the same entry. Every difference is
  either fixed, a misprint recorded for the PR, or a §5.9 formatting
  difference.
- Run `npm run validate` and `npm run build`. Never push a failing batch.
- Run `npm run srd-coverage -- --type <type> --tier <tier>` again: the batch's
  entries no longer show as missing.

## Step 7: Open the PR

One PR per batch, so one type per PR, as the `generate` skill's step 6 says:
branch `gen/srd-<stage>-<type>-<YYYYMMDD>`, staging only the new files under
`content/`, the `.github/PULL_REQUEST_TEMPLATE/content.md` body, and
`Refs #<stage>`, or `Closes #<stage>` on the PR that finishes the stage.
Under **Warnings**, also list every SRD misprint kept as derived, every
entry transcribed by hand, and every entry held for a format fix with its
issue.

## Step 8: Link pass

When a stage's batches have merged, mentions written as plain text because
the target wasn't in the library yet can now be links. Find every SRD entry
whose text or plain-string fields name an entry now in the library, and turn
each into a `{ref:<type>/<id>}` link or a ref (§5.7). This is a revision: by
the `revise` skill's rules, on branch `revise/<stage>-<YYYYMMDD>`, with
`meta.updatedAt` set, `meta.source.kind` left as-is, and one commit titled
`Revise <n> SRD entries: link mentions of library entries`. Match names
exactly as words, and skip a match that is ordinary prose rather than the
entry ("a shield", "the light").

A new link can break a dev test that loads a few entries by file and
validates them alone (`tests/site/tables.test.ts`), and content-lane CI
doesn't run the tests. So run `npm test` before pushing a link pass too, and
if a test's fixture list no longer resolves, file the fix as a dev issue
rather than skipping the link.

## Managing SRD entries

- **Corrections** only bring an entry closer to the SRD (§8.5). An
  instruction to change an SRD entry otherwise isn't applied; suggest a
  custom variant instead. Never change an `id` or move a file.
- **A format fix that changes how existing entries are stored** migrates
  them in its dev PR, which gets the `migration` label automatically
  (§12.4).
- **The QA/QC review** of Milestone 7 rechecks every SRD entry: Step 6
  across the whole library, plus a look at the built site. Each problem it
  finds goes in one PR per type, one commit per kind of problem.
- **Done.** A stage is done when `npm run srd-coverage` reports no missing
  entries of its tier and its link pass has merged. Milestone 7 is done when
  every stage is done and every format-fix issue is closed.
