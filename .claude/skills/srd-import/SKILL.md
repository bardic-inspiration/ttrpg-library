---
name: srd-import
description: Import SRD 5.2 entries into the library for an SRD import stage (docs/generation.md#srd-import), and manage SRD entries already imported, such as a link pass, a correction, or the QA/QC review. Covers picking batches, transcribing from the SRD PDF, verifying against it, filing format gaps, and the PRs. Use in a session the owner starts for an import stage or for SRD entry upkeep. Entry rules come from the generate and revise skills; this skill is the session workflow around them.
---

# SRD import

How a session imports SRD content and keeps it right. [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries) and
[Requests](../../../docs/generation.md#requests) are the source of truth. The `generate` skill
(`.claude/skills/generate/SKILL.md`, "SRD entries") holds the rules for
writing each entry, and the `revise` skill
(`.claude/skills/revise/SKILL.md`) holds the rules for changing one. Follow
both exactly; this skill adds the workflow that makes a large import
consistent.

**Priority.** Consistent, streamlined machinery beats exact typographic
matching. If matching a detail of the SRD would take a per-entry workaround
because of how the templates render, don't add one: the detail goes in the
nearest free-text field as printed, or, if the templates own it, it's listed
under [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries) "Formatting" as not matched. When a new kind of detail comes up,
update [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries) in a dev PR rather than working around it.

## Inputs

- **A stage issue** under the import's milestone issue, without the `request` label.
  Don't claim it with `in-progress`.
- **Upkeep** of imported entries: a link pass, a `revise` issue about an SRD
  entry, or the QA/QC review issue.

## Step 1: Read

- The stage issue and its comments, and [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries), [Rulesets](../../../docs/rulesets.md), and [SRD import](../../../docs/generation.md#srd-import).
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
type, never by count, and have no size limit ([Defaults](../../../docs/generation.md#defaults)). Work the types in
dependency order: spells first, then magic items and creatures, which refer
to spells.

## Step 3: Survey the batch for format gaps

Before writing entries, check every entry of the batch against the schema:
header forms (casting times, ranges, durations, recharge notation, speeds,
senses), tables, embedded stat blocks, and any structured field the type
defines. List each form the schema or the template can't hold.

- A gap that recurs with a fixed shape is a **format fix**: file a dev issue
  under Milestone 7, placed before the stage (`AGENTS.md` "Dev Queue"), and
  fix it in a dev PR that may add the entries that motivated it ([Requests](../../../docs/generation.md#requests)).
- A one-off detail goes in the nearest free-text field as printed ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries)); it
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
  fonts. An inline heading is bold italic ([Templates](../../../docs/site.md#templates)). Space characters carry a
  font too: treat whitespace as style-neutral, and put spaces outside the
  markers. A `.`, `,`, `;`, `:`, or `)` set tight against the character
  before it takes that character's style. Merge adjacent runs of one style,
  including a word split by a font change mid-word (`*Fail**ure:*`).
- **One name per italic run.** The SRD italicizes each spell in a list
  separately ("*Bless*, *Healing Word*"). An extraction that yields one run
  over a comma-separated list has merged them: split it, one run per name.
- **Stat block boundaries.** A block starts at its name followed by its
  italic size-and-type line. The name usually appears twice (the group
  heading, then the block heading), and the next group's heading can trail
  the previous block: drop it. A misprinted heading is found by its type line
  (the Knight's block is headed "Iron Golem"). The header lines (AC through
  CR) end at the first section heading, which can be Bonus Actions,
  Reactions, or Legendary Actions as well as Traits or Actions.
- **Tables from the page image.** The text layer scrambles table cells, and
  sometimes drops stat block lines. Read every table, and check every stat
  block, against the rendered page (`pdftoppm -r 100` gives a readable image).
- **Text clean-up.** Normalize whitespace and straight quotes in text fields.
  Keep the curly apostrophe in a `name` where the manifest has one, so the
  coverage report matches.
- **Missing text.** A heading or passage absent from the text layer (Acid
  Splash's heading) is transcribed by hand from the page and checked twice.

## Step 5: Convert to entries

Write entries by the `generate` skill's SRD rules. Parse each header field
into its structured field with strict patterns, and stop on any form the
patterns don't match instead of guessing. Lessons from the first import:

- **Inputs from printed numbers.** Store inputs, never derived values ([Inputs and derived values](../../../docs/rulesets.md#inputs-and-derived-values)).
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
- **Summaries** are one plain, factual line per entry, written for it before
  the entry is generated. Never write a placeholder: the validator rejects
  `TODO`-style markers ([Consistency checks](../../../docs/rulesets.md#consistency-checks)), but not every stand-in a script can produce.
- **`shortName`.** Set it when the SRD's prose calls the creature something
  other than the last word of its name ("The priest" for the Priest Acolyte,
  "The sphinx" for the Sphinx of Lore). The render check in step 6 finds
  every one: the generated Spellcasting intro reads "The acolyte" instead.
- **Action names.** A recharge or uses note in the name's parentheses goes
  in `recharge` or `uses`; any other parenthetical ("Bite (Bear Form Only)")
  stays in the name. A parenthetical that mixes them ("Nightmare Haunting
  (1/Day; Requires Soul Bag)") stays whole in the name.
- **Prose that the action fields can't hold** stays an `other` action with
  tokens: a reaction's italic *Trigger:* and *Response:* labels, a saving
  throw inside a trait or after lead-in text, and staged effects (*First
  Failure:*). A save action whose effect runs on in more paragraphs keeps
  them in its last field (`onFailure`, `onSuccess`, or
  `onFailureOrSuccess`), separated by blank lines.
- **Forms the formats hold** (look up each in `docs/rulesets.md` and the schema before writing it):
  - a table title, as a bold-only line directly above the table ([Tables in text](../../../docs/content-model.md#tables-in-text));
  - a table printed in side-by-side halves, as one table ([SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries));
  - a footnote marker, escaped as `\*` in a header cell and the note;
  - a hanging-indent bold run-in item, as a `***Name.***` paragraph, as
    Folding Boat's command words are;
  - per-variant rarities, in `rarityVariants` with `rarity: "varies"` ([Magic items](../../../docs/rulesets.md#magic-items));
  - an Initiative line in a stat block inside an item or spell ([Shared definitions](../../../docs/rulesets.md#shared-definitions));
  - a creature's Spellcasting with no save DC, with `spellcasting.noSaveDc`
    ([Situational fields](../../../docs/content-model.md#situational-fields), [Creatures](../../../docs/rulesets.md#creatures));
  - a creature with no Actions, by omitting `actions` ([Creatures](../../../docs/rulesets.md#creatures));
  - damage prose that continues with a dash ("—or …"), as `onHit` text
    starting with the dash ([Creatures](../../../docs/rulesets.md#creatures)).
- **Item spells.** A spell cast for 0 charges, or not for charges at all
  (beads, a free cast), omits `chargeCost`; the table in `effect` still
  shows the printed cost. "Regains all expended charges" is a `recharge` of
  "all daily at dawn". A qualifier printed after a spell ("level 5 version",
  "save DC 18") is the ref's `note`, or `saveDc` when it's a save DC.
- **Template-owned wording.** Where the SRD misprints something the
  template generates ("reach 5 feet", "+17 to hit", a dropped "the" in the
  Spellcasting intro), write the structured value; the template prints its
  standard form. List each in the PR body as a misprint.
- **Self-mentions** of an entry's own name stay plain italics, not links.
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
  either fixed, a misprint recorded for the PR, or a [SRD and custom entries](../../../docs/content-model.md#srd-and-custom-entries) formatting
  difference. What worked for a large batch: build the site, read each
  detail page's text with Playwright, normalize both sides (drop markup,
  straighten quotes, turn "−" into "-", drop the ability table, which is
  derived), and diff them word by word. Only real differences are left to
  read.
- A word diff can't see markup or paragraph breaks, so also check every
  text field: each `*`, `**`, and `***` marker closes, and no italic or bold
  name that matches a library entry (other than the entry itself) is left
  unlinked.
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

To add a later batch of the same type to an open PR, first check that the PR
is still open: a merged PR's branch takes no more work. Branch from `main`
with the next suffix (`-2`) and open a new PR, and say in its body which PR
it follows. A format-fix dev PR that adds entries gets the `migration` label
from the labeler, and the `lane` job waits for it ([Lane rules](../../../docs/workflow.md#lane-rules)), so it needs no
manual label change.

## Step 8: Link pass

When a stage's batches have merged, mentions written as plain text because
the target wasn't in the library yet can now be links. Find every SRD entry
whose text or plain-string fields name an entry now in the library, and turn
each into a `{ref:<type>/<id>}` link or a ref ([References](../../../docs/content-model.md#references)). This is a revision: by
the `revise` skill's rules, on branch `revise/<stage>-<YYYYMMDD>`, with
`meta.updatedAt` set, `meta.source.kind` left as-is, and one commit titled
`Revise <n> SRD entries: link mentions of library entries`. Match names
exactly as words, and skip a match that is ordinary prose rather than the
entry ("a shield", "the light"). What the pass covers, and the traps:

- **Text fields:** an italic spell or magic-item name becomes
  `*{ref:<type>/<id>}*`, keeping a trailing period inside the italics. A bold
  creature name becomes `**{ref:creature/<id>}**`, with any comma that sat
  inside the bold moved after it. Match an italic run only when it starts
  and ends with a non-space character: otherwise the ", " between two
  italic names pairs up as a run of its own and hides the second name.
- **Plain-string fields:** spells in a creature's `spellcasting` lists and an
  item's `spells` become refs, with any printed qualifier in the ref's
  `note`. Gear stays as it is: its names are mundane equipment, not entries.
- **Left as plain text:** self-mentions, plurals the token can't render
  ("Ioun Stones", "Ghouls"), and names that aren't an entry's exact name
  ("Potion of Healing" for Potions of Healing). Report every replacement,
  review each in its sentence, and say in the PR what was left and why.
- A problem the pass turns up in the stage's entries (a placeholder
  summary, a merged italic run) is fixed in the same PR, in a commit of its
  own.

A new link can break a dev test that loads a few entries by file and
validates them alone (`tests/site/tables.test.ts`), and content-lane CI
doesn't run the tests. So run `npm test` before pushing a link pass too, and
if a test's fixture list no longer resolves, file the fix as a dev issue
rather than skipping the link.

## Managing SRD entries

- **Corrections** only bring an entry closer to the SRD ([Revisions](../../../docs/generation.md#revisions)). An
  instruction to change an SRD entry otherwise isn't applied; suggest a
  custom variant instead. Never change an `id` or move a file.
- **A format fix that changes how existing entries are stored** migrates
  them in its dev PR, which gets the `migration` label automatically
  ([Work lanes](../../../docs/workflow.md#work-lanes)).
- **The QA/QC review** of Milestone 7 rechecks every SRD entry: Step 6
  across the whole library, plus a look at the built site. Each problem it
  finds goes in one PR per type, one commit per kind of problem.
- **Done.** A stage is done when `npm run srd-coverage` reports no missing
  entries of its tier and its link pass has merged. Milestone 7 is done when
  every stage is done and every format-fix issue is closed.
