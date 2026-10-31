# TTRPG Content Library: v1 Specification

Oct 30, 2026 · @Reif · Supersedes the preliminary design document of the same date

## 1. Summary

A static GitHub Pages gallery displays a library of D&D 5e (SRD 5.2) content. Claude routines generate entries as JSON files in response to GitHub Issues, open one pull request per batch, and revise the batch in response to review comments. CI validates every entry against a strict schema plus rule-derived checks. Merging a pull request to `main` is the only step that publishes anything.

The site is a private tool first. The repo and Pages site are public (free plan), but nothing is promoted. Licensing, attribution, and stable URLs are correct from day one so the library can be shared later without rework.

### 1.1 Goals

- Generate content on demand or on a schedule through Claude routines, driven by GitHub Issues, with no hand-editing of files.
- Revise generated content through PR review comments; the human role is request, review, and merge.
- Browse the library in a categorized, sortable, filterable, searchable gallery with shareable URLs.
- Export any entry as JSON (native data), PNG (Discord and VTTs), or print-ready pages (PDF via the browser) in common sizes, US Letter first.
- Link entries to one another (a creature casts a spell, an item casts a spell) with validated references.

### 1.2 Non-goals for v1

- No backend, database, accounts, or user-submitted content. Data lives in the repo.
- No in-browser editing. All changes go through pull requests.
- No generated art. The schema and UI reserve room for it (§5.6).
- No ruleset other than `dnd-5e-2024`. Entries for any other ruleset fail validation until that ruleset's schema exists.
- No format translators (Foundry VTT, Open5e, etc.). The exporter interface is designed for them (§10.1).
- No offline/PWA mode, no SEO work beyond page titles and link-preview metadata.

### 1.3 Design principles

1. **Files are the database.** One JSON file per entry, reviewed as an ordinary diff.
2. **Strict rules, open organization.** Rules data (`stats`) is validated strictly and fails closed; organizational tags (`tags`) are fully open and every tag is filterable.
3. **Configuration over code.** A type registry decides what the gallery shows by default; a new type is a schema, a guideline, and a registry entry.
4. **Inputs, not outputs.** Entries store only authored choices. Anything the ruleset derives by formula or table is computed by the ruleset module, never stored (§6.1).
5. **Boring tools.** Static build, GitHub Actions, no runtime services.

## 2. Governing decisions

These were settled in the spec review and override the preliminary design wherever they differ.

| # | Topic | Decision |
|---|---|---|
| 1 | Audience and visibility | Private tool built to be shareable later. Public repo and Pages site on the free plan; no promotion. |
| 2 | v1 scope | SRD 5.2 baseline. Types: `creature`, `magic-item`, `spell`. |
| 3 | Entry model | Three zones: fixed keys, strictly validated `stats`, and open flat `tags`. Provenance in `meta`. `version` renamed to `ruleset`. |
| 4 | Validation posture | Fail closed. Unknown ruleset, type, or `stats` key fails CI. Only `tags` are open. |
| 5 | IDs | Kebab-case slug of the name, globally unique, immutable, equals the filename. |
| 6 | References | Typed refs between entries in v1, validated in CI, with computed back-references. |
| 7 | Review | Comment-driven revisions on PRs. No required approving review (you cannot approve your own PR); your merge is the approval. |
| 8 | Requests | GitHub Issues are the request queue. `config/defaults.json` fills anything a request leaves unspecified. A gap-filler runs when no requests are open. |
| 9 | Exports | PDF via print CSS for printing; PNG via DOM capture for Discord and VTTs; JSON as the native format. Exporters are pluggable modules for future translators. |
| 10 | Art | No art in v1. Schema field `image` holds a repo-relative path; the UI shows a placeholder when it is absent. |
| 11 | Derived values | Values the ruleset defines by formula or table (XP, PB, HP, attack bonuses, DCs, damage averages, save and skill bonuses, passive Perception) are never stored in entries. The ruleset module computes them; deviations are explicit `adjust` fields. |
| 12 | Styling | Plain CSS with layered design tokens, so most UI refinement is a tokens edit. Light and dark themes with a System/Light/Dark toggle. WCAG 2.2 AA, checked in CI. A style guide page for refinement (§9.6–9.8). |
| 13 | Work lanes | One repo with two enforced lanes. Content (`content/`, `assets/images/`, opened by routines) and development (everything else). Separated by branch prefix, auto-applied labels, templates, and a CI scope check; a `migration` label is required for dev changes to content (§12.4). |

### 2.1 Changes from the preliminary design

| Preliminary design | v1 spec | Why |
|---|---|---|
| Every non-fixed key is an open tag; all paths flattened into filters | `stats` (strict) and `tags` (open) are separate; only curated `stats` paths become facets | Stat blocks contain lists of objects (actions) that flatten into meaningless paths, and open rules data lets typos pass silently |
| Unknown `version` is ignored | Unknown `ruleset` fails CI | A silent skip means a merged entry can vanish with no signal |
| `id: "001"`, unique within version and type | Global slug ID | Sequential IDs collide across parallel branches and make poor URLs |
| Branch protection requires one approving review | Requires the `validate` check only | The routine opens PRs under your identity; GitHub blocks self-approval |
| Reject by deleting files or closing the PR | Comment-driven revision loop | Most feedback is "adjust this," not "discard this" |
| Routine inputs supplied per run | GitHub Issues as a queue, plus defaults and a gap-filler | Scheduled runs need direction without a human in the loop |
| PDF from a captured card image | PDF from print CSS; PNG stays image capture | Printing needs vector text and multi-page stat blocks |
| Bulk export is a later phase | Multi-entry print and JSON set export ship in v1 | The print view gets it nearly free |
| One schema file per ruleset | One `rulesets/<ruleset>/` folder holding schemas, tables, derivations, checks, and guidelines | Adding a ruleset is adding a folder; type schemas stay reviewable in isolation |
| Derived values (ability modifiers aside) stored in entries and checked by the validator | Derived values never stored; computed by the ruleset module; prose uses tokens | A stored derived value can drift from its inputs, and every generation run would redo the arithmetic |

## 3. Architecture

```
GitHub Issue (request)
        │
        ▼
Claude routine ── reads config, ruleset module, library index
        │         writes content/<ruleset>/<type>/<id>.json (inputs only)
        │         runs npm run validate until clean
        ▼
Pull request on gen/ branch (content lane, "Closes #n")
        │
        ├── validate.yml: schema + consistency checks + refs + build → job summary
        │
        ├── Review comments ──► routine revises, re-validates, pushes, replies
        │
        ▼
Merge to main ──► deploy.yml: build-index (derive) → astro build → GitHub Pages
```

### 3.1 Technology choices

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript, Node 22 LTS | One language for scripts, validator, and site |
| Package manager | npm | Lockfile committed |
| Site generator | Astro (static output) | Emits one HTML page per entry; the gallery is a client-side island |
| Island framework | Preact | Small runtime, sufficient for filters and search |
| Schema validation | Ajv, JSON Schema draft 2020-12 | Schemas are plain JSON files |
| Search | MiniSearch | Field boosting, prefix and fuzzy matching, small footprint |
| Markdown in text fields | `marked` at build time, sanitized | Limited subset (§5.5) |
| PNG capture | `html-to-image` | Fonts self-hosted so capture is faithful |
| Styling | Plain CSS: custom properties, cascade layers, nesting, container queries | No framework or preprocessor (§9.6) |
| Fonts | Alegreya, Alegreya SC, Alegreya Sans (OFL) via `@fontsource` | No external font requests; required for PNG fidelity |
| UI icons | Lucide (ISC), inlined SVG | A handful of control icons only |
| CSS lint | Stylelint | Forbids literal design values outside `tokens/` |
| Tests | Vitest; Playwright with axe-core | Unit suites and contrast checks; accessibility smoke tests on built pages |

The Pages site is served from `https://bardic-inspiration.github.io/ttrpg-library/`; Astro's `base` is `/ttrpg-library/` and every internal link goes through it.

## 4. Repository structure

```
ttrpg-library/
├── content/<ruleset>/<type>/<id>.json      entries (the data)
├── assets/images/<ruleset>/<type>/<id>.*   optional art (none in v1)
├── schemas/envelope.schema.json            fixed keys, tags, meta, image (all rulesets)
├── rulesets/<ruleset>/                     everything ruleset-specific (§6.2)
│   ├── ruleset.json                        id, label, SRD version, types
│   ├── tables.json                         rules tables (CR, sizes, skills, enums)
│   ├── derive.ts                           derived values per type
│   ├── tokens.ts                           text tokens for derived values in prose
│   ├── checks.ts                           consistency checks
│   ├── schemas/common.schema.json, <type>.schema.json
│   └── guidelines/<type>.md                generation rules per type
├── config/
│   ├── types.json                          type registry (§7)
│   ├── defaults.json                       generation defaults (§8.3)
│   ├── export.json                         page sizes, PNG settings, exporters (§10.5)
│   └── blocklist.json                      non-SRD proper nouns (§11)
├── scripts/
│   ├── validate/                           CLI, schema stage, ruleset-independent checks
│   ├── build-index.ts                      content → library.json
│   └── pr-summary.ts                       job summary for changed entries
├── site/                                   Astro project
│   └── src/
│       ├── pages/                          routes, including /styleguide/
│       ├── components/templates/           type templates and their parts
│       ├── components/gallery/             grid, cards, filters, search (Preact islands)
│       ├── exporters/                      json, png, print
│       ├── icons/                          inlined Lucide SVGs
│       └── styles/                         tokens/ and global layers (§9.6)
├── tests/                                  Vitest suites and fixture entries
├── .claude/
│   ├── settings.json, hooks/               session permissions; dependency install in cloud sessions
│   └── skills/
│       ├── generate/SKILL.md               generation (issues and gap-fill)
│       ├── revise/SKILL.md                 revisions from PR comments or a revise request
│       └── ask-me/, grill-me/              dev-session interviews: form intent, stress-test a plan
├── .github/
│   ├── workflows/validate.yml, deploy.yml, labeler.yml
│   ├── ISSUE_TEMPLATE/                     content: content-request, revise-request
│   │                                       dev: bug-report, feature-request, ui-refinement
│   ├── PULL_REQUEST_TEMPLATE/content.md, dev.md
│   ├── labeler.yml                         lane and area label rules (§12.4)
│   └── dependabot.yml
├── docs/routines.md                        canonical routine prompts and schedule
├── SPEC.md  AGENTS.md  CLAUDE.md  README.md
└── LICENSE  LICENSE-CONTENT  ATTRIBUTION.md
```

`library.json` is built in CI and git-ignored, so pull requests contain only entry files (and, in revise or dependency cases, the files they touch).

npm scripts: `validate`, `build:index`, `dev`, `build` (runs `build:index` then `astro build`), `test` (Vitest, including contrast), `check` (types, `astro check`, Stylelint), `a11y` (Playwright + axe against the built site), `snapshots` (on-demand visual captures).

## 5. Content model

### 5.1 Entry envelope

Every entry, in every ruleset, has this shape (`schemas/envelope.schema.json`):

| Key | Required | Type | Rule |
|---|---|---|---|
| `ruleset` | yes | string | Must name a folder in `rulesets/` and a ruleset in `config/types.json`. v1: `dnd-5e-2024` |
| `type` | yes | string | Single value. Must be listed in the ruleset's `ruleset.json`, with a schema file and a registry entry |
| `id` | yes | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 chars, globally unique, equals filename without `.json`, immutable after merge |
| `name` | yes | string | Display name, 1–80 chars, globally unique case-insensitively |
| `summary` | yes | string | One line, 10–160 chars, plain text. Used on cards, in PR bodies, and in link previews |
| `description` | no | string | Lore and flavor, markdown subset. Not rules text |
| `stats` | yes | object | Validated by `rulesets/<ruleset>/schemas/<type>.schema.json`. Unknown keys rejected. Inputs only; no derived values |
| `tags` | no | object | Open, flat (§5.3) |
| `image` | no | string | Repo-relative art path (§5.6) |
| `meta` | yes | object | Provenance (§5.4) |

The file path must be `content/<ruleset>/<type>/<id>.json`. Unknown top-level keys are rejected.

### 5.2 IDs and names

- The ID is the slug of the name at creation: lowercase, ASCII-folded, non-alphanumerics collapsed to `-`.
- IDs are unique across the whole library, not per type, so a reference or URL never needs disambiguation.
- An ID never changes after merge, even if `name` is later revised. A rename keeps the old ID.
- On a name or ID collision the generator picks a different name; it never appends a numeric suffix.
- The validator warns on near-duplicate names (normalized edit distance ≤ 2) so reviewers can catch "Frost Lance" vs "Frost Lances."

### 5.3 Tags

- `tags` is a flat map. Keys match `^[a-z][a-z0-9-]*$`. Values are a string, number, boolean, or array of strings.
- No nested objects. Nothing in `tags` is ever rejected for being unknown.
- Every tag key becomes a filterable path `tags.<key>` in the gallery with no configuration.
- Conventional keys (not enforced): `world`, `campaign`, `theme`, `environment`, `author`.
- String comparisons for filtering are case-insensitive; display preserves the stored case.

### 5.4 Meta (provenance)

| Key | Required | Rule |
|---|---|---|
| `meta.createdAt` | yes | ISO date (`YYYY-MM-DD`) |
| `meta.updatedAt` | no | ISO date, set on any revision |
| `meta.source.kind` | yes | `routine`, `revise`, or `manual` |
| `meta.source.issues` | no | Array of issue numbers this entry fulfilled |
| `meta.source.gapFill` | no | Gap bucket label when created by the gap-filler |

Meta is shown on the detail page in a small provenance line and is sortable (`meta.createdAt`), but it is not a tag.

### 5.5 Text fields

`description`, and the rules-text fields inside `stats` (`text`, `effect`, `higherLevels`, etc.), accept a markdown subset: paragraphs, `**bold**`, `*italic*`, bulleted and numbered lists, and line breaks. No headings, links, HTML, images, or tables. The validator rejects disallowed constructs. Rendering is sanitized. A ruleset may also define tokens that render derived values inside text (§6.4).

### 5.6 Image

- `image` is a repo-relative path matching `^assets/images/<ruleset>/<type>/<id>\.(png|jpg|webp)$`. The file must exist.
- Validation warns above 500 KB and fails above 2 MB.
- The build copies `assets/images/` into the site output.
- When `image` is absent, the gallery card and detail page render a placeholder: a 1:1 framed panel with the type's label and "Art placeholder," styled from theme variables. The placeholder appears in gallery and detail views only; PNG and print exports include art when present and omit the placeholder.
- Art committed to the repo must be something you have the rights to publish; credit for any art goes in `ATTRIBUTION.md`.

### 5.7 References

- A reference is an object `{ "ref": "<type>/<id>" }`, valid only inside `stats` at fields the schema declares as `RefOrText`.
- `RefOrText` fields accept either a ref or a plain string. Plain strings are for SRD content not in the library (for example, `"Fireball"`).
- The validator fails if a ref's target does not exist, or if its type does not match the ref's type prefix. Cross-ruleset refs are not allowed in v1.
- Deleting an entry that other entries reference fails CI until those refs are removed or replaced.
- The build computes back-references. Detail pages show forward links ("Casts: Frost Lance") and back-links ("Cast by: Cinder Witch").
- A batch may add its own dependencies (a creature plus the new spell it casts).

## 6. Rulesets and the dnd-5e-2024 schemas

The ruleset ID is `dnd-5e-2024`, aligned with SRD 5.2 (CC-BY-4.0).

### 6.1 Stored inputs, derived outputs

An entry stores only the values an author chooses. A value the ruleset defines by fixed formula or table is never stored in an entry. The ruleset module computes it at build time from the stored inputs.

- **No mismatches.** A derived value cannot disagree with its inputs, because it is never written down. That removes a whole class of errors.
- **No arithmetic in generation.** Routines write choices (ability scores, CR, hit dice count, proficiencies), not computed numbers.
- **One place per rule.** A correction to a table or formula is a one-file change in the ruleset, and every entry picks it up on the next build.

**Deviations.** Some entries legitimately depart from a formula, such as a creature with a +1 weapon. Such an entry records an explicit integer `adjust` on that value, or a `bonus` on a damage roll. The formula stays authoritative. The adjustment is visible in the diff, and every adjustment is listed as a warning in the job summary for the reviewer to confirm.

**Authored values stay stored.** Numbers the rules leave to the author are inputs, not derived values. Examples: a creature's AC, a spell's damage dice, a magic item's stated spell save DC.

### 6.2 Ruleset module (`rulesets/<ruleset>/`)

Everything specific to a ruleset lives in one folder, so adding a ruleset is adding a folder.

| File | Purpose |
|---|---|
| `ruleset.json` | ID, label, SRD version, attribution key, list of types |
| `tables.json` | Rules tables: CR → XP and PB, size → hit die, skill → ability, and the enums the schemas share |
| `derive.ts` | Pure functions, one per type: `derive(stats, tables) → derived` |
| `tokens.ts` | Text tokens that render derived values inside prose (§6.4) |
| `checks.ts` | Consistency checks a JSON schema cannot express (§6.8) |
| `schemas/common.schema.json`, `schemas/<type>.schema.json` | `stats` schemas |
| `guidelines/<type>.md` | Generation guidance (§8.6) |

The validator, the index builder, the site templates, and the exporters all import this module, so each derived value is computed in exactly one place. A ruleset or type with no formulas returns `{}` from `derive`.

**dnd-5e-2024 creature derivations.** Magic items and spells derive nothing in v1.

| Derived path | Formula |
|---|---|
| `derived.abilityMods.<ability>` | floor((score − 10) / 2) |
| `derived.pb` | CR table (Appendix A) |
| `derived.xp` | CR table |
| `derived.xpInLair` | XP of the next CR row, when `lair` is true |
| `derived.initiative.bonus` | DEX mod + (0, PB, or 2×PB for none, `proficient`, or `expertise`) + `adjust` |
| `derived.initiative.score` | 10 + initiative bonus |
| `derived.hp.die` | Size table: Tiny d4, Small d6, Medium d8, Large d10, Huge d12, Gargantuan d20 (first listed size) |
| `derived.hp.modifier` | `hitDice` × CON mod |
| `derived.hp.formula` | `<hitDice>d<die> + <modifier>` (modifier omitted when 0) |
| `derived.hp.average` | floor(`hitDice` × (die + 1) / 2) + modifier, minimum 1 |
| `derived.saves.<ability>` | Mod, + PB when listed in `saveProficiencies` |
| `derived.skills.<skill>` | Mod of the skill's ability + PB (`proficient`) or 2×PB (`expertise`) |
| `derived.passivePerception` | 10 + Perception bonus if the skill is listed, else 10 + WIS mod |
| `derived.<actionList>[i].attackBonus` | PB + mod of `ability` + `adjust` |
| `derived.<actionList>[i].saveDc` | 8 + PB + mod of `ability` + `adjust` |
| `derived.<actionList>[i].damage[j]` | `modifier` = mod of `ability` (if set) + `bonus`; `average` = floor(dice average) + modifier; `display` such as `6 (1d8 + 2)` |
| `derived.spellcasting.dc` | 8 + PB + mod + `adjust` |
| `derived.spellcasting.attackBonus` | PB + mod + `adjust` |

`<actionList>` is `traits`, `actions`, `bonusActions`, `reactions`, or `legendaryActions.items`.

### 6.3 Shared definitions (`schemas/common.schema.json`)

| Def | Shape |
|---|---|
| `Ability` | `str`, `dex`, `con`, `int`, `wis`, `cha` |
| `Dice` | String `^\d+d(4|6|8|10|12|20|100)$`, for example `2d6`. No modifier; modifiers come from `ability` and `bonus` |
| `Damage` | `{ dice: Dice, ability?: Ability, bonus?: int, type: DamageType }` |
| `Proficiency` | `proficient`, `expertise` |
| `Adjust` | Non-zero integer |
| `DamageType` | `acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder` |
| `Condition` | `blinded`, `charmed`, `deafened`, `exhaustion`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious` |
| `Ref` | `{ ref: string }` matching `^(creature|magic-item|spell)/[a-z0-9-]+$` |
| `RefOrText` | `Ref` or non-empty string |
| `Text` | Markdown-subset string (§5.5), which may contain tokens where the ruleset allows them (§6.4) |

### 6.4 Text tokens

Creature prose (`text`, `onHit`, `onFailure`, `onSuccess`, `spellcasting.note`, `legendaryActions.intro`) may show a derived value only through a token. Tokens are rendered by `tokens.ts` from the same derivations as the stat block.

| Token | Renders | Example output |
|---|---|---|
| `{mod:<ability>}` | Ability modifier | `+2` |
| `{pb}` | Proficiency bonus | `+2` |
| `{atk:<ability>[:<adjust>]}` | PB + modifier (+ adjust) | `+4` |
| `{dc:<ability>[:<adjust>]}` | 8 + PB + modifier (+ adjust) | `DC 12` |
| `{dmg:<dice>[+<ability>][:<type>]}` | Average, dice, and type | `7 (2d6) Fire damage` |

- An unknown token, ability, or damage type is a validation error.
- A literal number that looks derived in creature prose is a validation error, and the message names the token to use instead. The patterns caught are `DC <n>`, `+<n> to hit`, and `<n> (<dice>)`.
- Spell and magic-item text is exempt, because its numbers are authored. Item text must still not restate `saveDc` or `attackBonus`, since the template renders them from the structured fields (warning).

### 6.5 Creature (`schemas/creature.schema.json`)

Field names are the JSON keys under `stats`. Unless marked optional, a field is required.

| Field | Shape | Notes |
|---|---|---|
| `size` | array of `tiny`…`gargantuan`, 1–2 items | Two values for "Medium or Small"; the first sets the hit die |
| `creatureType` | enum of the 14 SRD creature types | `aberration`, `beast`, `celestial`, `construct`, `dragon`, `elemental`, `fey`, `fiend`, `giant`, `humanoid`, `monstrosity`, `ooze`, `plant`, `undead` |
| `descriptors` | optional array of strings | Parenthetical tags such as `"Wizard"`; must pass the blocklist |
| `alignment` | string | Free text from the SRD alignment set, plus `"unaligned"` and `"any alignment"` |
| `ac` | `{ value: int 1–30, note?: string }` | Authored; `note` such as `"natural armor"` |
| `initiative` | optional `{ proficiency?: Proficiency, adjust?: Adjust }` | Omit for a plain DEX-based initiative |
| `hitDice` | int 1–99 | Die, modifier, formula, and average are derived |
| `speed` | `{ walk: int, fly?, swim?, climb?, burrow?: int, hover?: bool }` | Feet; multiples of 5 |
| `abilities` | `{ str…cha: int 1–30 }` | |
| `saveProficiencies` | optional array of `Ability` | |
| `skills` | optional `{ <skill>: Proficiency }` | Keys from the 18 SRD skills in kebab-case |
| `vulnerabilities`, `resistances` | optional arrays of `DamageType` or string | String for qualified entries |
| `immunities` | optional `{ damage?: [...], conditions?: [Condition] }` | |
| `gear` | optional array of `RefOrText` | Items the creature carries |
| `senses` | optional `{ darkvision?, blindsight?, tremorsense?, truesight?: int }` | Passive Perception is derived |
| `languages` | `{ list: [string], telepathy?: int, note?: string }` | Empty list displays as "None" |
| `cr` | number: `0`, `0.125`, `0.25`, `0.5`, or `1`–`30` | Displayed as fractions. XP and PB are derived |
| `lair` | optional bool | Adds the derived "in lair" XP |
| `traits`, `actions`, `bonusActions`, `reactions` | arrays of `Action` (`actions` required, others optional) | |
| `legendaryActions` | optional `{ uses: int, usesInLair?: int, intro?: Text, items: [Action] }` | |
| `spellcasting` | optional `{ ability: Ability, adjust?: Adjust, includeAttack?: bool, atWill?: [RefOrText], perDay?: { "1"…"3": [RefOrText] }, note?: Text }` | Rendered as the 5.2 "Spellcasting" action. `includeAttack` shows the derived spell attack bonus |

**Action**

| Field | Shape | Applies to | Notes |
|---|---|---|---|
| `name` | string | all | |
| `kind` | `melee-attack`, `ranged-attack`, `melee-or-ranged-attack`, `save`, `other` | all | |
| `ability` | `Ability` | attack, save | The attack ability, or the ability the save DC is based on |
| `adjust` | optional `Adjust` | attack, save | Applied to the attack bonus or DC |
| `reach` | int | melee attacks | Feet |
| `range` | `{ normal: int, long?: int }` | ranged attacks | Feet |
| `save` | `{ ability: Ability, targets: string }` | save | `targets` such as `"each creature in a 15-foot Cone"` |
| `damage` | optional array of `Damage` | attack, save | The first is the primary damage; the rest render as "plus" riders |
| `onHit` | optional `Text` | attack | Prose after the damage |
| `onFailure`, `onSuccess` | optional `Text` | save | Prose after the failure damage, and the success line |
| `text` | `Text` | other (required); not allowed on attack and save | Full prose; derived values only through tokens |
| `recharge` | optional string | all | `"5-6"`, `"6"`, `"short-or-long-rest"`, `"long-rest"` |
| `uses` | optional string | all | `"3/day"` |

Attack and save lines are generated in 5.2 form from the structured fields. Example output: `*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage.` and `*Dexterity Saving Throw:* DC 12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage. *Success:* Half damage.` Kind-specific requirements (`ability` and `reach` for melee attacks, `save` for saves, `text` only on `other`) are enforced in the schema with `if`/`then`.

### 6.6 Magic item (`schemas/magic-item.schema.json`)

| Field | Shape | Notes |
|---|---|---|
| `category` | `armor`, `potion`, `ring`, `rod`, `scroll`, `staff`, `wand`, `weapon`, `wondrous-item` | |
| `baseItem` | optional string | Required for `armor` and `weapon` (for example `"Longsword"`, `"any medium armor"`) |
| `rarity` | `common`, `uncommon`, `rare`, `very-rare`, `legendary`, `artifact`, `varies` | |
| `attunement` | `{ required: bool, requirement?: string }` | `requirement` such as `"by a spellcaster"` |
| `charges` | optional `{ max: int, recharge: string, depletion?: Text }` | |
| `spells` | optional array of `{ spell: RefOrText, chargeCost?: int, saveDc?: int, attackBonus?: int }` | Authored values; rendered as a spell list by the template |
| `cursed` | optional bool | |
| `effect` | `Text` | The rules text as printed |

### 6.7 Spell (`schemas/spell.schema.json`)

| Field | Shape | Notes |
|---|---|---|
| `level` | int 0–9 | 0 is a cantrip |
| `school` | `abjuration`, `conjuration`, `divination`, `enchantment`, `evocation`, `illusion`, `necromancy`, `transmutation` | |
| `classes` | array, ≥1, of `bard`, `cleric`, `druid`, `paladin`, `ranger`, `sorcerer`, `warlock`, `wizard` | |
| `castingTime` | `{ amount: int, unit: action|bonus-action|reaction|minute|hour, trigger?: string }` | `trigger` required for reactions |
| `ritual` | bool | |
| `range` | `{ kind: self|touch|distance|sight|unlimited|special, feet?: int, area?: { shape: cone|cube|cylinder|emanation|line|sphere, size: int } }` | |
| `components` | `{ v: bool, s: bool, m?: { text: string, costGp?: number, consumed?: bool } }` | |
| `duration` | `{ kind: instantaneous|timed|until-dispelled|special, amount?: int, unit?: round|minute|hour|day, concentration: bool }` | |
| `effect` | `Text` | |
| `higherLevels` | optional `Text` | Leveled spells only ("Using a Higher-Level Spell Slot") |
| `cantripUpgrade` | optional `Text` | Cantrips only |

### 6.8 Consistency checks

These run after schema validation, from the ruleset's `checks.ts` plus the ruleset-independent checks. **Errors** fail CI. **Warnings** appear in local output and the job summary but do not block. Derived values are not checked, because they are never stored.

All types:

| Check | Level |
|---|---|
| File path matches `ruleset`, `type`, `id` | error |
| ID unique across library; name unique (case-insensitive) | error |
| Near-duplicate names | warning |
| Every ref resolves and its type matches | error |
| Text fields use only the markdown subset | error |
| Blocklist match in any text-bearing field (§11) | error |
| `image` path valid and file exists; size limits | error / warning |

Creature:

| Check | Level |
|---|---|
| Every token is known and well-formed | error |
| No literal derived numbers in prose (§6.4) | error |
| Speeds are multiples of 5 | error |
| Any `adjust`, damage `bonus`, or token adjustment (listed so the reviewer confirms the deviation) | warning |
| Derived attack bonus above +17 or save DC above 30 | warning |

Magic item:

| Check | Level |
|---|---|
| `baseItem` present for `armor` and `weapon` | error |
| `attunement.requirement` only when `required` is true | error |
| `spells[].chargeCost` only when `charges` is present | error |
| `effect` restates a `saveDc` or `attackBonus` value | warning |

Spell:

| Check | Level |
|---|---|
| `duration.concentration` true only when `duration.kind` is `timed` | error |
| `timed` duration has `amount` and `unit` | error |
| `range.kind` `distance` has `feet` | error |
| `components.m.consumed` true requires `costGp` | error |
| `higherLevels` only on level ≥ 1; `cantripUpgrade` only on level 0 | error |
| `castingTime.trigger` present iff unit is `reaction` | error |
| Cantrip marked `ritual` | warning |

Balance (hit points, damage per round, and save DCs for a given CR, item rarity versus power, spell damage for a given level) is judged in review against targets written in the guideline files. CI does not enforce it. The PR summary shows each creature's derived HP, AC, attack bonuses, DCs, and average damage per action, so balance review needs no arithmetic either.

### 6.9 Example entries

`content/dnd-5e-2024/creature/cinder-hound.json`

```json
{
  "ruleset": "dnd-5e-2024",
  "type": "creature",
  "id": "cinder-hound",
  "name": "Cinder Hound",
  "summary": "A soot-black hunting hound that exhales a cone of embers and tracks prey by the smell of smoke.",
  "description": "Bred in the forges of fire-touched cults, cinder hounds leave scorched paw prints that smolder for an hour.",
  "stats": {
    "size": ["medium"],
    "creatureType": "monstrosity",
    "alignment": "unaligned",
    "ac": { "value": 13, "note": "natural armor" },
    "hitDice": 5,
    "speed": { "walk": 40 },
    "abilities": { "str": 15, "dex": 14, "con": 14, "int": 4, "wis": 12, "cha": 6 },
    "skills": { "perception": "proficient", "stealth": "proficient" },
    "immunities": { "damage": ["fire"] },
    "senses": { "darkvision": 60 },
    "languages": { "list": [] },
    "cr": 2,
    "traits": [
      {
        "name": "Smoldering Hide",
        "kind": "other",
        "text": "A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes {dmg:1d4:fire}."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "kind": "melee-attack",
        "ability": "str",
        "reach": 5,
        "damage": [
          { "dice": "1d8", "ability": "str", "type": "piercing" },
          { "dice": "1d6", "type": "fire" }
        ]
      },
      {
        "name": "Ember Breath",
        "kind": "save",
        "ability": "con",
        "save": { "ability": "dex", "targets": "each creature in a 15-foot Cone" },
        "damage": [{ "dice": "3d6", "type": "fire" }],
        "onSuccess": "Half damage.",
        "recharge": "5-6"
      }
    ]
  },
  "tags": { "theme": "fire", "environment": ["underdark", "mountains"] },
  "meta": { "createdAt": "2026-11-02", "source": { "kind": "routine", "issues": [1] } }
}
```

Rendered from the stored inputs plus the ruleset derivations:

- **Initiative** +2 (12) · **HP** 32 (5d8 + 10) · **Skills** Perception +3, Stealth +4 · **Senses** Darkvision 60 ft., Passive Perception 13 · **CR** 2 (XP 450; PB +2)
- **Smoldering Hide.** A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes 2 (1d4) Fire damage.
- **Bite.** *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage.
- **Ember Breath (Recharge 5–6).** *Dexterity Saving Throw:* DC 12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage. *Success:* Half damage.

`content/dnd-5e-2024/spell/frost-lance.json`

```json
{
  "ruleset": "dnd-5e-2024",
  "type": "spell",
  "id": "frost-lance",
  "name": "Frost Lance",
  "summary": "A spear of ice that pierces a target and slows its movement.",
  "stats": {
    "level": 1,
    "school": "evocation",
    "classes": ["sorcerer", "wizard"],
    "castingTime": { "amount": 1, "unit": "action" },
    "ritual": false,
    "range": { "kind": "distance", "feet": 60 },
    "components": { "v": true, "s": true, "m": { "text": "a sliver of ice" } },
    "duration": { "kind": "instantaneous", "concentration": false },
    "effect": "Make a ranged spell attack against a creature within range. On a hit, the target takes 3d8 Cold damage, and its Speed is reduced by 10 feet until the start of your next turn.",
    "higherLevels": "The damage increases by 1d8 for each spell slot level above 1."
  },
  "tags": { "theme": "ice" },
  "meta": { "createdAt": "2026-11-02", "source": { "kind": "routine", "issues": [2] } }
}
```

`content/dnd-5e-2024/magic-item/wand-of-frost-lances.json`

```json
{
  "ruleset": "dnd-5e-2024",
  "type": "magic-item",
  "id": "wand-of-frost-lances",
  "name": "Wand of Frost Lances",
  "summary": "A rime-crusted wand that hurls lances of ice.",
  "stats": {
    "category": "wand",
    "rarity": "uncommon",
    "attunement": { "required": true, "requirement": "by a spellcaster" },
    "charges": { "max": 7, "recharge": "1d6 + 1 daily at dawn", "depletion": "If you expend the last charge, roll 1d20. On a 1, the wand melts away." },
    "spells": [{ "spell": { "ref": "spell/frost-lance" }, "chargeCost": 1, "attackBonus": 5 }],
    "effect": "While holding this wand, you can expend 1 of its charges to cast *Frost Lance* from it."
  },
  "tags": { "theme": "ice" },
  "meta": { "createdAt": "2026-11-02", "source": { "kind": "routine", "issues": [2] } }
}
```

## 7. Type registry (`config/types.json`)

Display and generation defaults only. Validation never reads it except to confirm that a ruleset and type are registered.

```json
{
  "dnd-5e-2024": {
    "label": "D&D 5e (SRD 5.2)",
    "attribution": "srd-5.2",
    "types": {
      "creature": {
        "label": "Creature",
        "plural": "Creatures",
        "template": "creature-stat-block",
        "guideline": "rulesets/dnd-5e-2024/guidelines/creature.md",
        "facets": [
          { "path": "stats.cr", "label": "CR", "kind": "range", "format": "cr" },
          { "path": "stats.size", "label": "Size", "kind": "enum" },
          { "path": "stats.creatureType", "label": "Creature type", "kind": "enum" },
          { "path": "stats.abilities.str", "label": "STR", "kind": "range" },
          { "path": "derived.hp.average", "label": "HP", "kind": "range" },
          { "path": "derived.xp", "label": "XP", "kind": "range" }
        ],
        "cardFields": ["stats.cr", "stats.size", "stats.creatureType"],
        "defaultSort": "stats.cr:asc",
        "defaultFilters": ["stats.cr", "stats.creatureType", "tags.theme"],
        "summaryField": "stats.cr",
        "gapBuckets": { "path": "stats.cr", "bins": [[0, 1], [2, 4], [5, 10], [11, 16], [17, 30]] }
      }
    }
  }
}
```

| Key | Purpose |
|---|---|
| `facets` | The `stats.*` and `derived.*` paths lifted into `library.json` and offered as filters and sorts. `kind` is `range` (numbers) or `enum` (strings, string arrays, booleans). `format` is an optional display formatter (`cr`, `spell-level`, `rarity`) |
| `cardFields` | Facets shown on gallery cards |
| `defaultSort` | `<path>:<asc|desc>` |
| `defaultFilters` | Filters shown expanded by default; every other facet and tag stays reachable through "Add filter" |
| `summaryField` | The key stat shown in PR bodies and job summaries (CR, rarity, spell level) |
| `template` | Card and print component; a missing template falls back to the generic layout |
| `gapBuckets` | How the gap-filler partitions the type (one path with numeric bins, or `enum` for categorical paths) |

v1 registry entries:

| Type | Facets | Card fields | Default sort | Gap buckets |
|---|---|---|---|---|
| `creature` | CR, size, creature type, six ability scores, AC, HP (derived), XP (derived) | CR, size, creature type | CR ascending | CR bins as above |
| `magic-item` | rarity, category, attunement required, cursed | rarity, category, attunement | rarity ascending (ordered enum) | rarity |
| `spell` | level, school, classes, concentration, ritual, casting-time unit | level, school, concentration/ritual badges | level ascending | level × school |

Ordered enums (rarity, size) declare their order in the facet as `"order": [...]` so sorting is semantic, not alphabetical.

## 8. Generation and revision

### 8.1 Requests as GitHub Issues

**Content request** (`.github/ISSUE_TEMPLATE/content-request.yml`, adds label `request`):

| Field | Kind | Required |
|---|---|---|
| Type | dropdown: creature, magic-item, spell | yes |
| Count | number, 1–10 | no (defaults) |
| Brief | textarea: theme, constraints, CR/level/rarity range, anything else | yes |
| Tags | textarea, one `key: value` per line (comma-separated for lists) | no |
| Ruleset | text | no (defaults) |

**Revise request** (`revise-request.yml`, adds label `revise`): entry IDs and an instruction, for changes to already-merged entries.

Free-form issues with the `request` label are also accepted; the routine interprets them against defaults.

**Labels**

| Label | Meaning |
|---|---|
| `request` | Open content request |
| `revise` | Open revision request for merged entries |
| `priority:high` | Picked before others |
| `in-progress` | Claimed by a routine run |
| `needs-info` | Routine asked a question in the issue; skipped until you answer and remove the label |

Lane and area labels for PRs (`content`, `dev`, `ui`, `ruleset`, `generation`, `ci`, `migration`) and the dev-lane issue labels (`bug`, `feature`, `ui`) are defined in §12.4. Issue templates set blank issues off (`config.yml`), so every issue starts in a lane.

### 8.2 Routine run order

Every run, scheduled or manual, follows the same sequence so that review feedback is never starved by new work.

1. **Sync.** Fetch `main`; run `npm ci` and `npm run build:index` to get the current library.
2. **Revisions first.** For each open PR on a `gen/` or `revise/` branch, find owner comments not yet handled (§8.5) and invoke the `revise` skill. Push, reply, continue.
3. **Revise requests.** Take open `revise` issues; each becomes a small PR.
4. **Content requests.** Pick open `request` issues without `in-progress` or `needs-info`, `priority:high` first, then oldest. Group issues into one batch while the total count is ≤ `maxBatch`. Claim each with the `in-progress` label and a short comment.
5. **Gap-fill.** If no requests were picked and `gapFill.enabled`, choose the type and bucket with the fewest entries (ties go to the type with the fewest entries overall) and generate `gapFill.count` entries for it.
6. **Ambiguity.** If a request cannot be fulfilled as written (contradictory constraints, unknown type), comment a single question on the issue, add `needs-info`, remove `in-progress`, and move on.
7. **Stale claims.** An `in-progress` issue with no open linked PR after 24 hours is treated as unclaimed.

A manual run may name specific issues, or pass an inline request (type, count, brief, tags) that is handled as if it were an issue but without one.

### 8.3 Defaults (`config/defaults.json`)

```json
{
  "ruleset": "dnd-5e-2024",
  "count": 5,
  "maxBatch": 10,
  "tags": {},
  "gapFill": { "enabled": true, "count": 3 },
  "validateRetries": 3
}
```

Defaults are applied only to fields the request leaves unspecified. Request tags are merged over default tags.

### 8.4 The `generate` skill

`.claude/skills/generate/SKILL.md` is generic across types and rulesets. Inputs: ruleset, type, count, brief, tags, issue numbers (or gap bucket). Steps:

1. Read `config/types.json`, `config/defaults.json`, the ruleset module (`rulesets/<ruleset>/`: the type's schema, `tables.json`, tokens, guideline), `config/blocklist.json`, and `library.json`.
2. List existing names and IDs for collision avoidance, and existing entries matching the brief's theme to avoid near-duplicates in concept.
3. Write entries, including any new dependencies the brief implies (a creature's signature spell). Prefer references to existing library entries over plain text when a matching entry exists. Write inputs only: never write a value the ruleset derives, use tokens for derived values in prose, and use `adjust` only for a deliberate deviation, explained in the PR body.
4. Set `meta.createdAt`, `meta.source.kind: "routine"`, and `meta.source.issues`; apply request and default tags.
5. Run `npm run validate`. Fix and retry up to `validateRetries` times. If still failing, comment the errors on the issue, remove `in-progress`, and stop without opening a PR.
6. Branch `gen/<issue-numbers-or-gap>-<YYYYMMDD>` (for example `gen/12-14-20261102`, `gen/gap-spell-20261102`), commit with message `Add <n> <type> entries`, push, open the PR.

**PR conventions**

- Title: `Add <n> <type> entries` (mixed batches: `Add <n> entries`).
- Lane label `content` is applied automatically from the branch prefix (§12.4); the body follows `.github/PULL_REQUEST_TEMPLATE/content.md`.
- Body: a table of each entry (name, type, the type's `summaryField` value, summary); any validator warnings, including every formula adjustment with its reason; one `Closes #n` line per fulfilled issue; for gap-fill runs, the bucket that was filled.

### 8.5 Comment-driven revisions (the `revise` skill)

- **Input.** Owner comments on a routine PR (`gen/` or `revise/` branch): inline review comments on a file or line, or general PR comments.
- **Instructions.** Free text applies to the commented file, or to the whole batch for general comments. `drop <id>` removes an entry (and fails validation if something references it, in which case the routine asks how to proceed). `regenerate <id>` replaces an entry with a fresh one under the same brief.
- **Handled marker.** The routine posts under your identity, so it marks its own replies with a trailing `<!-- routine:handled -->` comment. An owner comment is pending if no reply with that marker follows it in its thread (inline) or after it (general).
- **Action.** Edit only the affected files, set `meta.updatedAt`, re-run validation, push one commit per round (`Revise <ids>: <short reason>`), reply to each handled comment with what changed, and resolve inline threads it addressed.
- **Post-merge revisions.** A `revise` issue produces a PR on branch `revise/<issue>-<YYYYMMDD>` with `meta.source.kind` left as-is and `meta.updatedAt` set. IDs never change.
- **Delivery.** The run-order sweep in §8.2 step 2 is the guaranteed path, so a comment is handled by the next run at the latest. A routine session may also subscribe to the PR it opened for faster turnaround where the platform supports it; correctness never depends on that.

### 8.6 Guidelines

Each `rulesets/dnd-5e-2024/guidelines/<type>.md` contains:

- Tone and voice, with one short exemplar.
- Naming conventions: evocative and original; no real-world trademarks; no non-SRD proper nouns; avoid near-collisions with SRD names.
- Balance targets as our own tables (for creatures, by CR: AC, HP, attack bonus, damage per round, save DC; for items, power expectations by rarity; for spells, damage by level and area). For creatures these are met by choosing inputs (ability scores, hit dice, damage dice), since the derived numbers follow from them.
- Prose style for `text`, `onHit`, `onFailure`, `onSuccess`, and `effect`, matching 5.2 phrasing, with derived numbers written as tokens. Attack and save lines are generated, so they are never written as prose.
- When to create a dependency entry versus using plain text for an SRD reference.

### 8.7 Schedule

Recorded in `docs/routines.md` along with the canonical routine prompts:

- **Scheduled routine:** weekly, Monday morning local time, one run. Default batch 5, never above `maxBatch` (10).
- **On-demand routine:** same prompt, with optional issue numbers or an inline request.

## 9. Gallery site

### 9.1 Build

1. `scripts/build-index.ts` reads every file under `content/`, runs the validator (the build fails if validation fails), computes each entry's `derived` values with its ruleset module, resolves refs, and computes back-references.
2. It writes `site/public/library.json` (the index) and copies each entry's raw JSON to `site/public/data/<ruleset>/<type>/<id>.json` for export.
3. Astro builds static pages, reading the full entries and their derived values at build time.

**`library.json` record**

```json
{
  "id": "cinder-hound",
  "ruleset": "dnd-5e-2024",
  "type": "creature",
  "name": "Cinder Hound",
  "summary": "…",
  "url": "/ttrpg-library/dnd-5e-2024/creature/cinder-hound/",
  "image": null,
  "facets": { "stats.cr": 2, "stats.size": ["medium"], "stats.creatureType": "monstrosity", "derived.hp.average": 32, "derived.xp": 450 },
  "tags": { "theme": "fire", "environment": ["underdark", "mountains"] },
  "createdAt": "2026-11-02",
  "refs": [],
  "refBy": [],
  "search": "bite ember breath …"
}
```

`search` holds action, trait, and spell names plus `description` and rules text with markup stripped. The index stays lean; full entries are fetched only for export.

### 9.2 Pages and navigation

| Route | Content |
|---|---|
| `/` | All entries, with a type filter and the latest additions first |
| `/<ruleset>/` | All entries in the ruleset |
| `/<ruleset>/<type>/` | Gallery for one type with that type's default facets and sort |
| `/<ruleset>/<type>/<id>/` | Detail page |
| `/print/` | Print view for one or many entries (§10.4) |
| `/about/` | What the library is, SRD attribution, licenses |

The header carries ruleset and type navigation. The footer carries the SRD 5.2 attribution statement on every page.

### 9.3 Gallery behavior

- **Card grid.** Each card shows art or the placeholder, name, type badge, `cardFields`, and summary. Responsive: one column on phones, up to four on wide screens.
- **Filters.** The registry's `defaultFilters` are expanded. "Add filter" lists every facet for the current type(s) plus every tag key present in the current result set. Range facets show min/max inputs; enum facets and tags show multi-select chips with counts. Values within a facet combine as OR; facets combine as AND.
- **Sort.** Name, created date, or any facet, ascending or descending. Ordered enums sort by declared order. Entries missing the sort value go last.
- **Search.** MiniSearch over `name` (boost 3), `summary` (2), tag values (1.5), and `search` (1), with prefix and light fuzzy matching. Search narrows within active filters. Results order by relevance when a query is present, otherwise by the active sort.
- **URL state.** Query, sort, and filters live in the query string, so any view can be bookmarked or linked: `?q=frost&sort=stats.cr:desc&f.stats.creatureType=dragon,fiend&f.stats.cr=2..8&f.tags.theme=fire`. Ranges use `min..max` (either side may be empty). Keys and values are URL-encoded. Unknown parameters are ignored.
- **Selection.** Cards have a checkbox. Selected entries (or the whole filtered set) can be sent to the print view or exported as a JSON array.
- **Scale.** The index is loaded once and filtered in memory. This is sized for a few thousand entries; past roughly 2,000 entries, revisit index size and prebuilt search indexes.

### 9.4 Detail page

- Art or placeholder, name, type, summary.
- The full stat block or card rendered by the type's template, matching 5.2 layout conventions.
- `description` as lore, visually distinct from rules text.
- Forward refs and back-refs as links.
- Tags as chips; clicking a chip opens the type gallery filtered by that tag.
- Provenance line: created and updated dates, source issues linked to GitHub.
- Export controls: Download JSON, Download PNG, Print (with page size selector).
- `<title>` and Open Graph tags (name, summary, art when present).

### 9.5 Templates

- One component per type template: `creature-stat-block`, `magic-item-card`, `spell-card`, and a `generic` fallback that renders fixed keys, `stats` as a definition list, and tags.
- Each template is composed of small parts with one job each, for example `StatBlockHeader`, `AbilityTable`, `PropertyLine`, `ActionList`, `ArtFrame`. Refining one part never means editing a large file.
- Templates receive the entry and its `derived` values and render tokens through the ruleset's `tokens.ts`; they never compute rules values themselves.
- The same component renders in gallery detail, PNG capture, and print, with a `mode` prop (`screen`, `capture`, `print`) that adjusts only spacing, columns, and interactive elements.
- Markup is semantic so that styling never fights structure. The entry name is a heading, section labels (Actions, Reactions) are subheadings, property lines and ability scores are definition lists or tables, and action names are inline headings.

### 9.6 Styling system

The styling system is built so that the v1 UI can be refined quickly and safely during testing. Most visual changes are edits to one tokens file. Every rendered state can be seen on one page. Tests catch accessibility regressions.

**Approach**

- Plain modern CSS: custom properties, nesting, cascade layers, and container queries. No CSS framework, no preprocessor, no CSS-in-JS. Target: the last two versions of evergreen browsers.
- Component styles live in each Astro or Preact component's scoped `<style>` block, next to the markup they style.
- Global styles are a small, fixed set of files, loaded in this layer order:

  ```css
  @layer reset, tokens, base, layout, components, utilities, overrides;
  ```

  Component styles go in `components`. The `overrides` layer is an empty file, reserved for quick experiments during refinement, which always win without specificity fights.

**Files (`site/src/styles/`)**

| File | Contents | Edit it to change |
|---|---|---|
| `tokens/primitives.css` | Raw values: the palette, font families, type scale, spacing scale, radii, shadows, durations | The palette or the scales themselves |
| `tokens/semantic.css` | Meanings mapped to primitives, per theme: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--color-control-border`, `--color-focus`, `--font-heading`, `--font-body`, `--font-ui`, `--space-card`, `--radius-card`… | What a role looks like in light or dark |
| `tokens/components.css` | Per-component knobs that default to semantic tokens: `--statblock-rule-color`, `--statblock-heading-font`, `--card-min-width`, `--grid-gap`, `--art-aspect`… | One component's look without touching its code |
| `tokens/content.css` | Data-driven accents: one variable per entry type and per item rarity (`--accent-creature`, `--rarity-legendary`…) | Type and rarity colors |
| `tokens/print.css` | Print and capture sizing per page size: `[data-page-size="card-4x6"] { --print-font-size: 8pt; … }` | Print density per page size |
| `reset.css`, `base.css`, `layout.css`, `utilities.css`, `overrides.css` | Element defaults, page shell and grid, a handful of utilities, the experiment layer | Rarely |

**Rules that keep editing easy**

- Components use only semantic, component, and content tokens. They never use primitives or literal values. A color, font, size, spacing, radius, shadow, or duration written as a literal anywhere outside `tokens/` fails the lint. Stylelint enforces this in `npm run check`, with an allowlist for `0`, `100%`, `auto`, and similar.
- Accents are driven by data attributes, not by per-type CSS. Cards and stat blocks carry `data-type="creature"` (and `data-rarity="rare"` for items), and one rule maps each attribute to `--accent`. A new type needs one variable in `content.css`; without one, it falls back to `--color-accent`.
- Class names are stable, readable, and component-scoped (`.statblock__header`, `.card__summary`), so a quick experiment in `overrides.css` can target anything.
- Layout values are tokens as well: grid minimum card width, gaps, stat-block column gap, and container-query breakpoints. Density and layout can be tuned without touching component code.

**Visual direction (starting point for refinement)**

- **Feel:** a clean reference book. Warm paper surfaces, dark ink text, thin colored rule lines between stat-block sections, small-caps headings. The design is original: it does not reproduce official book art, textures, ornaments, or logos, which also keeps it safe to make public later.
- **Typefaces:** the Alegreya superfamily, SIL Open Font License, self-hosted via `@fontsource`. Alegreya SC for headings and stat-block labels, Alegreya for body and rules text, Alegreya Sans for UI controls, filters, and badges. One family keeps the look coherent and the font payload small. Only the weights used (400, 500, 700, and 400 italic) are loaded.
- **Type scale:** a modular scale (ratio 1.2) as `--font-size--1` through `--font-size-5`. Screen sizes are fluid with `clamp()`; print uses fixed point sizes from `print.css`.
- **Starting palette:** values below, all of which pass the contrast pairs in §9.7.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#f6f0e1` | `#161412` |
| `--color-surface` | `#fffaf0` | `#211e1a` |
| `--color-text` | `#1f1a14` | `#ede5d5` |
| `--color-text-muted` | `#5b5246` | `#b3a892` |
| `--color-accent` | `#8a1c1c` | `#e8806a` |
| `--color-border` (decorative) | `#b9ab90` | `#4a4238` |
| `--color-control-border` | `#857865` | `#8a7f6e` |
| `--color-focus` | `#1d4ed8` | `#93b4ff` |
| `--accent-creature` | `#8a1c1c` | `#e8806a` |
| `--accent-magic-item` | `#6b3fa0` | `#c4a3f0` |
| `--accent-spell` | `#1f5f8b` | `#7fb8e0` |
| `--rarity-common` / `uncommon` / `rare` | `#5b5246` / `#2f6b2f` / `#1f5f8b` | `#b3a892` / `#8fcf8f` / `#7fb8e0` |
| `--rarity-very-rare` / `legendary` / `artifact` | `#6b3fa0` / `#9a5200` / `#8a1c1c` | `#c4a3f0` / `#f0b060` / `#e8806a` |

- **Icons:** a few UI icons (search, filter, sort, theme, download, print, close) from Lucide (ISC license), inlined as SVG components in `site/src/icons/` and colored with `currentColor`. Lucide's license is credited in `ATTRIBUTION.md`. Entry types have no icons in v1; the art placeholder carries the type label.

**Themes**

- Light and dark are sets of semantic tokens in `semantic.css`, under `:root[data-theme="light"]` and `:root[data-theme="dark"]`, plus a `prefers-color-scheme` block for the system default.
- The header has a three-way toggle: System, Light, Dark. The choice is stored in `localStorage`, with reads and writes wrapped in try/catch so the toggle degrades to System. A tiny inline script in `<head>` sets `data-theme` before first paint, so the page never flashes the wrong theme.
- Print and PNG capture always render with the light tokens, whatever the active theme.
- A further theme (for example, high contrast) is one more token block in `semantic.css` plus an option in the toggle; no component changes.

### 9.7 Accessibility

Target: WCAG 2.2 AA.

- **Contrast.** `tests/contrast.test.ts` parses `semantic.css` and `content.css` for both themes and checks declared pairs: text, muted text, accent, every type and rarity color on `--color-bg` and `--color-surface` at ≥ 4.5:1; `--color-control-border` and `--color-focus` at ≥ 3:1. Changing a color and running `npm test` shows immediately whether it still passes.
- **Color is never the only signal.** Rarity, type, and concentration/ritual badges always carry a text label.
- **Keyboard.** Every control (filters, chips, sort, search, selection, export, theme toggle) is reachable and operable by keyboard, in visual order. Focus is always visible through a shared `--focus-ring` token (2 px outline in `--color-focus` with offset). Escape closes popovers.
- **Semantics.** The gallery result count is announced through a polite live region when filters change. Filter groups use `fieldset` and `legend`. Art images take alt text from the entry name; the placeholder is decorative and hidden from assistive technology.
- **Motion.** Transitions use duration tokens, all of which become `0ms` under `prefers-reduced-motion: reduce`.
- **Zoom and reflow.** Layouts work at 320 CSS px wide and at 200% zoom without horizontal scrolling.
- **Automated check.** CI runs axe-core through Playwright on the home page, a type gallery with filters applied, a detail page for each type, and the print view, in both themes. Any serious or critical violation fails the build.

### 9.8 UI refinement workflow

UI refinement is an explicit part of v1 testing, so the tooling for it ships with the gallery milestone.

- **Style guide page.** `/styleguide/` (not linked in navigation; `noindex`) renders, from the test fixtures:
  - every token as a swatch or sample
  - the type scale and the three typefaces
  - every template in each mode (`screen`, `capture`, and print previews at each page size)
  - gallery cards with and without art
  - filter controls in their states (empty, active, focused)

  Each has a light/dark switch, and there is a side-by-side view of both themes. This page is where most refinement happens: edit a token, and every affected surface updates at once under `npm run dev`.
- **Fixtures include stress cases:** a creature with legendary actions and spellcasting, a long magic item, a cantrip and a 9th-level spell, a very long name, and an entry with many tags. Layouts get judged against the hard cases, not only the pretty ones.
- **Visual snapshots on demand.** `npm run snapshots` captures the style guide and key pages in both themes with Playwright into a git-ignored folder, for before/after comparison of a refinement. It is not a CI gate, so deliberate design changes never fight a failing snapshot test.
- **Where to change what:**

| To change | Edit |
|---|---|
| A color in one theme | `tokens/semantic.css` |
| The palette everywhere | `tokens/primitives.css` |
| A type or rarity color | `tokens/content.css` |
| Fonts or the type scale | `tokens/primitives.css` (families and scale) and `semantic.css` (role assignment) |
| Card size, grid density, gaps | `tokens/components.css` |
| Print density per page size | `tokens/print.css` |
| Page size dimensions and margins | `config/export.json` |
| Stat-block structure or order | The template's part components in `site/src/components/templates/` |
| A quick experiment | `overrides.css`, then move the result into tokens or the component |

- **UI changes go through the dev lane** (§12.4) on `dev/` branches, labeled `ui` automatically, usually from a UI-refinement issue. Routines never touch `site/`; the lane check rejects it.

## 10. Export

### 10.1 Exporter interface

Each exporter is a module in `site/src/exporters/` and is listed in `config/export.json`.

```ts
interface Exporter {
  id: string;                         // "json", "png", "print"
  label: string;                      // button text
  scopes: Array<"entry" | "set">;     // single entry, filtered/selected set, or both
  run(items: Array<{ entry: Entry; derived: Derived }>, options: ExportOptions): Promise<void>;
}
```

Future translators (Foundry VTT, Open5e, and other open formats) are additional exporters that map an entry and its derived values to the target format. Most target formats store computed numbers, so translators read `derived` rather than recomputing. No gallery code changes are needed to add one.

### 10.2 JSON

- Entry scope: downloads the entry's raw file as `<id>.json`. This is the native format: inputs only, no derived values.
- Set scope: fetches each entry's raw file and downloads one array as `library-<YYYYMMDD>.json`.

### 10.3 PNG

- Renders the type template in `capture` mode at a fixed CSS width from config, off-screen, then captures it with `html-to-image` at the configured scale.
- Includes art when present and omits the placeholder.
- Fonts are self-hosted and embedded so the capture matches the screen.
- Filename `<id>.png`. Entry scope only in v1.

### 10.4 Print (PDF)

- `/print/?ids=a,b,c&size=letter` or `/print/?<gallery query>&size=letter` renders the entries in `print` mode.
- The page size comes from `config/export.json`. The print view injects an `@page { size; margin }` rule for the chosen size at runtime, because `@page` cannot be toggled by class.
- Layout per size: Letter and A4 use the two-column 5.2 stat-block layout; Half-Letter and 4×6 use one column with smaller type.
- Each entry starts on a new page by default; a "continuous" toggle packs entries. Long stat blocks flow onto following pages with `break-inside: avoid` on actions and traits so no action is split.
- A small footer on each page carries the entry name and the SRD attribution line.
- You save as PDF from the browser's print dialog. The print view opens the dialog automatically once fonts load.

### 10.5 `config/export.json`

```json
{
  "pageSizes": [
    { "id": "letter", "label": "US Letter", "width": "8.5in", "height": "11in", "margin": "0.5in", "columns": 2, "default": true },
    { "id": "a4", "label": "A4", "width": "210mm", "height": "297mm", "margin": "12mm", "columns": 2 },
    { "id": "half-letter", "label": "US Half-Letter", "width": "5.5in", "height": "8.5in", "margin": "0.4in", "columns": 1 },
    { "id": "card-4x6", "label": "4 × 6 in card", "width": "4in", "height": "6in", "margin": "0.25in", "columns": 1 }
  ],
  "png": { "scale": 2, "width": 420, "wideWidth": 840 },
  "exporters": ["json", "png", "print"]
}
```

`wideWidth` is used for creatures with legendary actions or more than six actions, matching the two-column layout.

## 11. Licensing and attribution

- **Code:** MIT (`LICENSE`).
- **Third-party assets:** Alegreya fonts (SIL Open Font License 1.1) and Lucide icons (ISC), each credited in `ATTRIBUTION.md`.
- **Content** (`content/`, `rulesets/*/guidelines/`): CC-BY-4.0 (`LICENSE-CONTENT`), compatible with the SRD's terms.
- **SRD attribution statement**, in `ATTRIBUTION.md`, the site footer, the `/about/` page, and every print page:

  > This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

- PNG exports carry a one-line short form ("Includes SRD 5.2 material, CC-BY-4.0") in the capture footer.
- **Blocklist** (`config/blocklist.json`): a list of non-SRD proper nouns (product-identity monsters, named characters, settings, and named spell prefixes, for example "Beholder," "Mind Flayer," "Illithid," "Displacer Beast," "Githyanki," "Forgotten Realms," "Faerûn," "Greyhawk," "Eberron," "Waterdeep," "Mordenkainen," "Bigby," "Tasha"). Matching is case-insensitive on word boundaries across `name`, `summary`, `description`, `descriptors`, and all `stats` text. A match is an error. For a borderline false positive, the fix is a PR that edits the blocklist, so the decision is visible in history.
- Other rulesets require their own licensing review and attribution entry before they are added. `config/types.json` `attribution` points each ruleset to its statement.

## 12. CI/CD and repository settings

### 12.1 `validate.yml` (on `pull_request` to `main`)

Triggered on `opened`, `synchronize`, `reopened`, `labeled`, and `unlabeled`, so label changes re-run the lane rules. Jobs:

1. **`lane`.** Determines the lane from the branch prefix, lists changed paths against the base, and applies the lane rules (§12.4). Outputs the lane and whether content paths changed.
2. **`content-checks`** (every PR, after `lane`). Checkout with full history; set up Node 22 with npm cache; `npm ci`; `npm run validate` across all entries; `npm run build`. When content paths changed, `scripts/pr-summary.ts` writes the job summary: changed entries (added, modified, removed) with name, type, `summaryField` value, and summary; for creatures, the derived HP, AC, attack bonuses, DCs, and average damage per action; all warnings, including every formula adjustment; ref changes (new back-links created). The built site is uploaded as a workflow artifact (7-day retention) for optional local preview.
3. **`dev-checks`** (dev lane only, after `content-checks`). `npm run check` (types, `astro check`, Stylelint), `npm test` (including contrast), and `npm run a11y` against the built-site artifact.
4. **`validate`** (always runs; needs all of the above). Passes only if every needed job succeeded or was skipped by lane. This job is the single required status check, so branch protection never depends on which jobs a lane runs.

Content PRs get fast feedback (validation and build only), since they cannot change code. Dev PRs get the full suite.

### 12.2 `deploy.yml` (on `push` to `main`, plus `workflow_dispatch`)

1. Same install, validate, and build steps.
2. `actions/upload-pages-artifact`, then `actions/deploy-pages`.
3. Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`, cancel-in-progress false.

Pages source is set to GitHub Actions.

### 12.3 Repository settings

- **Visibility:** public.
- **Branch protection on `main`:** require the `validate` status check and up-to-date branches; require pull requests (no direct pushes, including from routines); block force-pushes and deletion. No required approvals.
- **Merge method:** squash merge only, using the PR title as the commit message. Delete head branches after merge.
- **Labels:** created as listed in §8.1 (content issues) and §12.4 (lanes and areas), plus `migration`.

### 12.4 Work lanes

One repository holds two kinds of work. **Content** is entries and art, produced by routines. **Development** is everything that decides how content is validated, generated, and shown. They share the ruleset module, so a schema change and the migration of every affected entry land in one commit. A split into separate repos would turn that into a cross-repo version dance. Instead, the two lanes are kept apart by enforced rules within the one repo, not by convention.

| | Content lane | Dev lane |
|---|---|---|
| Purpose | Add, revise, or remove entries and art | Change the ruleset module, config, site, scripts, workflows, skills, docs, spec |
| Paths it may change | `content/**`, `assets/images/**` | Everything else; content paths only with the `migration` label |
| Branch prefixes | `gen/`, `revise/` (routines), `manual/` (hand-made entries) | `dev/`, `dependabot/` |
| Opened by | Routines (or you, for `manual/`) | You, or a Claude session you start for development |
| Lane label (auto) | `content` | `dev` |
| Area labels (auto, from paths) | none | `ui` (`site/**`), `ruleset` (`rulesets/**` except guidelines), `generation` (`rulesets/*/guidelines/**`, `.claude/skills/**`, `config/defaults.json`, `docs/routines.md`), `ci` (`.github/**`) |
| Issue templates and labels | Content request (`request`), revise request (`revise`) (§8.1) | Bug report (`bug`), feature request (`feature`), UI refinement (`ui`) |
| PR template | `content.md`: generated by the routine (§8.4) | `dev.md`: what and why, spec sections touched, screenshots for `ui`, migration notes |
| PR title | `Add <n> <type> entries`, `Revise <ids>: <reason>` | `<area>: <summary>`, for example `ui: tighten stat-block spacing` |
| CI | Content checks (below) | Full checks (below) |
| Review focus | Balance, tone, originality, licensing | Code, design, behavior, spec accuracy |

Because merges are squashed with the PR title as the message, `git log` on `main` reads as two visibly distinct streams: "Add/Revise …" for content and "`<area>:` …" for development.

**Lane rules (enforced by the `lane` job in `validate.yml`)**

- A PR's lane comes from its branch prefix. An unknown prefix fails with a message listing the valid ones.
- A content-lane PR fails if it changes any path outside `content/**` and `assets/images/**`. Routines therefore cannot alter schemas, guidelines, config, or the site, even by accident.
- A dev-lane PR fails if it changes `content/**` or `assets/images/**` without the `migration` label. The label is applied by hand, never automatically, so every bulk content change made by code is a deliberate, visible decision. A migration PR's body must state what changed in the entries and why.
- The job re-runs when labels change (`pull_request` types `opened`, `synchronize`, `reopened`, `labeled`, `unlabeled`), so adding `migration` unblocks the PR without a new push.

**Guidelines count as development.** A guideline edit changes every future generation run, so it is reviewed as behavior (`generation` label), not as content. The same applies to the generation and revision skills, the defaults file, and the routine prompts.

**Routines work only the content lane.** They pick up only `request` and `revise` issues and push only to `gen/` and `revise/` branches. Dev-lane issues (bugs, features, UI refinement) are worked in Claude sessions you start, on `dev/` branches.

**Labeling** is done by `actions/labeler` in a `labeler.yml` workflow on `pull_request_target`, configured by `.github/labeler.yml` using branch prefixes for lane labels and changed paths for area labels. The labeler only reads PR metadata and changed paths; it never checks out or runs PR code.

**Dependencies.** Dependabot opens grouped, monthly npm and GitHub Actions updates on `dependabot/` branches. They go through the dev lane and get the full checks.

**Tracking.** Each milestone in the delivery plan (§16) is one dev-lane issue; a milestone that needs more than one PR has its tasks as sub-issues. Content issues stand alone.

**Escape hatch.** Content lives only under `content/` and `assets/images/`, and `scripts/build-index.ts` is the single place the site reads it. If the lanes ever need separate repositories (outside contributors, a second consumer of the content), `git filter-repo` can extract those two folders with history. The ruleset module would then become a versioned package that both repos depend on.

## 13. Review and quality

| Check | Automated (CI) | Human (PR review) |
|---|---|---|
| Envelope and `stats` schema conformance, unknown keys rejected | Yes | |
| File path, ID, and name uniqueness | Yes | |
| Derived values (XP, PB, HP, damage averages, attack bonuses, DCs, saves, skills, passive Perception) | Not stored, so nothing to check; computed by the ruleset module | |
| Text tokens valid; no literal derived numbers in creature prose | Yes | |
| Formula adjustments (`adjust`, damage `bonus`) | Warning | Confirm each one |
| References resolve; deletions don't orphan refs | Yes | |
| Blocklist | Yes | Edit the blocklist for false positives |
| Site builds | Yes | |
| Balance against guideline targets | | Yes |
| Flavor, tone, originality | | Yes |
| Rules legality beyond derived checks | | Yes |

## 14. CLAUDE.md contents

The repo's `CLAUDE.md` imports `AGENTS.md`, the canonical working guide for any agent, which instructs every session working in the repo:

- Content is generated and revised through the `generate` and `revise` skills; follow them exactly.
- Never push to `main`. Work in exactly one lane per PR (§12.4): content tasks on `gen/`, `revise/`, or `manual/` branches touching only `content/` and `assets/images/`; development tasks on `dev/` branches, touching content only in a deliberate migration (ask for the `migration` label).
- Routines take only `request` and `revise` issues; dev-lane issues are for development sessions.
- Never change an entry's `id` or move its file.
- Never write a value the ruleset derives. Write inputs, use tokens for derived numbers in prose, and use `adjust` only for deliberate deviations.
- Run `npm run validate` before every push; never push a failing batch.
- Dev PRs that change behavior update `SPEC.md` in the same PR, and use the `dev.md` PR template.
- SRD-only rules and the blocklist apply to every text field.
- Mark review replies with `<!-- routine:handled -->`.

## 15. Extensibility

| To add or change | Touch |
|---|---|
| A content type | In `rulesets/<ruleset>/`: a schema, a `derive` function if it has formulas, checks if needed, a guideline, and the type in `ruleset.json`. Plus a registry entry and the issue-form dropdown; a template only if the generic layout does not fit |
| A ruleset | A new `rulesets/<ruleset>/` folder, registry entries, an attribution statement, and a licensing review |
| A rules formula or table | `rulesets/<ruleset>/tables.json` or `derive.ts`; every entry picks it up on the next build |
| A world, campaign, author, or theme | A tag on entries |
| A filter or sort on a tag | Nothing |
| A filter or sort on a `stats` field | A facet in the registry |
| A field a schema validates | The type schema, plus the template if displayed |
| A page size | One row in `config/export.json` |
| An export format or translator | One exporter module, listed in `config/export.json` |
| A theme | One token block in `site/src/styles/tokens/semantic.css` and an option in the theme toggle |
| Any visual detail | See the table in §9.8 |
| Art for an entry | Commit the file under `assets/images/` and set `image` |
| Data storage outside the repo | `scripts/build-index.ts`; the site keeps reading the same `library.json` shape |

## 16. Delivery plan

Each milestone ends with something you can verify.

| # | Milestone | Done when |
|---|---|---|
| 1 | **Skeleton.** Astro project, envelope schema, `dnd-5e-2024` ruleset module with the creature schema, tables, derivations, and tokens, validator (schema stage and creature checks), one hand-written creature, workflows with the lane job, labeler, issue and PR templates, branch protection, Pages live | A merged PR changes the live page; a PR with a broken entry is blocked; a `gen/` PR touching `site/` is blocked; a `dev/` PR touching `content/` is blocked until labeled `migration` |
| 2 | **Full model.** Magic-item and spell schemas and checks, refs and back-refs, blocklist, markdown-subset check, test fixtures for every error | Fixture suite covers each check and each derivation; the three example entries in §6.9 validate, link to each other, and render the numbers shown there |
| 3 | **Gallery.** Registry, index builder, token files and global layers, light/dark themes and toggle, card grid, facets, tags, "Add filter," sort, search, URL state, detail pages, placeholder art, about page, style guide page, contrast tests, axe checks in CI | Example entries can be found by name, tag, and facet; a copied URL reproduces the view; changing one semantic token visibly restyles every surface on the style guide; CI passes axe and contrast checks |
| 4 | **Exports.** JSON (entry and set), PNG, print view with all four sizes, multi-entry print | A Letter print of a long creature paginates cleanly with selectable text; a PNG posts legibly to Discord |
| 5 | **Generation.** Issue forms, labels, defaults, `generate` skill, guidelines for three types, routine prompts in `docs/routines.md` | One run turns an issue into a passing PR that closes the issue on merge |
| 6 | **Revision and schedule.** `revise` skill, comment sweep, revise issues, gap-filler, weekly schedule | A review comment on a routine PR is addressed by the next run; a week with no open issues produces a gap-fill PR |

v1 is complete when all six milestones are done, the library holds at least five entries of each type merged through the routine flow, and a UI refinement pass has been made through `ui` PRs. Refinement runs alongside milestones 4–6 rather than after them.

### 16.1 Later (post-v1)

- Format translators (Foundry VTT, Open5e).
- Additional types (NPC, encounter, location) and a second ruleset.
- One-click PDF download without the print dialog.
- Art generation or curation workflow filling `image`.
- Prebuilt search index if the library outgrows client-side indexing.

## Appendix A. SRD 5.2 CR tables

| CR | XP | PB | | CR | XP | PB |
|---|---|---|---|---|---|---|
| 0 | 0 or 10 | +2 | | 13 | 10,000 | +5 |
| 1/8 | 25 | +2 | | 14 | 11,500 | +5 |
| 1/4 | 50 | +2 | | 15 | 13,000 | +5 |
| 1/2 | 100 | +2 | | 16 | 15,000 | +5 |
| 1 | 200 | +2 | | 17 | 18,000 | +6 |
| 2 | 450 | +2 | | 18 | 20,000 | +6 |
| 3 | 700 | +2 | | 19 | 22,000 | +6 |
| 4 | 1,100 | +2 | | 20 | 25,000 | +6 |
| 5 | 1,800 | +3 | | 21 | 33,000 | +7 |
| 6 | 2,300 | +3 | | 22 | 41,000 | +7 |
| 7 | 2,900 | +3 | | 23 | 50,000 | +7 |
| 8 | 3,900 | +3 | | 24 | 62,000 | +7 |
| 9 | 5,000 | +4 | | 25 | 75,000 | +8 |
| 10 | 5,900 | +4 | | 26 | 90,000 | +8 |
| 11 | 7,200 | +4 | | 27 | 105,000 | +8 |
| 12 | 8,400 | +4 | | 28 | 120,000 | +8 |
| | | | | 29 | 135,000 | +9 |
| | | | | 30 | 155,000 | +9 |

This table lives in `rulesets/dnd-5e-2024/tables.json`, which cites the SRD section it comes from. "In lair" XP is the XP of the next row.
