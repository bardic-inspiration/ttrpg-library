// The dnd-5e-2024 character profile (docs/rulesets.md#characters, docs/site.md#templates): the fixtures'
// identity, combat, abilities, skills and proficiencies, attacks, spellcasting, features, and equipment,
// on screen and in print, each value from the derived values and each entry it names linked.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { attackText } from '../../../site/src/lib/character.ts';
import { entryNames, loadLibrary, refPaths, type Entry, type LoadedEntry } from '../../../site/src/lib/library.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { textOf } from '../../site/library-fixtures.ts';
import { FIXTURES } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CONTENT = join(ROOT, 'content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (path: string) => Promise.all((await readdir(path)).sort().map((f) => readJson(join(path, f)) as Promise<Entry>));

const files: Record<string, unknown> = {};
const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
const rules = rulesData(definition, files);
/** The fixtures and the whole library, which they name; the library has no characters of its own to stand in for. */
const entries = [
  ...(await dir(join(FIXTURES, 'character'))),
  ...(await Promise.all((await readdir(CONTENT)).filter((type) => type !== 'character').map((type) => dir(join(CONTENT, type))))).flat(),
];
const all = loadLibrary(entries, [rules]);
const names = entryNames(all, [rules]);
const paths = refPaths([rules], all);

const render = async (loaded: LoadedEntry, mode: 'screen' | 'print' = 'screen') =>
  (await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...loaded, names, paths, mode } })).replace(/ data-astro-cid-\w+/g, '');
const character = (id: string) => all.find(({ entry }) => entry.type === 'character' && entry.id === id)!;

describe('the profile of a multiclass build', async () => {
  const brannoc = character('brannoc-ashguard');
  const html = await render(brannoc);
  const text = textOf(html);
  const printed = await render(brannoc, 'print');

  it('opens with its class levels and subclasses, its species and background linked', () => {
    expect(html).toContain('<p class="statblock-header__subtitle">Fighter 3 (Champion) / Wizard 2</p>');
    expect(html).toContain('<dt>Species</dt><dd><a class="ref-link" href="/dnd-5e-2024/species/dwarf/">Dwarf</a></dd>');
    expect(html).toContain('<dt>Background</dt><dd><a class="ref-link" href="/dnd-5e-2024/background/soldier/">Soldier</a></dd>');
  });

  it('shows its combat lines and each score, modifier, and saving throw', () => {
    expect(text).toContain('Armor Class 18 Hit Points 45 Initiative +0 Speed 30 ft. Proficiency Bonus +3 Passive Perception 14');
    expect(html).toContain('<tr><th scope="row">STR</th><td>17</td><td>+3</td><td>+6</td></tr>');
    expect(html).toContain('<tr><th scope="row">CHA</th><td>8</td><td>−1</td><td>−1</td></tr>');
  });

  it('lists every skill with its bonus, its proficiency and Expertise marked', () => {
    expect(html.match(/<li>[^<]+<span class="character-skills__bonus">/g)).toHaveLength(18);
    expect(text).toContain('Athletics +6 (Proficient)');
    expect(text).toContain('History +7 (Expertise)');
    expect(text).toContain('Stealth +0');
    expect(text).not.toContain('Stealth +0 (');
  });

  it('lists its proficiencies, with a later class’s multiclass text', () => {
    expect(text).toContain('Saving Throws Strength and Constitution Armor Light, Medium, and Heavy armor and Shields Weapons Simple and Martial weapons');
    expect(html).toContain('<dt>Tools</dt><dd><a class="ref-link" href="/dnd-5e-2024/rules/tools/#equipment-gaming-set">Gaming Set</a> (dice)</dd>');
    expect(html).toContain('<dt>Languages</dt><dd>Common, Dwarvish, Giant</dd>');
    expect(html).toContain('<p><em><strong>As a Multiclass Wizard.</strong></em></p>');
  });

  it('shows an attack per equipped weapon, linked, with its Versatile damage, properties, and mastery', () => {
    expect(text).toContain('Longsword. +6 to hit, 1d8 + 3 Slashing damage, or 1d10 + 3 two-handed; Versatile; Mastery: Sap');
    expect(html).toContain('<em><strong><a class="ref-link" href="/dnd-5e-2024/rules/weapons/#equipment-longsword">Longsword</a>.</strong></em>');
  });

  it('prints a negative damage modifier with the minus sign, U+2212 (docs/rulesets.md#creature-display-forms)', () => {
    const text = attackText({
      ref: 'equipment/quarterstaff',
      weapon: 'equipment/quarterstaff',
      ability: 'str',
      attackBonus: 2,
      damage: { dice: '1d6', modifier: -1, type: 'bludgeoning', display: '1d6 - 1' },
      versatile: { dice: '1d8', display: '1d8 - 1' },
      properties: [{ ref: 'weapon-property/versatile' }],
      mastery: { ref: 'mastery-property/topple' },
    });
    expect(text).toContain('+2 to hit, 1d6 \u2212 1 Bludgeoning damage, or 1d8 \u2212 1 two-handed');
  });

  it('shows the Wizard’s spellcasting, its slots, and its spells by level, linked', () => {
    expect(text).toContain('Wizard Intelligence, spell save DC 12, +4 to hit with spell attacks; 3 cantrips and 5 prepared Spell Slots 3 at level 1');
    expect(html).toContain(
      '<dt>Level 1</dt><dd><a class="ref-link" href="/dnd-5e-2024/spell/shield/">Shield</a>, <a class="ref-link" href="/dnd-5e-2024/spell/magic-missile/">Magic Missile</a></dd>',
    );
  });

  it('lists its features by source, each linked to its section, and its feats with where they came from', () => {
    expect(html).toContain('<dt>Champion</dt><dd><a class="ref-link" href="/dnd-5e-2024/subclass/champion/#class-feature-champion-improved-critical">Improved Critical</a>');
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/class/wizard/#class-feature-wizard-scholar">Scholar</a></dd>');
    expect(html).toContain('<dt>Dwarf</dt><dd><a class="ref-link" href="/dnd-5e-2024/species/dwarf/#species-trait-dwarf-darkvision">Darkvision</a>');
    expect(text).toContain('Feats Savage Attacker (Soldier), Defense (Fighter 1)');
  });

  it('lists what it has equipped, linked, with the base item and variant', () => {
    expect(text).toContain('Armor, +1, +2, or +3 (Chain Mail, +1)');
    expect(html).toContain('<a class="ref-link" href="/dnd-5e-2024/item/armor-1-2-or-3/">');
  });

  it('marks an item it is attuned to', async () => {
    const attuned = structuredClone(entries.find((e) => e.type === 'character' && e.id === 'brannoc-ashguard')!);
    (attuned.stats as { equipped: unknown[] }).equipped.push({ ref: 'item/cloak-of-protection', attuned: true });
    const loaded = loadLibrary([attuned, ...entries.filter((e) => e !== entries.find((x) => x.id === 'brannoc-ashguard'))], [rules]);
    expect(textOf(await render(loaded.find(({ entry }) => entry.id === 'brannoc-ashguard')!))).toContain('Cloak of Protection (attuned)');
  });

  it('has no fill-in boxes, and shows its description in print, where the detail page’s lore isn’t', () => {
    expect(html).not.toMatch(/<input|<textarea/);
    expect(html).not.toContain('Description');
    expect(printed).toContain('Description');
    expect(textOf(printed)).toContain('Brannoc held a pass for three winters');
  });
});

describe('the profile of a single-class build', async () => {
  const maelis = character('sister-maelis');
  const html = await render(maelis);
  const text = textOf(html);

  it('shows the simplest profile: one class and its subclass, its shield in its Armor Class, and its slots', () => {
    expect(html).toContain('<p class="statblock-header__subtitle">Cleric 3 (Life Domain)</p>');
    expect(text).toContain('Armor Class 16 Hit Points 24');
    expect(text).toContain('Spell Slots 4 at level 1, 2 at level 2');
    expect(html).toContain('<dt>Level 1</dt><dd><a class="ref-link" href="/dnd-5e-2024/spell/cure-wounds/">Cure Wounds</a></dd>');
    expect(text).not.toContain('Multiclass');
  });

  it('shows a weapon without properties as its hit, damage, and mastery', () => {
    expect(text).toContain('Mace. +3 to hit, 1d6 + 1 Bludgeoning damage; Mastery: Sap');
  });
});
