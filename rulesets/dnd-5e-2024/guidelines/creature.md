# Creature guideline (dnd-5e-2024)

How to write a `creature` entry. The schema is `schemas/creature.schema.json`
and SPEC.md §6.5 lists every field. This file covers what the schema can't:
voice, names, balance, prose, and when a creature needs a dependency entry.

## Tone and voice

- Write like a field guide kept by people who have met the creature and
  survived. Concrete, sensory, a little wry; never purple.
- `summary` is one plain sentence that says what the creature is and the one
  thing it does that a table will remember. No rules terms, no numbers.
- `description` is lore: where it lives, how it behaves, what locals say or do
  about it. Two to four sentences. No mechanics, which belong in `stats`.
- Mechanics read as SRD 5.2 rules text: present tense, second-person-free,
  the creature named as "the <creature>" (for example "the toad").
- Keep each creature to one clear idea. A fire hound breathes embers and
  tracks smoke; it does not also teleport and charm.

Exemplar (summary, description, and one trait):

> **Rimeback Toad.** A bloated marsh toad whose back sweats a crust of frost.
>
> Fen-dwellers scrape the rime from these toads to chill their cellars, and
> lose a finger now and then to the trouble. In a hard winter they gather in
> the reeds by the dozen, and the water around them freezes in rings.
>
> **Rime Crust.** When a creature hits the toad with a melee attack while
> within 5 feet of it, the attacker must succeed on a {dc:con} Constitution
> saving throw or take {dmg:1d6:cold} and have its Speed halved until the end
> of its next turn.

## Naming

- Names are original and evocative: a compound or a descriptor plus a noun
  ("Rimeback Toad", "Cinder Hound", "Lantern Eel"). Title case, at most
  80 characters.
- No real-world trademarks, brands, or real people.
- No proper noun that isn't in SRD 5.2: no named planes, gods, settings,
  characters, or product-identity monsters. `config/blocklist.json` is checked
  by the validator, but it is a floor, not the whole rule; a name that would
  only be recognized from a non-SRD book is out even if it isn't listed.
- Stay clear of SRD creature names. Don't reuse one, and don't make a near
  collision: a one-word swap ("Ice Troll" for an SRD troll) or a near spelling
  is too close. A new name should not make a reader think of a specific SRD
  stat block.
- The `id` is the slug of the name and never changes. On a collision with an
  existing name or id, pick a different name; never add a number.
- `descriptors` (the parenthetical tags such as "Wizard") follow the same
  rules.

## Balance targets

These are this library's own targets, not SRD tables. CI doesn't enforce them;
review does (SPEC.md §6.8). Aim for the row of the entry's `cr`. Missing one
column is fine when another makes up for it: a high AC with HP at the bottom of
the range, or a strong save effect with damage per round below the range.

| CR | AC | HP | Attack bonus | Damage per round | Save DC |
|---|---|---|---|---|---|
| 0 | 10–12 | 1–6 | +2 to +3 | 0–1 | 10–11 |
| 1/8 | 11–12 | 7–20 | +3 | 2–3 | 11 |
| 1/4 | 11–13 | 15–35 | +3 to +4 | 4–5 | 11–12 |
| 1/2 | 12–13 | 25–50 | +3 to +4 | 6–8 | 11–12 |
| 1 | 13 | 35–70 | +4 | 9–14 | 12 |
| 2 | 13 | 50–85 | +4 to +5 | 15–20 | 12–13 |
| 3 | 13–14 | 65–100 | +5 | 21–26 | 13 |
| 4 | 14 | 80–115 | +5 to +6 | 27–32 | 13–14 |
| 5 | 15 | 100–135 | +6 to +7 | 33–38 | 14–15 |
| 6 | 15 | 115–150 | +6 to +7 | 39–44 | 14–15 |
| 7 | 15 | 135–170 | +6 to +7 | 45–50 | 14–15 |
| 8 | 16 | 150–185 | +7 | 51–56 | 15 |
| 9 | 16 | 165–200 | +7 to +8 | 57–62 | 15–16 |
| 10 | 17 | 180–215 | +7 to +8 | 63–68 | 15–16 |
| 11 | 17 | 195–230 | +8 | 69–74 | 16 |
| 12 | 17 | 210–245 | +8 | 75–80 | 16 |
| 13 | 18 | 225–260 | +8 to +9 | 81–86 | 16–17 |
| 14 | 18 | 240–275 | +9 | 87–92 | 17 |
| 15 | 18 | 255–290 | +9 to +10 | 93–98 | 17–18 |
| 16 | 18 | 270–305 | +10 | 99–104 | 18 |
| 17 | 19 | 285–320 | +10 to +11 | 105–110 | 18–19 |
| 18 | 19 | 300–335 | +11 | 111–116 | 19 |
| 19 | 19 | 315–350 | +11 to +12 | 117–122 | 19–20 |
| 20 | 19 | 330–400 | +12 | 123–140 | 20 |
| 21 | 19 | 400–445 | +12 | 141–158 | 20 |
| 22 | 19 | 445–490 | +12 to +13 | 159–176 | 20–21 |
| 23 | 19 | 490–535 | +13 | 177–194 | 21 |
| 24 | 19 | 535–580 | +13 | 195–212 | 21 |
| 25 | 19 | 580–625 | +13 to +14 | 213–230 | 21–22 |
| 26 | 19 | 625–670 | +14 | 231–248 | 22 |
| 27 | 19 | 670–715 | +14 | 249–266 | 22 |
| 28 | 19 | 715–760 | +14 to +15 | 267–284 | 22–23 |
| 29 | 19 | 760–805 | +15 | 285–302 | 23 |
| 30 | 19 | 805–850 | +15 to +17 | 303–320 | 23–25 |

**Meet the targets by choosing inputs.** Only AC is written as a number
(`ac.value`, an authored value). Everything else in the table is derived by
the ruleset (SPEC.md §6.1), so never write it; pick the inputs it follows from:

- **Attack bonus and save DC** follow from `cr` (which sets the proficiency
  bonus) and the action's `ability` score. A save DC is always the attack
  bonus for the same ability plus 8. To raise both, raise the ability score;
  each +2 to the score adds +1. Reach for `adjust` only for a deliberate
  deviation such as a magic weapon, and explain it in the PR body.
- **HP** follows from `hitDice`, the first `size` (which sets the die), and
  CON. Each hit die adds the die's average plus the CON modifier: d4 2.5,
  d6 3.5, d8 4.5, d10 5.5, d12 6.5, d20 10.5. Choose `hitDice` so the total
  lands in the row's range; change CON before changing size.
- **Damage per round** is the average damage of what the creature does in a
  typical round: its Multiattack, or its best action, plus any bonus action it
  can use every round. A damage roll's average is the dice average plus the
  ability modifier when `ability` is set. A recharge action counts at its full
  value for the first round only; use the routine round to judge the row.
- **Save DC column** applies to the creature's save actions and to
  `spellcasting`, whose DC is derived the same way.

Keep derived attack bonuses at +17 or below and DCs at 30 or below; above that
the validator warns.

## Prose style

Attack and save lines are generated from the structured fields (SPEC.md §6.5),
so never write them as prose. An attack action sets `kind`, `ability`, `reach`
or `range`, and `damage`; a save action sets `ability`, `save`, and `damage`.
The template renders "*Melee Attack Roll:* +4, reach 5 ft. *Hit:* …" and
"*Dexterity Saving Throw:* DC 12, … *Failure:* … *Success:* …" from them.

What you write:

- **`onHit`**: what happens after the damage, as full sentences. "The target
  has the Grappled condition (escape DC 13)" is wrong because the DC is
  derived; write "The target has the Grappled condition (escape {dc:str})."
- **`onFailure`**: what happens on a failed save beyond the listed damage.
- **`onSuccess`**: the success line, usually "Half damage." Omit it when a
  success means nothing happens.
- **`text`** (`kind: other` only): the full rules text of a trait, a
  Multiattack, or an effect with no attack or save line of its own. A
  Multiattack reads "The toad makes two Bite attacks." and names the actions
  exactly as they appear in the entry.
- **`spellcasting.note`** and **`legendaryActions.intro`**: one or two
  sentences that the generated lines don't already say. The template already
  writes the spellcasting ability, DC, and spell lists, and the Legendary
  Action Uses line.

Rules for all of these:

- Match SRD 5.2 phrasing. Conditions and damage types read as game terms:
  "has the Prone condition", "takes Fire damage", "its Speed is halved". Use
  "Bloodied" for "at half its hit points or fewer".
- **Every derived number is a token.** A literal "DC 13", "+5 to hit", or
  "7 (2d6)" in creature prose fails validation. The tokens, from `tokens.ts`
  (SPEC.md §6.4):

  | You mean | Write | Renders like |
  |---|---|---|
  | The CON modifier | {mod:con} | +2 |
  | The proficiency bonus | {pb} | +2 |
  | An attack bonus with STR | {atk:str} | +4 |
  | A STR attack bonus with a +1 deviation | {atk:str:1} | +5 |
  | A save DC based on CON | {dc:con} | DC 12 |
  | Damage with no modifier | {dmg:2d6:fire} | 7 (2d6) Fire damage |
  | Damage plus the STR modifier | {dmg:1d8+str:piercing} | 6 (1d8 + 2) Piercing damage |

  Name the save's ability in words after a DC token: "a {dc:wis} Wisdom saving
  throw". A token with an adjust (`{atk:str:1}`) is a deviation like `adjust`
  and needs the same explanation in the PR body.
- Numbers the author chooses stay literal: distances ("within 30 feet"),
  durations ("until the end of its next turn"), counts ("two Bite attacks"),
  and recharge or uses, which go in `recharge` and `uses`, not in the name or
  the text.
- Markdown subset only (SPEC.md §5.5): paragraphs, bold, italic, lists. No
  headings, links, or tables in entry text. Italicize spell names: *Frost
  Lance*.
- Every brace in entry text starts a token. Don't use braces for anything else.

## Dependencies and SRD references

A creature mentions spells (`spellcasting`) and gear (`gear`) through
`RefOrText` fields: a ref to a library entry, or a plain string.

- **Ref an existing library entry** whenever one matches what the creature
  uses. Check `library.json` for it before writing anything new.
- **Use a plain string** for SRD 5.2 content that isn't in the library, spelled
  exactly as the SRD names it ("Fireball", "Longsword", "Chain Mail"). Never
  copy an SRD spell or item into the library to ref it.
- **Create a dependency entry** in the same batch when the brief or the
  creature's concept calls for something new: a signature spell no SRD spell
  covers, or a named magic item the creature carries. Write it to its own
  guideline (`spell.md`, `magic-item.md`) and ref it with its `<type>/<id>`,
  such as `spell/frost-lance`.
- Don't create a dependency for a one-off effect. If only this creature will
  ever use it and it fits in a trait or action, write it as a trait or action.
- A plain string is never a non-SRD name. The blocklist applies to it like any
  other text.
