# Rulesets

## Purpose

Everything specific to a ruleset: its schemas, rules tables, derived values,
text tokens, consistency checks, and how its types print. The one ruleset is
`dnd-5e-2024`, aligned with SRD 5.2 (CC-BY-4.0), with three content types,
`creature`, `item`, and `spell`, and one rules type, `condition`. What every
entry shares is in
[content-model.md](content-model.md).

## Behavior

### Inputs and derived values

An entry stores only the values an author chooses. A value the ruleset defines
by fixed formula or table is never stored. The ruleset module computes it at
build time from the stored inputs.

- **No mismatches.** A derived value can't disagree with its inputs, because it
  is never written down.
- **No arithmetic in generation.** Routines write choices (ability scores, CR,
  hit dice, proficiencies), not computed numbers.
- **One place per rule.** A correction to a table or formula is a one-file
  change in the ruleset, and every entry picks it up on the next build.

**Deviations.** An entry that legitimately departs from a formula, such as a
creature with a +1 weapon, records an explicit non-zero `adjust` on that value,
or a `bonus` on a damage roll. The formula stays authoritative, the adjustment
is visible in the diff, and every adjustment is listed as a warning in the job
summary for the reviewer to confirm.

**Authored values stay stored.** Numbers the rules leave to the author are
inputs: a creature's AC, a spell's damage dice, an item's stated spell
save DC.

### The ruleset module

Everything specific to a ruleset lives in one folder, `rulesets/<ruleset>/`, so
adding a ruleset is adding a folder:

| File | Purpose |
|---|---|
| `ruleset.json` | ID, label, SRD version, attribution key, list of types, and the `rules` types ([Rules data](#rules-data)) |
| `tables.json` | Rules tables (CR to XP and PB, size to hit die, skill to ability) and the enums the schemas share |
| `derive.ts` | Pure functions, one per type, computing derived values from `stats` |
| `tokens.ts` | Text tokens that render derived values inside prose |
| `checks.ts` | Consistency checks a schema can't express |
| `refs.ts` | `refLabels(type, path)`: how detail pages name a ref from each end |
| `index.ts` | Exports the module, meeting the `RulesetModule` contract in `rulesets/module.ts` |
| `types.ts` | TypeScript shapes of `stats` and derived values, mirroring the schemas |
| `schemas/` | `common.schema.json` and one `<type>.schema.json` per type |
| `guidelines/<type>.md` | Generation guidance ([generation.md](generation.md#guidelines)) |
| `srd-manifest.json` | Every SRD entry of the ruleset ([content-model.md](content-model.md#srd-manifest-and-coverage)) |
| `rules/` | The ruleset's primitives, groups, and rules pages ([Rules data](#rules-data)) |

The validator, the index builder, the site templates, and the exporters all
import this module, so each derived value is computed in exactly one place. The
validator loads a ruleset by folder name, so an entry whose `ruleset` has no
folder or registry entry fails as unknown. A type with no formulas derives `{}`.

`dnd-5e-2024` ref labels: spell lists (a creature's `spellcasting`, an
item's `spells[].spell`) are "Casts" / "Cast by"; creature `gear` is "Gear" /
"Carried by"; a creature's condition immunities are "Immune to" / "Immune
creatures"; any other field, including a `{ref:…}` token in text, is
"References" / "Referenced by".

### Rules data

A ruleset splits into rules, its definitions, and content, the authorable
library. A **rules type** is listed in `ruleset.json` under `rules`, separate
from `types`, with whether it takes extensions:
`"rules": [{ "type": "condition", "extensions": true }]`.

- **Primitives** are the SRD's rules, kept with the ruleset: one file per
  primitive at `rules/<type>/<id>.json`, holding `type`, `id`, `name`, and
  `stats` (`schemas/primitive.schema.json`). The path must match, and a
  primitive has no `summary`, `meta`, `tags`, `description`, or `image`: it
  is an SRD rule, reproduced unmodified.
- **Extensions** are custom rules: ordinary entries under
  `content/<ruleset>/<type>/`, whose `stats` validate against the same type
  schema as a primitive's. Only a type that takes extensions may have them,
  it needs a registry entry for their cards, and an extension is always
  custom, so `meta.source.srd` on one is an error.
- **One key space per type.** A key (`<type>/<id>`) is unique across a
  type's primitives, groups, and extensions, and so is a name, ignoring case.
- **Validated like entries:** the type schema, the markdown subset, refs and
  `{ref:…}` tokens, the blocklist, and placeholders; the ruleset's checks run
  with their warnings skipped, as for an SRD entry. A primitive's and a
  group's links count for back-references. Every registered ruleset's rules
  data is validated, whether or not an entry uses it.
- **Link targets.** A primitive or group is linked like an entry, by a ref
  object or a `{ref:…}` token, and the link renders as its name, linked to
  its anchor on its rules page ([References](content-model.md#references)).

`lib/rules.ts` places rules data on pages and is shared by the validator
(`scripts/validate/rules.ts`) and the site (`site/src/lib/rules.ts`).

### Rules groups

A rules type may group its primitives in `rules/<type>-groups.json`
(`schemas/rules-groups.schema.json`): a list, in page order, of groups with
an `id`, a `name`, and optionally a `qualifier` (a short form), a `parent`,
a `note` printed in parentheses after the heading, and `text`, prose that
opens the group's section. A group's key is `<type>/<id>`, a link target
like a primitive's.

- A group with no `parent` is a category. Parents must exist and never loop.
- A primitive or extension of a grouped type names its **leaf group**, one
  with no groups in it, in `stats.group`, and belongs to that group and every
  ancestor.
- A **union** group lists other groups in `union` and has no members or
  groups of its own. Its members are theirs, and its section lists them as
  links. It may have a `parent`, which places it in that tree.
- Groups are closed: extensions add members, not groups.

### Rules pages

`rules/pages.json` (`schemas/rules-pages.schema.json`) lists the ruleset's
rules pages in order. Each has an `id`, its URL segment, a `title`, and
`blocks` in order:

| Block | Shows |
|---|---|
| `{ "kind": "prose", "title", "text", "sections" }` | SRD chapter text that isn't a primitive, word for word, with nested sections |
| `{ "kind": "primitives", "type" }` | Every primitive of a type that has no groups, by name |
| `{ "kind": "group", "group": "<type>/<id>" }` | A group's tree: its section, then its members (a leaf) or the groups nested in it, with union groups last |

Every primitive and group appears on exactly one page, and the validator
names any that appear on none or on several. `extensions` is not a page id;
it is the Extensions page's ([site.md](site.md#rules-pages)).

### dnd-5e-2024 derivations

Creatures derive: ability modifiers, proficiency bonus and XP from CR (XP 10 at
CR 0 when any trait or action deals damage, else 0), in-lair XP (the next CR
row's), Initiative bonus and score, the hit die from size and HP from hit dice,
saves, skills, passive Perception, each action's attack bonus, save DC, and
damage (average, modifier, and display), and the Spellcasting DC and attack
bonus. Items and spells derive nothing, except the ability modifiers and
saves of an embedded stat block ([Embedded stat blocks](#embedded-stat-blocks)).
The formulas are in `derive.ts` and the tables, including the SRD CR table, in
`tables.json`, which cites the SRD section it comes from.

### Shared definitions

`schemas/common.schema.json` holds the definitions the type schemas share:
abilities, dice, damage, proficiency levels, adjustments, damage types, refs
(`Ref`, `RefOrText`, and the typed `ConditionRef`, which allows only condition
keys), rules text (`Text`), and the embedded `StatBlock`. Each definition's shape and meaning is in its `description`.

### Text tokens

Creature prose (`text`, `onHit`, `onFailure`, `onSuccess`, `onFailureOrSuccess`,
`spellcasting.note`, `legendaryActions.intro`) may show a derived value only
through a token. `tokens.ts` renders tokens from the same derivations as the
stat block.

| Token | Renders | Example |
|---|---|---|
| `{mod:<ability>}` | Ability modifier | `+2` |
| `{pb}` | Proficiency bonus | `+2` |
| `{atk:<ability>[:<adjust>]}` | PB + modifier (+ adjust) | `+4` |
| `{dc:<ability>[:<adjust>]}` | 8 + PB + modifier (+ adjust) | `DC 12` |
| `{dc=<n>}` | An authored DC, as written | `DC 5` |
| `{dmg:<dice>[+<ability>][:<type>]}` | Average, dice, and type | `7 (2d6) Fire damage` |

- An unknown token, ability, or damage type is a validation error.
- A literal number that looks derived in creature prose is an error, and the
  message names the token to use. The patterns caught are `DC <n>`,
  `+<n> to hit`, and `<n> (<dice>)`.
- A DC the rules leave to the author, such as an ability check's ("a
  {dc=12} Strength (Athletics) check") or a base in a formula ("({dc=5} plus
  the damage taken)"), uses `{dc=<n>}`, which marks the number as authored so
  the literal check stays strict. A save DC from one of the creature's
  abilities always uses `{dc:<ability>}`. Each authored DC is listed as a
  warning for the reviewer.
- `{ref:…}` is not a ruleset token; the token parser leaves it alone
  ([content-model.md](content-model.md#references)).
- Spell and item text is exempt, because its numbers are authored. A
  custom item's text must still not restate `saveDc` or `attackBonus`, since
  the template renders them (warning). An SRD item's text is verbatim and may.

### Creatures

`schemas/creature.schema.json` describes each field. The stat block follows
SRD 5.2:

- **Condition immunities are links.** The Immunities line prints damage
  types, then a semicolon, then each condition immunity as the condition's
  name linked to its section on the Conditions page, with a ref's `note` in
  parentheses: "Poison; Charmed (with Mind Blank), Exhaustion"
  ([Conditions](#conditions)).

- **Attack and save lines are generated** from structured fields, never
  written as prose: `*Melee Attack Roll:* +4, reach 5 ft. *Hit:* 6 (1d8 + 2)
  Piercing damage plus 3 (1d6) Fire damage.` and `*Dexterity Saving Throw:* DC
  12, each creature in a 15-foot Cone. *Failure:* 10 (3d6) Fire damage.
  *Success:* Half damage.` Kind-specific requirements (an ability and reach on
  melee attacks, `save` on saves, `text` only on `other`, `attackNote` only on
  attacks) are enforced in the schema.
- **Damage.** The first damage entry is the primary; the rest render as "plus"
  riders. A rider with a `condition` renders ", plus … <condition>": "5 (1d6 +
  2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had
  Advantage." Flat damage prints the number alone ("1 Piercing damage"), and a
  `note` in place of a type prints after "damage".
- **An attack note** prints in parentheses after the bonus: "+4 (with
  Advantage if the target is Grappled by the bugbear), reach 10 ft. or range
  20/60 ft."
- **Spellcasting** renders as the 5.2 "Spellcasting" action: "The
  <shortName> casts one of the following spells, using <Ability> as the
  spellcasting ability (spell save DC <n>):". `shortName` defaults to the last
  word of `name`, lowercased. `noComponents` adds "requiring no <components>
  components and" before "using"; `includeAttack` adds the spell attack bonus;
  `noSaveDc` leaves the DC out, and an empty parenthetical is dropped with the
  colon following "ability". Spellcasting displays under Actions, after the
  other actions.
- **Legendary Actions** open with one paragraph: the italic uses line, then
  `intro`: "*Legendary Action Uses: 3 (4 in Lair).* Immediately after …".
- A creature with only a Reaction (the Shrieker Fungus) has no Actions
  section.

### Creature display forms

- Negative numbers and subtractions print U+2212 (`−`): `−1 (9)`,
  `17 (5d8 − 5)`. Tokens render the same way. This is display only: derived
  values, `library.json`, and export bundles keep numbers and ASCII formulas
  such as `2d6 - 2`.
- The Speed line prints `walk`, then Burrow, Climb, Fly, and Swim, then `note`.
  The Senses line prints Blindsight, Darkvision, Tremorsense, and Truesight,
  separated by commas, then `note` in parentheses, then a semicolon before
  Passive Perception: `Darkvision 120 ft. (unimpeded by magical Darkness);
  Passive Perception 13`. The order is fixed, whatever the JSON key order.
- The Languages line joins, with semicolons, the `spoken` list
  (comma-separated), the `understood` clause, and telepathy, with `note` in
  parentheses after the line. `understood` joins as an English list ("Elvish
  and Sylvan", "Abyssal, Common, and Infernal"). The clause is "Understands …
  but can't speak" when nothing is spoken, and "understands … but can't speak
  it" (or "them") after a spoken list. With nothing at all, the line reads
  "None". Examples: `Common, Giant`; `Understands Infernal but can't speak;
  telepathy 60 ft.`; `Common; understands Giant but can't speak it`.
- A swarm's type line reads "Medium Swarm of Tiny Beasts", with the type plural
  ("Undead" and "Fey" stay as they are).
- The Spellcasting action puts the intro, each spell list, and `note` on lines
  of their own: "At Will:", then "3/Day Each:", "2/Day Each:", "1/Day Each:". A
  level with one spell drops "Each" ("1/Day: Fireball").
- Prose after damage (`onHit`, `onFailure`) that starts lowercase continues the
  damage sentence after a comma; prose starting with a dash (`—`) joins the
  damage directly; anything else follows as a new sentence.
- `uses` is title-cased, including the word after a slash, with minor words
  (`a`, `an`, `and`, `at`, `by`, `for`, `in`, `of`, `on`, `or`, `per`, `the`,
  `to`, `with`) lowercase unless first: "(4/Day, or 5/Day in Lair)". Skill
  names and the alignment follow the same rule ("Sleight of Hand").
- Recharge prints in the name's parentheses as SRD 5.2 does: "Recharge 4–6",
  "Recharge 5–6", "Recharge 6", "Recharge after a Short or Long Rest",
  "Recharge after a Long Rest".

### Items

`schemas/item.schema.json` describes each field. How the card reads:

- The subtitle reads the category, then the rarity in title case ("Very
  Rare"), with `varies` as "Rarity Varies". An item with `rarityVariants`
  prints them instead, as an English list joined by "or": "Uncommon (+1), Rare
  (+2), or Very Rare (+3)". `rarity` stays `varies`, so the gallery facet,
  sort, and card treat it as other `varies` items.
- Charges read "7; regains 1d6 + 1 daily at dawn", or "12" for an item that
  never regains them. A maximum may be a rolled count, printed as written
  ("1d3").
- The spell list renders each spell with its cost ("1 charge", or "1–3
  charges" for a variable cost) and its authored DC or attack bonus.

### Conditions

`condition` is a rules type that takes extensions
([Rules data](#rules-data)). The 15 SRD conditions are primitives in
`rules/condition/`, shown on the Conditions page (`rules/pages.json`), and
there is no condition enum or table. A custom condition is an entry under
`content/dnd-5e-2024/condition/`, authored from a request like any content,
shown as a card, and listed on the Conditions page and the Extensions page.

`schemas/condition.schema.json` stores only `effects`, each a `name` and its
rules `text`. The template opens with the sentence every SRD condition
prints, worded from the name and the number of effects ("While you have the
Poisoned condition, you experience the following effect."), then prints each
effect as a bold-italic titled paragraph: "***Speed 0.*** Your Speed is 0 and
can't increase." A condition's text links the other conditions it names
("You have the Incapacitated condition"). Conditions derive nothing and have
no consistency checks, facets, or gap buckets.

A field that takes a condition takes a `ConditionRef`: a creature's
`immunities.conditions`, where a qualifier goes in the ref's `note`
("Charmed (with Mind Blank)").

### Spells

`schemas/spell.schema.json` describes each field. How the card reads:

- The level line words the level as SRD 5.2 does: "Level 1 Evocation
  (Sorcerer, Wizard)", or "Evocation Cantrip (Sorcerer, Wizard)" at level 0.
- A reaction or bonus action with a trigger reads "Reaction, which you take
  …" with the trigger rendered inline as rules text, so a spell name in it can
  be italic. A casting-time `note` prints after the unit: "Action (Overgrowth)
  or 8 hours (Enrichment)".
- Ranges read "60 feet", "1 mile", or "500 miles". Durations read
  "Instantaneous", "Until dispelled", "Until dispelled or triggered",
  "Special", "1 hour", "Up to 8 hours", or "Concentration, up to 1 minute".
- The material component prints `m.text` exactly as written, including any
  cost and "which the spell consumes". `costGp` and `consumed` are data for
  filters and checks, and add no words.

### Embedded stat blocks

Some spells and items print a creature's stat block. One that also exists in
the SRD as its own creature, such as the Zombie that Animate Dead raises, is a
creature entry, and the spell or item links to it with a `{ref:creature/<id>}`
token. One printed only inside its spell or item, such as Summon Dragon's
Draconic Spirit, goes in `statBlocks`. It isn't an entry: it has no ID, file,
page, or gallery card, so its name never collides with an entry's, and the SRD
manifest doesn't list it. Custom entries follow the same rule.

An embedded block is authored as printed, because its numbers often scale with
the spell's level or depend on the caster ("AC 14 + the spell's level"), which
the creature derivations can't express. Only its ability modifiers and saves
are derived. The card renders each block after the rules text with the creature
stat block's parts ([site.md](site.md#templates)).

### Consistency checks

`checks.ts` runs after schema validation. These are the `dnd-5e-2024` checks;
the checks for every type are in
[content-model.md](content-model.md#validation). The validator skips the
warnings below on an SRD entry.

| Type | Check | Level |
|---|---|---|
| Creature | Every token is known and well-formed | error |
| Creature | No literal derived numbers in prose | error |
| Creature | Speeds are multiples of 5 | error |
| Creature | A damage `condition` only on a rider, not the first damage | error |
| Creature | Any `adjust`, damage `bonus`, or token adjustment | warning |
| Creature | Any authored DC token `{dc=<n>}` | warning |
| Creature | Derived attack bonus above +17 or save DC above 30 | warning |
| Item | `baseItem` present for `armor` and `weapon` | error |
| Item | `rarityVariants` only when `rarity` is `varies` | error |
| Item | `attunement.requirement` only when `required` is true | error |
| Item | `spells[].chargeCost` only when `charges` is present | error |
| Item | `spells[].maxChargeCost` only with `chargeCost`, and above it | error |
| Item | `effect` restates a `saveDc` or `attackBonus` value | warning |
| Spell | `duration.concentration` only on a `timed` duration | error |
| Spell | A `timed` duration has `amount` and `unit` | error |
| Spell | `duration.upTo` only on a `timed` duration without concentration | error |
| Spell | A `distance` range has `feet` or `miles`, not both; no other kind has either | error |
| Spell | `components.m.consumed` requires `costGp` | error |
| Spell | `higherLevels` only at level 1 or above; `cantripUpgrade` only at level 0 | error |
| Spell | `castingTime.trigger` present on a reaction, and only on a reaction or bonus action | error |
| Spell | Cantrip marked `ritual` | warning |

Balance isn't checked by CI; it's judged in review
([generation.md](generation.md#guidelines)).

## Where the rules live

- `rulesets/module.ts`: the contract every ruleset module meets.
- `rulesets/dnd-5e-2024/`: the files in the table above.
- `site/src/lib/creature.ts`, `spell.ts`, `item.ts`, `stat-block.ts`:
  how each type's lines are worded.
- `tests/fixtures/library/valid/dnd-5e-2024/`: example entries, including the
  Cinder Hound, Frost Lance, and Wand of Frost Lances, with their rendered
  numbers checked in `tests/rulesets/dnd-5e-2024/`.

## Extending

| To add or change | Touch |
|---|---|
| A content type | In `rulesets/<ruleset>/`: a schema, a `derive` function if it has formulas, checks if needed, a guideline, and the type in `ruleset.json`. Plus a registry entry and the request form's dropdown; a template only if the generic layout doesn't fit |
| A rules type | In `rulesets/<ruleset>/`: a schema, the type under `rules` in `ruleset.json`, its primitives under `rules/<type>/`, groups if it has them, and its place in `rules/pages.json`. A type that takes extensions also gets a registry entry and a guideline |
| A ruleset | A new `rulesets/<ruleset>/` folder, registry entries, an attribution statement, and a licensing review ([licensing.md](licensing.md#new-rulesets)) |
| A rules formula or table | `tables.json` or `derive.ts`; every entry picks it up on the next build |
