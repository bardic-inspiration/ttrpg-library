---
issue: 398
depends: [ui]
---

# Characters

## Goal

A **character** is a ready-made build: a pregenerated character a module
offers, or one a DM runs. v1.2.0 adds the type, its presets, and a profile
page. Its values come from refs to library entries plus a few inputs, and
the ruleset derives the rest. It serves P3 (derived values are never
stored), P2 (only legal builds validate), and P7 (generation writes choices,
not arithmetic).

The character sheet builder, user-owned characters, and editing are v2.0.0
(#370). A preset has the shape a v2.0.0 user character will have; v2.0.0
adds owners and editing, not a second type.

## Current

- [Inputs and derived values](../../docs/rulesets.md#inputs-and-derived-values)
  and [Consistency checks](../../docs/rulesets.md#consistency-checks).
- [Classes](../../docs/rulesets.md#classes): class data (proficiencies,
  `multiclass`, `spellcasting`, features by level).
- [Species](../../docs/rulesets.md#species),
  [Backgrounds](../../docs/rulesets.md#backgrounds),
  [Feats](../../docs/rulesets.md#feats), and
  [Equipment](../../docs/rulesets.md#equipment).
- [Characters](../../docs/rulesets.md#characters): the type, its inputs,
  and its derivations from the entries it names, on the shared
  `deriveLinked` path.
- [Creatures](../../docs/rulesets.md#creatures): the stat block type, which
  stays apart.
- [The generate skill](../../docs/generation.md#the-generate-skill).

## Design

### Modifiers

A feature that changes a derived value declares its effect as data, so a
character needs no `adjust` for it. `class-feature`, `feat`, and
`species-trait` stats get an optional **`modifiers`** array. Each modifier
has a `kind` from a closed vocabulary that the schema validates. The
character's derivations collect the modifiers of every entry it references
at its levels (class and subclass features up to each class's level, its
feats, and its species' traits) and apply them.

A modifier's fields share these forms:

- **`value`:** a number, `"proficiency"` (the Proficiency Bonus), or an
  ability key for that ability's modifier, with an optional `min`.
- **`byLevel`:** in place of `value`, a value by the level of the class the
  feature belongs to, from the feature's table.
- **`while`:** the conditions it applies under, all of which must hold:
  `unarmored` (no armor equipped), `armored` (Light, Medium, or Heavy armor
  equipped), `no-heavy-armor`, and `no-shield`. Omitted, it always applies.
- **`weapon`:** which equipped weapons it applies to: `ranged`, `melee`,
  `one-handed-melee` (a melee weapon wielded in one hand and no other
  weapon), or `monk` (Simple Melee weapons and Martial Melee weapons with
  the Light property).
- Abilities and skills use the keys `common.schema.json` defines (`dex`,
  `history`); speed modes are `climb`, `swim`, and `fly`.

The kinds:

| Kind | Example | Derives |
|---|---|---|
| `ability-bonus` | Primal Champion: `{ "kind": "ability-bonus", "abilities": ["str", "con"], "value": 4, "max": 25 }`. A chosen increase gives `total` points in place of `abilities` and `value`, with an optional `from`, and the character's feat choice places them: Ability Score Improvement `{ "kind": "ability-bonus", "total": 2, "max": 20 }`, Boon of Irresistible Offense `{ "kind": "ability-bonus", "total": 1, "max": 30, "from": ["str", "dex"] }` | Final ability scores |
| `ac-formula` | Unarmored Defense: `{ "kind": "ac-formula", "base": 10, "abilities": ["dex", "con"], "while": ["unarmored"] }` | AC: the highest formula that applies wins, the equipped armor's included |
| `ac-bonus` | Defense: `{ "kind": "ac-bonus", "value": 1, "while": ["armored"] }` | AC |
| `save-proficiency` | Slippery Mind: `{ "kind": "save-proficiency", "abilities": ["wis", "cha"] }`; Disciplined Survivor: `"abilities": "all"` | Saving throws |
| `save-bonus` | Aura of Protection: `{ "kind": "save-bonus", "value": "cha", "min": 1 }` | Saving throws |
| `skill-proficiency` | A feature that names its skill: `{ "kind": "skill-proficiency", "skills": ["history"], "expertise": true }` | Skills and Passive Perception |
| `skill-floor` | Jack of All Trades: `{ "kind": "skill-floor", "proficiency": "half" }` | Skills, Passive Perception, and Initiative (a Dexterity check) |
| `initiative-bonus` | Alert: `{ "kind": "initiative-bonus", "value": "proficiency" }` | Initiative |
| `speed-bonus` | Fast Movement: `{ "kind": "speed-bonus", "value": 10, "while": ["no-heavy-armor"] }`; Unarmored Movement: `"byLevel"` and `"while": ["unarmored", "no-shield"]` | Speed |
| `speed-mode` | Roving: `{ "kind": "speed-mode", "modes": ["climb", "swim"] }`, each equal to the Speed | Other speeds |
| `hp-per-level` | Dwarven Toughness: `{ "kind": "hp-per-level", "value": 1 }`; Draconic Resilience: `"per": "class"`, for each level of its class rather than each character level | Hit Points |
| `attack-ability` | Martial Arts: `{ "kind": "attack-ability", "abilities": ["dex"], "weapon": "monk", "while": ["unarmored", "no-shield"] }`, usable in place of Strength when higher | Attacks |
| `attack-bonus` | Archery: `{ "kind": "attack-bonus", "value": 2, "weapon": "ranged" }` | Attacks |
| `damage-bonus` | Dueling: `{ "kind": "damage-bonus", "value": 2, "weapon": "one-handed-melee" }` | Attacks |
| `damage-die` | Martial Arts: `{ "kind": "damage-die", "byLevel": { … }, "weapon": "monk", "while": ["unarmored", "no-shield"] }`, used when larger than the weapon's | Attacks |

A choice a feature offers, such as a skill or Expertise of the character's
choosing, is a pick in `choices`, not a modifier.

**Not modeled:** effects that depend on the situation, a choice made in
play, or something the profile doesn't derive, such as Great Weapon
Fighting's rerolls, Rage and what it enables, Advantage on Initiative,
Two-Weapon Fighting, the Pact of the Blade weapon, and spell damage
(Agonizing Blast). They stay as text only, and a character that wants a
number from one uses `adjust` (warning), as now. A new kind is an amendment
to this spec.

**Migration:** the pilot adds `modifiers` to the SRD class features, feats,
and species traits that have one of these effects, as part of its PR.

### Validation

Only legal builds under `dnd-5e-2024` validate. New consistency checks
(errors unless noted):

| Check |
|---|
| Each base score is 8 to 15, and the point costs total 27 or less |
| The background's increases are +2/+1 or +1/+1/+1, only among its three abilities |
| No final score above 20 |
| Class levels total 1 to 20; no class repeats |
| With more than one class, each class's multiclass prerequisite is met by the final scores, the starting class's included |
| A subclass belongs to its class and is present exactly when the class's level reaches its subclass level |
| One feat from the background, which is its origin feat, and one origin feat from a species trait that grants one (Human's Versatile); each other feat comes from a class level that grants one, meets its prerequisite, and only a repeatable feat repeats |
| Options and choices fill exactly the counts their sources allow at the character's levels |
| Each spell is on a list of one of its classes, at a level its slots can cast, and cantrips and prepared spells are within each class's counts |
| Equipped armor and weapons the character lacks proficiency with (warning) |
| Any `adjust` (warning), as on creatures |

`adjust` covers a deliberate deviation, as elsewhere.

### The profile

A character's page is a **profile**, not a play sheet: what a DM needs to
run the character, or a player needs to copy a preset onto their own sheet.
It has no fill-in boxes and nothing tracked at the table (current HP, spent
slots, inventory).

- **Identity:** name, species, background, and class levels with subclasses
  ("Fighter 3 (Champion) / Wizard 2").
- **Abilities:** each score, modifier, and saving throw.
- **Combat:** Armor Class, Hit Points, Initiative, Speed, proficiency bonus,
  and Passive Perception.
- **Skills and proficiencies:** skills with their bonuses, expertise
  marked; armor, weapons, tools, and languages.
- **Attacks:** one line per equipped weapon.
- **Spellcasting:** per class, ability, save DC, and attack bonus; spell
  slots; and the spell list by level, each spell linked.
- **Features:** the class, subclass, species, and feat features by name,
  each linked to its section.
- **Equipment:** what's equipped, linked.
- **Description:** the character's lore.

It's built from the shared components ([`ui.md`](ui.md)) and laid out at
390, 820, and 1440px, and in print.

### In the Library

- **Facets:** class, background, and species (ref facets), and level (a
  range, of the derived total level).
- **Card:** name, class levels, species, background, and summary.
- **Exports:** Print, PNG, and JSON, as for any type. No translator takes
  characters.

### Generation

`generate` becomes an **umbrella**: the shared steps (inputs, collisions,
validation, the PR) stay in the skill, which routes each type to a
**procedure**. Today's types keep the one procedure they have. Characters
get the first new one: choose the build's refs, buy the scores, and fill the
choices the build allows, writing choices only. Encounters and modules add
theirs ([`encounters.md`](encounters.md), [`modules.md`](modules.md)).
Characters come only by request, with no gap buckets, and every preset is
custom ([SRD and custom entries](../../docs/content-model.md#srd-and-custom-entries)).

## Cases

- A fighter-wizard multiclass: `class/fighter` 3 with `subclass/champion`
  and `class/wizard` 2, `species/dwarf`, `background/soldier` with its
  origin feat `feat/savage-attacker`, wearing `item/armor-1-2-or-3`, with
  `spell/shield` and `spell/magic-missile` prepared.
- The same build with Intelligence 12: fails the Wizard's multiclass
  prerequisite.
- A build whose point costs total 28: fails.
- A single-class `class/cleric` with `subclass/life-domain` and
  `spell/cure-wounds`, on `species/human` with `background/acolyte`: the
  simplest profile.

## Done when

- The `character` type validates, derives, and renders its profile, with
  the checks above, against the cases.
- The Library filters characters by class, background, species, and level.
- `generate` routes by type, and makes a preset from an inline request.
- The docs describe the type, its derivations, and the umbrella skill.

## Open questions

- **Modifiers: which design (#429).** "Modifiers" above and the design
  recorded in #476 differ: who migrates the SRD entries (the pilot, or #476
  after it), whether items carry `modifiers` (with `byVariant`,
  attunement, `check-bonus`, and `ability-set`), the armor condition's form
  (`while` keys, or a list of allowed armor types), Unarmored Movement's
  speed (`byLevel`, or the class table's column), and whether Jack of All
  Trades reaches Initiative (the SRD text says only skill checks). The
  character's derivations apply no modifiers until it's decided.

## Out of scope

- The character sheet builder, in-app authoring, and user-owned characters
  (v2.0.0, #370).
- Inventory and other state tracked at the table.
- Live composition of equipment from library search (v2.0.0).
