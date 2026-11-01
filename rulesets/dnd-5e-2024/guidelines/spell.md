# Spell guideline (dnd-5e-2024)

How to write a `spell` entry. The schema is `schemas/spell.schema.json` and
SPEC.md §6.7 lists every field. This file covers what the schema can't: voice,
names, balance, prose, and when a spell needs a dependency entry.

## Tone and voice

- A spell is a precise tool. `effect` is rules text and reads like SRD 5.2:
  second person ("You conjure …", "Make a ranged spell attack …"), present
  tense, exact about targets, area, and timing.
- `summary` is one plain sentence a player would use at the table: what the
  spell does and to whom. No level, no numbers.
- `description`, when present, is flavor: what casting it looks, sounds, or
  smells like, or where the spell came from. One to three sentences, no rules.
- One spell, one job. Riders support the main effect; they don't turn it into
  a second spell.

Exemplar (summary, description, and effect):

> **Lantern Swarm.** A cloud of glowing motes that outlines hidden creatures
> and stings those who stay inside it.
>
> The motes hum like bees and smell faintly of lamp oil.
>
> You fill a 20-foot Cube within range with drifting motes of light for the
> duration. The area is Dim Light. Any creature in the area that has the
> Invisible condition loses it while there. When a creature enters the area
> for the first time on a turn or starts its turn there, it makes a Dexterity
> saving throw, taking 2d6 Radiant damage on a failed save or half as much
> damage on a successful one.

## Naming

- Names are original and say what the spell does: an image plus an action or
  element ("Frost Lance", "Lantern Swarm", "Veil of Ash"). Title case, at most
  80 characters.
- No real-world trademarks, brands, or real people.
- **No person's name in a spell name**, possessive or not. Named spell prefixes
  are product identity; the known ones are in `config/blocklist.json`, which the
  validator checks, and the list is a floor, not the whole rule.
- No other proper noun that isn't in SRD 5.2.
- Stay clear of SRD spell names. Don't reuse one, and don't make a near
  collision by swapping one word or pluralizing. A spell that does what an SRD
  spell does at the same level is a duplicate; name the SRD spell instead.
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number.

## Balance targets

These are this library's own targets, not SRD tables. CI doesn't enforce them;
review does (SPEC.md §6.8). Damage is the average of the dice at the spell's
own level.

| Level | One target, attack or save | Area, save for half | Typical area |
|---|---|---|---|
| 0 | 5–6 (1d10) | 3–4 (1d6) | 5-foot Emanation |
| 1 | 10–14 (3d8) | 7–10 (2d8) | 15-foot Cone or Cube |
| 2 | 15–22 (4d10) | 11–14 (4d6) | 20-foot Cube, 10-foot-radius Sphere |
| 3 | 22–28 (5d10) | 21–28 (8d6) | 20-foot-radius Sphere, 60-foot Line |
| 4 | 28–36 (6d10) | 24–32 (7d8) | 20-foot-radius Sphere, 30-foot Cube |
| 5 | 36–44 (8d10) | 28–36 (8d8) | 30-foot-radius Sphere, 60-foot Cone |
| 6 | 44–55 (10d10) | 35–45 (10d8) | 40-foot-radius Sphere, 60-foot Cone |
| 7 | 50–62 (11d10) | 42–50 (11d8) | 40-foot-radius Sphere |
| 8 | 56–70 (12d10) | 48–58 (12d8) | 60-foot-radius Sphere |
| 9 | 70–90 (15d10) | 55–70 (15d8) | 60-foot-radius Sphere |

- **Riders cost damage.** A spell that also imposes a condition (Prone,
  Restrained, Frightened) or halves Speed deals damage about one level lower in
  the table. A spell whose main effect is a condition deals little or no
  damage.
- **Repeating damage** (each turn, under Concentration) deals about half the
  table's value per turn.
- **Area scale.** A larger area than the "Typical area" column costs damage; a
  smaller one can afford a little more.
- **Higher levels.** A leveled damage spell gains one damage die per slot level
  above its own, in `higherLevels`. Other spells add a target, extend the
  duration, or widen the area.
- **Cantrip upgrades.** A damage cantrip gains one die at character levels 5,
  11, and 17, in `cantripUpgrade`.
- **Concentration** for any spell that lasts beyond one round and keeps
  working, such as an ongoing area, a lasting buff, or a held condition.
- **Ritual** only for utility spells of 1st level or higher with no combat use.
- **Material costs.** Give a `costGp` only when the component should limit how
  often the spell is cast; set `consumed` only with a cost.

## Prose style

`effect`, `higherLevels`, and `cantripUpgrade` are rules text. Spell text has
no tokens: its numbers are authored, so write them as numbers.

- Lead with what the caster does, then targets, then the roll, then the
  results. Match SRD 5.2 phrasing:
  - Attack: "Make a ranged spell attack against a creature within range. On a
    hit, the target takes 3d8 Cold damage …"
  - Save: "Each creature in a 20-foot-radius Sphere centered on a point within
    range makes a Dexterity saving throw, taking 8d6 Fire damage on a failed
    save or half as much damage on a successful one."
  - Saves refer to "your spell save DC" only when the text needs to name it,
    such as a repeated save; never write a DC number.
- Use game terms as SRD 5.2 does: Cone, Cube, Cylinder, Emanation, Line,
  Sphere; the Prone condition; Fire damage; Speed; Bonus Action; Dim Light.
- **Don't restate structured fields.** Range, components, casting time, and
  duration render from `stats`, so `effect` doesn't repeat them, except to say
  how they apply ("for the duration", "within range").
- `higherLevels`: "The damage increases by 1d8 for each spell slot level
  above 1." `cantripUpgrade`: "The damage increases by 1d10 when you reach
  levels 5 (2d10), 11 (3d10), and 17 (4d10)."
- Markdown subset only (SPEC.md §5.5): paragraphs, bold, italic, lists. No
  headings, links, or tables. Italicize spell names: *Frost Lance*.
- Don't use braces in spell text. Tokens are a creature feature and don't
  render here.

## Dependencies and SRD references

Spells have no `RefOrText` fields, so a spell never refs another entry. It is
itself the most common dependency.

- **A spell as a dependency.** When a creature or item in the same batch needs
  a new signature spell, write it here like any other spell, and give it a
  name and power that stand on their own, since other entries may cast it too.
- **Mentioning an SRD spell** in `effect` (for example "as if it were under
  the effect of *Dispel Magic*") uses the SRD name in italics. Don't create a
  library spell just to mention it.
- **Mentioning a library spell** in prose uses its name in italics. There is
  no ref in prose; a mention is only text.
- A spell that would duplicate an existing library or SRD spell isn't written.
  Point the requesting entry at the existing spell instead.
