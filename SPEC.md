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
4. **Boring tools.** Static build, GitHub Actions, no runtime services.

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
| One schema file per ruleset | One schema directory per ruleset, one file per type | Keeps type schemas reviewable in isolation |

## 3. Architecture

```
GitHub Issue (request)
        │
        ▼
Claude routine ── reads config, schemas, guidelines, library index
        │         writes content/<ruleset>/<type>/<id>.json
        │         runs npm run validate until clean
        ▼
Pull request (label: generated, "Closes #n")
        │
        ├── validate.yml: schema + derived checks + refs + build → job summary
        │
        ├── Review comments ──► routine revises, re-validates, pushes, replies
        │
        ▼
Merge to main ──► deploy.yml: build-index → astro build → GitHub Pages
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
| Fonts | Self-hosted OFL fonts via `@fontsource` packages | No external font requests; required for PNG fidelity |
| Tests | Vitest | Validator, index builder, URL-state codec, exporters |

The Pages site is served from `https://bardic-inspiration.github.io/ttrpg-library/`; Astro's `base` is `/ttrpg-library/` and every internal link goes through it.

## 4. Repository structure

```
ttrpg-library/
├── content/<ruleset>/<type>/<id>.json      entries (the data)
├── assets/images/<ruleset>/<type>/<id>.*   optional art (none in v1)
├── schemas/
│   ├── envelope.schema.json                fixed keys, tags, meta, image (all rulesets)
│   └── <ruleset>/
│       ├── common.schema.json              shared defs: ref, dice, damage, abilities
│       └── <type>.schema.json              stats schema per type
├── config/
│   ├── types.json                          type registry (§7)
│   ├── defaults.json                       generation defaults (§8.3)
│   ├── export.json                         page sizes, PNG settings, exporters (§10.5)
│   └── blocklist.json                      non-SRD proper nouns (§11)
├── guidelines/<ruleset>/<type>.md          generation rules per type
├── scripts/
│   ├── validate/                           CLI, schema stage, semantic checks per ruleset/type
│   ├── build-index.ts                      content → library.json
│   └── pr-summary.ts                       job summary for changed entries
├── site/                                   Astro project (pages, components, islands, styles)
├── tests/                                  Vitest suites and fixture entries
├── .claude/skills/
│   ├── generate/SKILL.md                   generation (issues and gap-fill)
│   └── revise/SKILL.md                     revisions from PR comments or a revise request
├── .github/
│   ├── workflows/validate.yml, deploy.yml
│   └── ISSUE_TEMPLATE/content-request.yml, revise-request.yml, config.yml
├── docs/routines.md                        canonical routine prompts and schedule
├── SPEC.md  CLAUDE.md  README.md
└── LICENSE  LICENSE-CONTENT  ATTRIBUTION.md
```

`library.json` is built in CI and git-ignored, so pull requests contain only entry files (and, in revise or dependency cases, the files they touch).

npm scripts: `validate`, `build:index`, `dev`, `build` (runs `build:index` then `astro build`), `test`, `check` (types and `astro check`).

## 5. Content model

### 5.1 Entry envelope

Every entry, in every ruleset, has this shape (`schemas/envelope.schema.json`):

| Key | Required | Type | Rule |
|---|---|---|---|
| `ruleset` | yes | string | Must name a directory in `schemas/` and a ruleset in `config/types.json`. v1: `dnd-5e-2024` |
| `type` | yes | string | Single value. Must have a schema file and a registry entry for the ruleset |
| `id` | yes | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 chars, globally unique, equals filename without `.json`, immutable after merge |
| `name` | yes | string | Display name, 1–80 chars, globally unique case-insensitively |
| `summary` | yes | string | One line, 10–160 chars, plain text. Used on cards, in PR bodies, and in link previews |
| `description` | no | string | Lore and flavor, markdown subset. Not rules text |
| `stats` | yes | object | Validated by `schemas/<ruleset>/<type>.schema.json`. Unknown keys rejected |
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

`description`, and the rules-text fields inside `stats` (`text`, `effect`, `higherLevels`, etc.), accept a markdown subset: paragraphs, `**bold**`, `*italic*`, bulleted and numbered lists, and line breaks. No headings, links, HTML, images, or tables. The validator rejects disallowed constructs. Rendering is sanitized.

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

## 6. dnd-5e-2024 schemas

The ruleset ID is `dnd-5e-2024`, aligned with SRD 5.2 (CC-BY-4.0). Field names below are the JSON keys under `stats`. Unless marked optional, a field is required.

### 6.1 Shared definitions (`common.schema.json`)

| Def | Shape |
|---|---|
| `Ability` | `str`, `dex`, `con`, `int`, `wis`, `cha` |
| `Dice` | String `^\d+d(4|6|8|10|12|20|100)([+-]\d+)?$`, for example `2d6+3` |
| `Damage` | `{ dice: Dice, average: int, type: DamageType }` |
| `DamageType` | `acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder` |
| `Condition` | `blinded`, `charmed`, `deafened`, `exhaustion`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious` |
| `Ref` | `{ ref: string }` matching `^(creature|magic-item|spell)/[a-z0-9-]+$` |
| `RefOrText` | `Ref` or non-empty string |
| `Text` | Markdown-subset string (§5.5) |

### 6.2 Creature (`creature.schema.json`)

| Field | Shape | Notes |
|---|---|---|
| `size` | array of `tiny`…`gargantuan`, 1–2 items | Two values for "Medium or Small" |
| `creatureType` | enum of the 14 SRD creature types | `aberration`, `beast`, `celestial`, `construct`, `dragon`, `elemental`, `fey`, `fiend`, `giant`, `humanoid`, `monstrosity`, `ooze`, `plant`, `undead` |
| `descriptors` | optional array of strings | Parenthetical tags such as `"Wizard"`; must pass the blocklist |
| `alignment` | string | Free text from the SRD alignment set, plus `"unaligned"` and `"any alignment"` |
| `ac` | `{ value: int 1–30, note?: string }` | `note` such as `"natural armor"` |
| `initiative` | `{ bonus: int }` | Score is derived as 10 + bonus for display |
| `hp` | `{ average: int, formula: Dice }` | |
| `speed` | `{ walk: int, fly?, swim?, climb?, burrow?: int, hover?: bool }` | Feet; multiples of 5 |
| `abilities` | `{ str…cha: int 1–30 }` | Modifiers are always derived, never stored |
| `saves` | optional `{ <Ability>: int }` | Only proficient saves listed; others display as the modifier |
| `skills` | optional `{ <skill>: int }` | Keys from the 18 SRD skills in kebab-case |
| `vulnerabilities`, `resistances` | optional arrays of `DamageType` or string | String for qualified entries |
| `immunities` | optional `{ damage?: [...], conditions?: [Condition] }` | |
| `gear` | optional array of `RefOrText` | Items the creature carries |
| `senses` | `{ darkvision?, blindsight?, tremorsense?, truesight?: int, passivePerception: int }` | |
| `languages` | `{ list: [string], telepathy?: int, note?: string }` | Empty list displays as "None" |
| `cr` | number: `0`, `0.125`, `0.25`, `0.5`, or `1`–`30` | Displayed as fractions |
| `xp` | int | Must match CR (Appendix A) |
| `xpInLair` | optional int | |
| `traits`, `actions`, `bonusActions`, `reactions` | arrays of `Action` (`actions` required, others optional) | |
| `legendaryActions` | optional `{ uses: int, usesInLair?: int, intro?: Text, items: [Action] }` | |
| `spellcasting` | optional `{ ability, dc, attackBonus?, atWill?: [RefOrText], perDay?: { "1"…"3": [RefOrText] }, note?: Text }` | Rendered as the 5.2 "Spellcasting" action |

**Action**

| Field | Shape | Notes |
|---|---|---|
| `name` | string | |
| `kind` | `melee-attack`, `ranged-attack`, `melee-or-ranged-attack`, `save`, `other` | |
| `ability` | optional `Ability` | Required for attack and save kinds; drives derived checks |
| `attackBonus` | int | Attack kinds only |
| `reach` / `range` | int / `{ normal: int, long?: int }` | Attack kinds |
| `save` | `{ ability: Ability, dc: int, area?: string }` | `save` kind |
| `damage` | optional array of `Damage` | First is the primary hit; the rest are "plus" riders |
| `recharge` | optional string | `"5-6"`, `"6"`, `"short-or-long-rest"`, `"long-rest"` |
| `uses` | optional string | `"3/day"` |
| `text` | `Text` | Full prose as printed. Always required, so the card never depends on reconstructing prose |

### 6.3 Magic item (`magic-item.schema.json`)

| Field | Shape | Notes |
|---|---|---|
| `category` | `armor`, `potion`, `ring`, `rod`, `scroll`, `staff`, `wand`, `weapon`, `wondrous-item` | |
| `baseItem` | optional string | Required for `armor` and `weapon` (for example `"Longsword"`, `"any medium armor"`) |
| `rarity` | `common`, `uncommon`, `rare`, `very-rare`, `legendary`, `artifact`, `varies` | |
| `attunement` | `{ required: bool, requirement?: string }` | `requirement` such as `"by a spellcaster"` |
| `charges` | optional `{ max: int, recharge: string, depletion?: Text }` | |
| `spells` | optional array of `{ spell: RefOrText, chargeCost?: int, saveDc?: int, attackBonus?: int }` | |
| `cursed` | optional bool | |
| `effect` | `Text` | The rules text as printed |

### 6.4 Spell (`spell.schema.json`)

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

### 6.5 Derived and consistency checks

Run after schema validation by `scripts/validate/checks/dnd-5e-2024/<type>.ts`. **Errors** fail CI. **Warnings** appear in local output and the job summary but do not block.

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
| `xp` matches `cr` (Appendix A); proficiency bonus derived from CR | error |
| `hp.formula` die matches size: Tiny d4, Small d6, Medium d8, Large d10, Huge d12, Gargantuan d20 (first size when two are listed) | error |
| `hp.formula` modifier = dice count × CON modifier | error |
| `hp.average` = floor(dice average) + modifier | error |
| Every `Damage.average` = floor of its dice average | error |
| `attackBonus` = PB + modifier of `ability` | error |
| Action `save.dc` and `spellcasting.dc` = 8 + PB + modifier of the relevant ability | error |
| `spellcasting.attackBonus`, when present, = PB + modifier | error |
| `senses.passivePerception` = 10 + Perception bonus if listed, else 10 + WIS modifier | error |
| Listed saves = modifier + PB | warning |
| Listed skills = modifier + PB or modifier + 2×PB | warning |
| `initiative.bonus` = DEX modifier + 0, PB, or 2×PB | warning |
| Speeds are multiples of 5 | error |

Magic item:

| Check | Level |
|---|---|
| `baseItem` present for `armor` and `weapon` | error |
| `attunement.requirement` only when `required` is true | error |
| `spells[].chargeCost` only when `charges` is present | error |

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

Balance (hit points, damage per round, and save DCs for a given CR, item rarity versus power, spell damage for a given level) is judged in review against targets written in the guideline files. It is not enforced by CI.

### 6.6 Example entries

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
    "initiative": { "bonus": 2 },
    "hp": { "average": 32, "formula": "5d8+10" },
    "speed": { "walk": 40 },
    "abilities": { "str": 15, "dex": 14, "con": 14, "int": 4, "wis": 12, "cha": 6 },
    "skills": { "perception": 3, "stealth": 4 },
    "immunities": { "damage": ["fire"] },
    "senses": { "darkvision": 60, "passivePerception": 13 },
    "languages": { "list": [] },
    "cr": 2,
    "xp": 450,
    "actions": [
      {
        "name": "Bite",
        "kind": "melee-attack",
        "ability": "str",
        "attackBonus": 4,
        "reach": 5,
        "damage": [
          { "dice": "1d8+2", "average": 6, "type": "piercing" },
          { "dice": "1d6", "average": 3, "type": "fire" }
        ],
        "text": "*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage."
      },
      {
        "name": "Ember Breath",
        "kind": "save",
        "ability": "con",
        "save": { "ability": "dex", "dc": 12, "area": "15-foot cone" },
        "damage": [{ "dice": "3d6", "average": 10, "type": "fire" }],
        "recharge": "5-6",
        "text": "*Dexterity Saving Throw:* DC 12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage. *Success:* Half damage."
      }
    ]
  },
  "tags": { "theme": "fire", "environment": ["underdark", "mountains"] },
  "meta": { "createdAt": "2026-11-02", "source": { "kind": "routine", "issues": [1] } }
}
```

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
    "effect": "While holding this wand, you can expend 1 of its charges to cast *Frost Lance* (+5 to hit) from it."
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
        "guideline": "guidelines/dnd-5e-2024/creature.md",
        "facets": [
          { "path": "stats.cr", "label": "CR", "kind": "range", "format": "cr" },
          { "path": "stats.size", "label": "Size", "kind": "enum" },
          { "path": "stats.creatureType", "label": "Creature type", "kind": "enum" },
          { "path": "stats.abilities.str", "label": "STR", "kind": "range" }
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
| `facets` | The `stats` paths lifted into `library.json` and offered as filters and sorts. `kind` is `range` (numbers) or `enum` (strings, string arrays, booleans). `format` is an optional display formatter (`cr`, `spell-level`, `rarity`) |
| `cardFields` | Facets shown on gallery cards |
| `defaultSort` | `<path>:<asc|desc>` |
| `defaultFilters` | Filters shown expanded by default; every other facet and tag stays reachable through "Add filter" |
| `summaryField` | The key stat shown in PR bodies and job summaries (CR, rarity, spell level) |
| `template` | Card and print component; a missing template falls back to the generic layout |
| `gapBuckets` | How the gap-filler partitions the type (one path with numeric bins, or `enum` for categorical paths) |

v1 registry entries:

| Type | Facets | Card fields | Default sort | Gap buckets |
|---|---|---|---|---|
| `creature` | CR, size, creature type, six ability scores, AC, HP | CR, size, creature type | CR ascending | CR bins as above |
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
| `generated` | On PRs opened by routines |

### 8.2 Routine run order

Every run, scheduled or manual, follows the same sequence so that review feedback is never starved by new work.

1. **Sync.** Fetch `main`; run `npm ci` and `npm run build:index` to get the current library.
2. **Revisions first.** For each open PR labeled `generated`, find owner comments not yet handled (§8.5) and invoke the `revise` skill. Push, reply, continue.
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

1. Read `config/types.json`, `config/defaults.json`, the type's schema, `guidelines/<ruleset>/<type>.md`, `config/blocklist.json`, and `library.json`.
2. List existing names and IDs for collision avoidance, and existing entries matching the brief's theme to avoid near-duplicates in concept.
3. Write entries, including any new dependencies the brief implies (a creature's signature spell). Prefer references to existing library entries over plain text when a matching entry exists.
4. Set `meta.createdAt`, `meta.source.kind: "routine"`, and `meta.source.issues`; apply request and default tags.
5. Run `npm run validate`. Fix and retry up to `validateRetries` times. If still failing, comment the errors on the issue, remove `in-progress`, and stop without opening a PR.
6. Branch `gen/<issue-numbers-or-gap>-<YYYYMMDD>` (for example `gen/12-14-20261102`, `gen/gap-spell-20261102`), commit with message `Add <n> <type> entries`, push, open the PR.

**PR conventions**

- Title: `Add <n> <type> entries` (mixed batches: `Add <n> entries`).
- Label: `generated`.
- Body: a table of each entry (name, type, the type's `summaryField` value, summary); any validator warnings; one `Closes #n` line per fulfilled issue; for gap-fill runs, the bucket that was filled.

### 8.5 Comment-driven revisions (the `revise` skill)

- **Input.** Owner comments on a `generated` PR: inline review comments on a file or line, or general PR comments.
- **Instructions.** Free text applies to the commented file, or to the whole batch for general comments. `drop <id>` removes an entry (and fails validation if something references it, in which case the routine asks how to proceed). `regenerate <id>` replaces an entry with a fresh one under the same brief.
- **Handled marker.** The routine posts under your identity, so it marks its own replies with a trailing `<!-- routine:handled -->` comment. An owner comment is pending if no reply with that marker follows it in its thread (inline) or after it (general).
- **Action.** Edit only the affected files, set `meta.updatedAt`, re-run validation, push one commit per round (`Revise <ids>: <short reason>`), reply to each handled comment with what changed, and resolve inline threads it addressed.
- **Post-merge revisions.** A `revise` issue produces a PR on branch `revise/<issue>-<YYYYMMDD>` with `meta.source.kind` left as-is and `meta.updatedAt` set. IDs never change.
- **Delivery.** The run-order sweep in §8.2 step 2 is the guaranteed path, so a comment is handled by the next run at the latest. A routine session may also subscribe to the PR it opened for faster turnaround where the platform supports it; correctness never depends on that.

### 8.6 Guidelines

Each `guidelines/dnd-5e-2024/<type>.md` contains:

- Tone and voice, with one short exemplar.
- Naming conventions: evocative and original; no real-world trademarks; no non-SRD proper nouns; avoid near-collisions with SRD names.
- Balance targets as our own tables (for creatures, by CR: AC, HP, attack bonus, damage per round, save DC; for items, power expectations by rarity; for spells, damage by level and area).
- Required prose style for `text` and `effect` fields, matching the 5.2 stat-block phrasing (*Melee Attack Roll:*, *Hit:*, *Dexterity Saving Throw:*, *Failure:*, *Success:*).
- When to create a dependency entry versus using plain text for an SRD reference.

### 8.7 Schedule

Recorded in `docs/routines.md` along with the canonical routine prompts:

- **Scheduled routine:** weekly, Monday morning local time, one run. Default batch 5, never above `maxBatch` (10).
- **On-demand routine:** same prompt, with optional issue numbers or an inline request.

## 9. Gallery site

### 9.1 Build

1. `scripts/build-index.ts` reads every file under `content/`, runs the validator (the build fails if validation fails), resolves refs, and computes back-references.
2. It writes `site/public/library.json` (the index) and copies each entry's raw JSON to `site/public/data/<ruleset>/<type>/<id>.json` for export.
3. Astro builds static pages, reading the full entries at build time.

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
  "facets": { "stats.cr": 2, "stats.size": ["medium"], "stats.creatureType": "monstrosity" },
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

### 9.5 Templates and theming

- One component per type template: `creature-stat-block`, `magic-item-card`, `spell-card`, and a `generic` fallback that renders fixed keys, `stats` as a definition list, and tags.
- The same component renders in gallery detail, PNG capture, and print, with a `mode` prop (`screen`, `capture`, `print`) that adjusts only spacing, columns, and interactive elements.
- All colors, fonts, and spacing come from CSS variables in `site/src/styles/tokens.css`. A theme change touches one file. Light and dark themes are both defined; print and capture always use the light theme.

## 10. Export

### 10.1 Exporter interface

Each exporter is a module in `site/src/exporters/` and is listed in `config/export.json`.

```ts
interface Exporter {
  id: string;                         // "json", "png", "print"
  label: string;                      // button text
  scopes: Array<"entry" | "set">;     // single entry, filtered/selected set, or both
  run(entries: Entry[], options: ExportOptions): Promise<void>;
}
```

Future translators (Foundry VTT, Open5e, and other open formats) are additional exporters that map an `Entry` to the target format. No gallery code changes are needed to add one.

### 10.2 JSON

- Entry scope: downloads the entry's raw file as `<id>.json`.
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
- **Content** (`content/`, `guidelines/`): CC-BY-4.0 (`LICENSE-CONTENT`), compatible with the SRD's terms.
- **SRD attribution statement**, in `ATTRIBUTION.md`, the site footer, the `/about/` page, and every print page:

  > This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

- PNG exports carry a one-line short form ("Includes SRD 5.2 material, CC-BY-4.0") in the capture footer.
- **Blocklist** (`config/blocklist.json`): a list of non-SRD proper nouns (product-identity monsters, named characters, settings, and named spell prefixes, for example "Beholder," "Mind Flayer," "Illithid," "Displacer Beast," "Githyanki," "Forgotten Realms," "Faerûn," "Greyhawk," "Eberron," "Waterdeep," "Mordenkainen," "Bigby," "Tasha"). Matching is case-insensitive on word boundaries across `name`, `summary`, `description`, `descriptors`, and all `stats` text. A match is an error. For a borderline false positive, the fix is a PR that edits the blocklist, so the decision is visible in history.
- Other rulesets require their own licensing review and attribution entry before they are added. `config/types.json` `attribution` points each ruleset to its statement.

## 12. CI/CD and repository settings

### 12.1 `validate.yml` (on `pull_request` to `main`)

1. Checkout with full history for the base comparison; set up Node 22 with npm cache; `npm ci`.
2. `npm run check` and `npm test`.
3. `npm run validate` across all entries.
4. `npm run build`.
5. `scripts/pr-summary.ts` writes the job summary: changed entries (added, modified, removed) with name, type, `summaryField` value, and summary; all warnings; ref changes (new back-links created).
6. Upload the built site as a workflow artifact (7-day retention) for optional local preview.

The job is named `validate`; that name is the required status check.

### 12.2 `deploy.yml` (on `push` to `main`, plus `workflow_dispatch`)

1. Same install, validate, and build steps.
2. `actions/upload-pages-artifact`, then `actions/deploy-pages`.
3. Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`, cancel-in-progress false.

Pages source is set to GitHub Actions.

### 12.3 Repository settings

- **Visibility:** public.
- **Branch protection on `main`:** require the `validate` status check and up-to-date branches; require pull requests (no direct pushes, including from routines); block force-pushes and deletion. No required approvals.
- **Merge method:** squash merge only, using the PR title as the commit message. Delete head branches after merge.
- **Labels:** created as listed in §8.1.

## 13. Review and quality

| Check | Automated (CI) | Human (PR review) |
|---|---|---|
| Envelope and `stats` schema conformance, unknown keys rejected | Yes | |
| File path, ID, and name uniqueness | Yes | |
| Derived values (XP, PB, HP, damage averages, attack bonuses, DCs, passive Perception) | Yes | |
| Saves, skills, initiative plausibility | Warning | Confirm |
| References resolve; deletions don't orphan refs | Yes | |
| Blocklist | Yes | Edit the blocklist for false positives |
| Site builds | Yes | |
| Balance against guideline targets | | Yes |
| Flavor, tone, originality | | Yes |
| Rules legality beyond derived checks | | Yes |

## 14. CLAUDE.md contents

The repo's `CLAUDE.md` instructs any Claude session working in the repo:

- Content is generated and revised through the `generate` and `revise` skills; follow them exactly.
- Never push to `main`; always branch and open a PR labeled `generated`.
- Never change an entry's `id` or move its file.
- Run `npm run validate` before every push; never push a failing batch.
- Keep PRs to content changes unless the task is explicitly about code, schemas, or config.
- SRD-only rules and the blocklist apply to every text field.
- Mark review replies with `<!-- routine:handled -->`.

## 15. Extensibility

| To add or change | Touch |
|---|---|
| A content type | `schemas/<ruleset>/<type>.schema.json`, optional checks module, `guidelines/<ruleset>/<type>.md`, a registry entry, the issue-form dropdown; a template only if the generic layout does not fit |
| A ruleset | `schemas/<ruleset>/`, guidelines, registry entries, an attribution statement, a licensing review; optional checks modules |
| A world, campaign, author, or theme | A tag on entries |
| A filter or sort on a tag | Nothing |
| A filter or sort on a `stats` field | A facet in the registry |
| A field a schema validates | The type schema, plus the template if displayed |
| A page size | One row in `config/export.json` |
| An export format or translator | One exporter module, listed in `config/export.json` |
| A theme | `site/src/styles/tokens.css` |
| Art for an entry | Commit the file under `assets/images/` and set `image` |
| Data storage outside the repo | `scripts/build-index.ts`; the site keeps reading the same `library.json` shape |

## 16. Delivery plan

Each milestone ends with something you can verify.

| # | Milestone | Done when |
|---|---|---|
| 1 | **Skeleton.** Astro project, envelope and creature schema, validator (schema stage and creature checks), one hand-written creature, both workflows, branch protection, Pages live | A merged PR changes the live page, and a PR with a broken entry is blocked |
| 2 | **Full model.** Magic-item and spell schemas and checks, refs and back-refs, blocklist, markdown-subset check, test fixtures for every error | Fixture suite covers each check; the three example entries in §6.6 validate and link to each other |
| 3 | **Gallery.** Registry, index builder, card grid, facets, tags, "Add filter," sort, search, URL state, detail pages, placeholder art, about page | Example entries can be found by name, tag, and facet; a copied URL reproduces the view |
| 4 | **Exports.** JSON (entry and set), PNG, print view with all four sizes, multi-entry print | A Letter print of a long creature paginates cleanly with selectable text; a PNG posts legibly to Discord |
| 5 | **Generation.** Issue forms, labels, defaults, `generate` skill, guidelines for three types, routine prompts in `docs/routines.md` | One run turns an issue into a passing PR that closes the issue on merge |
| 6 | **Revision and schedule.** `revise` skill, comment sweep, revise issues, gap-filler, weekly schedule | A review comment on a generated PR is addressed by the next run; a week with no open issues produces a gap-fill PR |

v1 is complete when all six milestones are done and the library holds at least five entries of each type, merged through the routine flow.

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

The validator encodes this table in `scripts/validate/checks/dnd-5e-2024/tables.ts` and cites the SRD section it comes from.
