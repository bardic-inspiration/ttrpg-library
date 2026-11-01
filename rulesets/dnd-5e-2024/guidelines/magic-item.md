# Magic item guideline (dnd-5e-2024)

How to write a `magic-item` entry. The schema is
`schemas/magic-item.schema.json` and SPEC.md §6.6 lists every field. This file
covers what the schema can't: voice, names, balance, prose, and when an item
needs a dependency entry.

## Tone and voice

- An item is a thing someone made, carried, and lost. Let the `description`
  say who made it, what it looks and feels like, and one rumor or habit that
  clings to it. Two to four sentences, no mechanics.
- `summary` is one plain sentence: what the item is and what it does, in words
  a player would use at the table. No rarity, no numbers.
- `effect` is rules text and reads like SRD 5.2: second person ("While you
  wear this cloak, you …"), present tense, plain.
- Prefer one clear power over a list of small ones. A common or uncommon item
  does one thing.

Exemplar (summary, description, and effect):

> **Tidewatch Compass.** A brass compass whose needle points toward the
> nearest open water.
>
> Harbor pilots pass these compasses from hand to hand, and none will say who
> made the first. The needle trembles before a storm, and old sailors swear it
> sulks when carried too far inland.
>
> While holding this compass, you always know the direction and approximate
> distance to the nearest body of water at least 10 feet across within
> 1 mile of you. As a Magic action, you can tap the glass to learn whether
> the weather within 1 mile of you will turn stormy in the next 8 hours.

## Naming

- Names are original and evocative: an object plus a quality, place, or effect
  ("Tidewatch Compass", "Wand of Frost Lances", "Cloak of Quiet Steps"). Title
  case, at most 80 characters.
- No real-world trademarks, brands, or real people.
- No proper noun that isn't in SRD 5.2, and no item named for a person.
  Personal-name prefixes are how product-identity items are named, and the
  known ones are in `config/blocklist.json`, which the validator checks; the
  list is a floor, not the whole rule.
- Stay clear of SRD item names. Don't reuse one, and don't make a near
  collision by swapping one word or pluralizing ("Boots of Striding" next to an
  SRD item of nearly that name). An item that does what an SRD item does is a
  duplicate; ref or name the SRD item instead.
- A weapon or armor item names its kind in `baseItem` ("Longsword", "any
  medium armor"), not only in its name.
- The `id` is the slug of the name and never changes. On a collision, pick a
  different name; never add a number.

## Balance targets

These are this library's own targets, not SRD tables. CI doesn't enforce them;
review does (SPEC.md §6.8). Choose `rarity` from what the item does, not the
other way round.

| Rarity | Flat bonus (attack, damage, AC, saves) | Spells it casts (highest level) | Spell save DC / spell attack bonus | Extra damage per hit | Charges |
|---|---|---|---|---|---|
| common | none | a cantrip, or a 1st-level spell once per day | 13 / +5 | none | up to 3 |
| uncommon | +1 | 2nd | 13 / +5 | 1d4 | up to 7 |
| rare | +2 | 4th | 15 / +7 | 1d6 | up to 10 |
| very-rare | +3 | 6th | 17 / +9 | 2d6 | up to 20 |
| legendary | +3, plus a second strong property | 9th | 18 / +10 | 3d6 | up to 50 |

- **common**: utility and flavor. No bonus to attacks, AC, or saves, and no
  damage. Good for light, comfort, signals, small tricks.
- **uncommon**: a modest edge in combat or a strong utility power used a few
  times a day.
- **rare**: a defining tool for a character for several levels.
- **very-rare**: reshapes how a character fights or explores.
- **legendary**: a campaign centerpiece. Usually requires attunement.
- **artifact**: only when a request asks for one. Artifacts sit outside this
  table.
- **varies**: only for an item family whose versions differ in rarity, with
  each version's rarity stated in `effect`.

More guidance:

- **Attunement.** Any item with a flat bonus of +2 or more, a spell of 3rd
  level or higher, or a power usable at will in combat requires attunement.
  Set `attunement.requirement` only to limit who can attune ("by a
  spellcaster").
- **Charges.** Recharge on a die roll at dawn ("1d6 + 1 daily at dawn"), with
  the recharge no more than half of `max`. A `depletion` risk ("roll 1d20; on
  a 1, the wand crumbles") suits wands and staffs.
- **Spells.** `spells[].saveDc` and `spells[].attackBonus` are authored and
  come from this table. Omit them when the item uses the wielder's own save DC
  or spell attack bonus, and say so in `effect`.
- **Cursed.** A cursed item still has a real benefit, and the curse is a cost
  worth weighing. Set `cursed` and describe the curse in `effect`.

## Prose style

`effect` is the rules text as printed. Item text has no tokens: its numbers are
authored, so write them as numbers.

- Open with the condition of use: "While you wear this ring, …", "While
  holding this wand, you can …", "You can drink this potion as a Bonus Action
  …".
- Use SRD 5.2 action names and game terms: Magic action, Bonus Action,
  Reaction, Short or Long Rest, the Invisible condition, Fire damage.
- **Don't restate structured fields.** The template renders `spells` with their
  charge cost, save DC, and attack bonus, and the charges line from `charges`.
  `effect` says what spending a charge does ("you can expend 1 of its charges
  to cast *Frost Lance* from it") without repeating the DC or attack bonus; a
  repeated value is a validator warning.
- The `charges.depletion` text is its own field. Don't repeat it in `effect`.
- Markdown subset only (SPEC.md §5.5): paragraphs, bold, italic, lists. No
  headings, links, or tables. Italicize spell names: *Frost Lance*.
- Don't use braces in item text. Tokens are a creature feature and don't
  render here.

## Dependencies and SRD references

`spells[].spell` is a `RefOrText` field: a ref to a library spell, or a plain
string.

- **Ref an existing library spell** whenever the item casts one. Check
  `library.json` first.
- **Use a plain string** for an SRD 5.2 spell, spelled exactly as the SRD
  names it ("Fireball", "Cure Wounds"). Never copy an SRD spell into the
  library to ref it.
- **Create a spell entry** in the same batch when the item's power is a new
  spell that others could also cast or carry ("Wand of Frost Lances" casts the
  new *Frost Lance*). Write it to `spell.md` and ref it as `spell/<id>`.
- **Write the power into `effect`** instead when it belongs only to this item
  and isn't a spell anyone would learn.
- `baseItem` and any item named in `effect` use SRD names. The blocklist applies
  to every plain string.
