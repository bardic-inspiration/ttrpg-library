import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../scripts/validate/index.ts';
import { editDistance, normalizeName } from '../scripts/validate/library.ts';
import { listEntryFiles } from '../scripts/validate/walk.ts';
import { FIXTURES, cinderHound, frostLance, tempLibrary, wandOfFrostLances } from './helpers.ts';

const library = join(FIXTURES, 'library');
const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const temp = async (...args: Parameters<typeof tempLibrary>) => {
  const lib = await tempLibrary(...args);
  temps.push(lib.repo);
  return lib;
};

describe('listEntryFiles', () => {
  it('lists entry files relative to the root', async () => {
    expect(await listEntryFiles(join(library, 'valid'))).toEqual([
      'dnd-5e-2024/creature/cinder-hound.json',
      'dnd-5e-2024/magic-item/wand-of-frost-lances.json',
      'dnd-5e-2024/spell/frost-lance.json',
    ]);
  });

  it('treats a missing root as an empty library', async () => {
    expect(await listEntryFiles(join(library, 'does-not-exist'))).toEqual([]);
  });
});

describe('validateLibrary', () => {
  it('passes on an empty library', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'ttrpg-empty-'));
    temps.push(empty);
    expect(await validateLibrary(empty)).toEqual({ files: [], errors: [], warnings: [], entries: [] });
  });

  it('passes the §6.9 examples with no warnings, and returns their derived values', async () => {
    const result = await validateLibrary(join(library, 'valid'));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    const derived = Object.fromEntries(result.entries.map((e) => [e.entry.id, e.derived]));
    expect(derived['cinder-hound']).toMatchObject({ xp: 450, hp: { average: 32 } });
    // Magic items and spells derive nothing in v1 (SPEC.md §6.2).
    expect(derived['frost-lance']).toEqual({});
    expect(derived['wand-of-frost-lances']).toEqual({});
  });

  it('reports a file that is not valid JSON', async () => {
    const result = await validateLibrary(join(library, 'broken'));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.file).toBe('dnd-5e-2024/creature/sample.json');
    expect(result.errors[0]?.message).toMatch(/^invalid JSON/);
  });
});

/**
 * One fixture per error in tests/fixtures/invalid/: a §6.9 example with one
 * thing broken (the cinder hound, or Frost Lance for `spell-*` and the wand
 * for `magic-item-*`). It replaces that example in a copy of the valid
 * library, so refs to the other examples resolve. Each must fail with a
 * message matching its pattern.
 */
const INVALID: Record<string, RegExp> = {
  'unknown-top-level-key': /^hp: unknown key$/,
  'missing-meta': /missing required key "meta"/,
  'bad-id': /^id: must match pattern/,
  'short-summary': /^summary: must NOT have fewer than 10 characters/,
  'bad-date': /^meta\.createdAt: must match format "date"/,
  'bad-source-kind': /^meta\.source\.kind: must be one of "routine", "revise", "manual"/,
  'nested-tag': /^tags\.theme: must match a schema in anyOf/,
  'bad-tag-key': /^tags: property name must be valid/,
  'unknown-ruleset': /unknown ruleset "pathfinder-2e"/,
  'unknown-type': /unknown type "vehicle"/,
  'unknown-stats-key': /^stats\.xp: unknown key$/,
  'derived-value-stored': /^stats\.hp: unknown key$/,
  'missing-actions': /^stats: missing required key "actions"/,
  'empty-size': /^stats\.size: must NOT have fewer than 1 items/,
  'unknown-creature-type': /^stats\.creatureType: must be one of/,
  'bad-cr': /^stats\.cr: must be one of/,
  'ability-out-of-range': /^stats\.abilities\.str: must be <= 30/,
  'unknown-skill': /^stats\.skills: property name must be valid/,
  'zero-adjust': /^stats\.actions\[0\]\.adjust: must NOT be valid/,
  'bad-dice': /^stats\.actions\[0\]\.damage\[0\]\.dice: must match pattern/,
  'dice-with-modifier': /^stats\.actions\[0\]\.damage\[0\]\.dice: must match pattern/,
  'unknown-damage-type': /^stats\.actions\[0\]\.damage\[1\]\.type: must be one of/,
  'melee-without-reach': /^stats\.actions\[0\]: missing required key "reach"/,
  'melee-with-text': /^stats\.actions\[0\]\.text: not allowed here/,
  'save-without-save': /^stats\.actions\[1\]: missing required key "save"/,
  'save-with-onhit': /^stats\.actions\[1\]\.onHit: not allowed here/,
  'other-with-damage': /^stats\.traits\[0\]\.damage: not allowed here/,
  'other-without-text': /^stats\.traits\[0\]: missing required key "text"/,
  'bad-recharge': /^stats\.actions\[1\]\.recharge: must be one of/,
  'speed-not-multiple-of-5': /^stats\.speed\.walk: speed 42 ft\. is not a multiple of 5/,
  'unknown-token': /^stats\.traits\[0\]\.text: bad token \{fire\}: unknown token/,
  'token-unknown-ability': /^stats\.traits\[0\]\.text: bad token \{mod:luck\}: unknown ability "luck"/,
  'token-bad-dice': /^stats\.traits\[0\]\.text: bad token \{dmg:1d7:fire\}: dice "1d7"/,
  'token-unknown-damage-type': /^stats\.traits\[0\]\.text: bad token \{dmg:1d4:ice\}: unknown damage type "ice"/,
  'token-bad-adjust': /^stats\.traits\[0\]\.text: bad token \{dc:con:x\}: adjust "x"/,
  'unmatched-brace': /^stats\.traits\[0\]\.text: bad token \{: unmatched brace/,
  'literal-dc': /^stats\.traits\[0\]\.text: "DC 12" writes a derived number; use the token \{dc:<ability>\}/,
  'literal-to-hit': /^stats\.actions\[0\]\.onHit: "\+4 to hit" writes a derived number; use the token \{atk:<ability>\}/,
  'literal-damage': /^stats\.actions\[1\]\.onFailure: "2 \(1d4\)" writes a derived number; use the token \{dmg:<dice>\}/,
  'literal-damage-with-modifier': /^stats\.actions\[1\]\.onSuccess: "5 \(1d6 \+ 2\)" writes a derived number/,
  'literal-in-legendary-intro': /^stats\.legendaryActions\.intro: "DC 15" writes a derived number/,
  'literal-in-spellcasting-note': /^stats\.spellcasting\.note: "DC 11" writes a derived number/,
  'spell-bad-level': /^stats\.level: must be <= 9/,
  'spell-unknown-school': /^stats\.school: must be one of/,
  'spell-no-classes': /^stats\.classes: must NOT have fewer than 1 items/,
  'spell-unknown-class': /^stats\.classes\[0\]: must be one of/,
  'spell-bad-area-shape': /^stats\.range\.area\.shape: must be one of/,
  'spell-missing-effect': /^stats: missing required key "effect"/,
  'spell-concentration-not-timed': /^stats\.duration\.concentration: concentration needs a timed duration, not "instantaneous"/,
  'spell-timed-without-amount': /^stats\.duration: a timed duration needs an amount/,
  'spell-timed-without-unit': /^stats\.duration: a timed duration needs a unit/,
  'spell-distance-without-feet': /^stats\.range: a distance range needs feet/,
  'spell-consumed-without-cost': /^stats\.components\.m: a consumed material component needs a costGp/,
  'spell-cantrip-higher-levels': /^stats\.higherLevels: higherLevels is for leveled spells/,
  'spell-leveled-cantrip-upgrade': /^stats\.cantripUpgrade: cantripUpgrade is for cantrips/,
  'spell-reaction-without-trigger': /^stats\.castingTime: a reaction casting time needs a trigger/,
  'spell-trigger-without-reaction': /^stats\.castingTime\.trigger: a trigger is allowed only on a reaction/,
  'magic-item-unknown-category': /^stats\.category: must be one of/,
  'magic-item-unknown-rarity': /^stats\.rarity: must be one of/,
  'magic-item-missing-attunement': /^stats: missing required key "attunement"/,
  'magic-item-zero-charge-cost': /^stats\.spells\[0\]\.chargeCost: must be >= 1/,
  'magic-item-weapon-without-base': /^stats\.baseItem: a weapon needs a baseItem/,
  'magic-item-requirement-without-attunement': /^stats\.attunement\.requirement: a requirement is allowed only when attunement\.required is true/,
  'magic-item-charge-cost-without-charges': /^stats\.spells\[0\]\.chargeCost: a chargeCost is allowed only when the item has charges/,
  'magic-item-ref-missing-target': /^stats\.spells\[0\]\.spell: ref "spell\/frost-lances-of-doom" does not resolve: no entry has id "frost-lances-of-doom"$/,
  'magic-item-ref-type-mismatch': /^stats\.spells\[0\]\.spell: ref "creature\/frost-lance" does not resolve: "frost-lance" is a spell, not a creature$/,
  'blocklist-in-name': /^name: "Beholder" is on the blocklist \(config\/blocklist\.json\); use an SRD or original name$/,
  'blocklist-in-summary': /^summary: "mind flayer" is on the blocklist/,
  'blocklist-in-description': /^description: "Faerûn" is on the blocklist/,
  'blocklist-in-descriptors': /^stats\.descriptors\[0\]: "Githyanki" is on the blocklist/,
  'blocklist-in-stats-text': /^stats\.traits\[0\]\.text: "beholders" is on the blocklist/,
  'magic-item-blocklist-in-spell': /^stats\.spells\[0\]\.spell: "Bigby's" is on the blocklist/,
  'spell-blocklist-in-effect': /^stats\.effect: "Tasha's" is on the blocklist/,
  'markdown-heading': /^description: a heading is not allowed; text fields use only paragraphs, \*\*bold\*\*, \*italic\*, lists, and line breaks$/,
  'markdown-image': /^description: an image is not allowed/,
  'markdown-link': /^stats\.traits\[0\]\.text: a link is not allowed/,
  'markdown-html': /^stats\.actions\[1\]\.onSuccess: HTML is not allowed/,
  'spell-markdown-table': /^stats\.higherLevels: a table is not allowed/,
  'magic-item-markdown-autolink': /^stats\.effect: a link is not allowed/,
};

/** Where each invalid fixture is placed: its base example's path, so only the broken thing fails. */
const fixturePath = (name: string) =>
  name.startsWith('spell-')
    ? 'dnd-5e-2024/spell/frost-lance.json'
    : name.startsWith('magic-item-')
      ? 'dnd-5e-2024/magic-item/wand-of-frost-lances.json'
      : 'dnd-5e-2024/creature/cinder-hound.json';

describe('invalid fixtures', () => {
  it('has a pattern for every fixture file', async () => {
    const files = (await readdir(join(FIXTURES, 'invalid'))).map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(Object.keys(INVALID).sort());
  });

  it.each(Object.entries(INVALID))('%s fails', async (name, pattern) => {
    const entry = JSON.parse(await readFile(join(FIXTURES, 'invalid', `${name}.json`), 'utf8'));
    const others = (await Promise.all([cinderHound(), frostLance(), wandOfFrostLances()])).filter(
      (e) => `${e.ruleset}/${e.type}/${e.id}.json` !== fixturePath(name),
    );
    const { content } = await temp([...others, { path: fixturePath(name), entry }]);
    const { errors } = await validateLibrary(content);
    expect(errors.map((e) => e.message)).toContainEqual(expect.stringMatching(pattern));
  });
});

describe('library checks (SPEC.md §6.8, all types)', () => {
  it('fails when the file path does not match ruleset, type, and id', async () => {
    const { content } = await temp([{ path: 'dnd-5e-2024/creature/hound.json', entry: await cinderHound() }]);
    const { errors } = await validateLibrary(content);
    expect(errors).toEqual([
      { file: 'dnd-5e-2024/creature/hound.json', message: expect.stringMatching(/must be content\/dnd-5e-2024\/creature\/cinder-hound\.json/) },
    ]);
  });

  it('fails a duplicate id and a case-insensitive duplicate name', async () => {
    const twin = { ...(await cinderHound()), name: 'CINDER HOUND', id: 'cinder-hound-two' };
    const { content } = await temp([
      await cinderHound(),
      { path: 'dnd-5e-2024/creature/elsewhere.json', entry: await cinderHound() },
      twin,
    ]);
    const messages = (await validateLibrary(content)).errors.map((e) => e.message);
    expect(messages).toContainEqual(expect.stringMatching(/^id "cinder-hound" is already used by/));
    expect(messages).toContainEqual(expect.stringMatching(/^name "cinder hound" is already used by/i));
  });

  it('warns on a near-duplicate name', async () => {
    const near = { ...(await cinderHound()), name: 'Cinder Hounds', id: 'cinder-hounds' };
    const { content } = await temp([await cinderHound(), near]);
    const result = await validateLibrary(content);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { file: 'dnd-5e-2024/creature/cinder-hounds.json', message: expect.stringMatching(/close to "Cinder Hound"/) },
    ]);
  });

  it('normalizes names and measures edit distance', () => {
    expect(normalizeName('Frost-Lance, Élan')).toBe('frostlanceelan');
    expect(editDistance('frostlance', 'frostlances')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  describe('image', () => {
    const withImage = async (image: string, bytes?: number) => {
      const entry = { ...(await cinderHound()), image };
      const lib = await temp([entry]);
      if (bytes !== undefined) {
        await mkdir(join(lib.repo, 'assets/images/dnd-5e-2024/creature'), { recursive: true });
        await writeFile(join(lib.repo, image), Buffer.alloc(bytes));
      }
      return validateLibrary(lib.content);
    };

    it('passes when the file exists and is small', async () => {
      const result = await withImage('assets/images/dnd-5e-2024/creature/cinder-hound.png', 1024);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('fails when the path names another entry', async () => {
      const { errors } = await withImage('assets/images/dnd-5e-2024/creature/other.png', 1024);
      expect(errors[0]?.message).toMatch(/^image must be assets\/images\/dnd-5e-2024\/creature\/cinder-hound/);
    });

    it('fails when the file is missing', async () => {
      const { errors } = await withImage('assets/images/dnd-5e-2024/creature/cinder-hound.png');
      expect(errors[0]?.message).toMatch(/does not exist/);
    });

    it('warns above 500 KB and fails above 2 MB', async () => {
      const big = await withImage('assets/images/dnd-5e-2024/creature/cinder-hound.webp', 600 * 1024);
      expect(big.warnings[0]?.message).toMatch(/above 500 KB/);
      const huge = await withImage('assets/images/dnd-5e-2024/creature/cinder-hound.jpg', 3 * 1024 * 1024);
      expect(huge.errors[0]?.message).toMatch(/above the 2 MB limit/);
    });
  });
});

describe('references (SPEC.md §5.7)', () => {
  it('resolves the §6.9 examples together and computes back-references', async () => {
    const result = await validateLibrary(join(library, 'valid'));
    expect(result.errors).toEqual([]);
    const byId = Object.fromEntries(result.entries.map((e) => [e.entry.id, e]));
    expect(byId['wand-of-frost-lances']).toMatchObject({
      refs: [{ path: 'stats.spells[0].spell', key: 'spell/frost-lance' }],
      refBy: [],
    });
    expect(byId['frost-lance']).toMatchObject({
      refs: [],
      refBy: [{ path: 'stats.spells[0].spell', key: 'magic-item/wand-of-frost-lances' }],
    });
    expect(byId['cinder-hound']).toMatchObject({ refs: [], refBy: [] });
  });

  it('collects refs from creature spellcasting and gear, in document order', async () => {
    const hound = await cinderHound();
    hound.stats.gear = ['Collar', { ref: 'magic-item/wand-of-frost-lances' }];
    hound.stats.spellcasting = { ability: 'wis', atWill: [{ ref: 'spell/frost-lance' }], perDay: { '1': ['Fog Cloud', { ref: 'spell/frost-lance' }] } };
    const { content } = await temp([hound, await frostLance(), await wandOfFrostLances()]);
    const result = await validateLibrary(content);
    expect(result.errors).toEqual([]);
    const byId = Object.fromEntries(result.entries.map((e) => [e.entry.id, e]));
    expect(byId['cinder-hound']?.refs).toEqual([
      { path: 'stats.gear[1]', key: 'magic-item/wand-of-frost-lances' },
      { path: 'stats.spellcasting.atWill[0]', key: 'spell/frost-lance' },
      { path: 'stats.spellcasting.perDay.1[1]', key: 'spell/frost-lance' },
    ]);
    expect(byId['frost-lance']?.refBy.map((l) => l.key)).toEqual([
      'creature/cinder-hound',
      'creature/cinder-hound',
      'magic-item/wand-of-frost-lances',
    ]);
  });

  it('fails a ref whose target was deleted', async () => {
    const { content } = await temp([await wandOfFrostLances()]);
    const { errors } = await validateLibrary(content);
    expect(errors).toEqual([
      {
        file: 'dnd-5e-2024/magic-item/wand-of-frost-lances.json',
        message: 'stats.spells[0].spell: ref "spell/frost-lance" does not resolve: no entry has id "frost-lance"',
      },
    ]);
  });

  it('resolves a ref to an entry that fails its own stats schema, without a second error', async () => {
    const spell = await frostLance();
    spell.stats.level = 12;
    const { content } = await temp([spell, await wandOfFrostLances()]);
    const { errors } = await validateLibrary(content);
    expect(errors).toEqual([{ file: 'dnd-5e-2024/spell/frost-lance.json', message: expect.stringMatching(/^stats\.level:/) }]);
  });

  it('fails a ref into another ruleset', async () => {
    const spell = { ...(await frostLance()), ruleset: 'other-ruleset' };
    const { content } = await temp([spell, await wandOfFrostLances()]);
    const messages = (await validateLibrary(content)).errors.map((e) => e.message);
    expect(messages).toContainEqual(
      'stats.spells[0].spell: ref "spell/frost-lance" does not resolve: "frost-lance" is in other-ruleset; refs can\'t cross rulesets in v1',
    );
  });
});

describe('creature warnings (SPEC.md §6.8)', () => {
  it('lists every adjustment and high derived values for the reviewer', async () => {
    const entry = await cinderHound();
    entry.stats.initiative = { adjust: 1 };
    entry.stats.actions[0].adjust = 1;
    entry.stats.actions[0].damage[0].bonus = 1;
    entry.stats.traits[0].text = 'Make a {dc:con:+1} save or take {dmg:1d4:fire}; it strikes at {atk:str:20}.';
    entry.stats.actions.push({ name: 'Glare', kind: 'save', ability: 'cha', adjust: 30, save: { ability: 'wis', targets: 'one creature' }, onFailure: 'Frightened.' });
    entry.stats.spellcasting = { ability: 'wis', adjust: -1, atWill: ['Light'] };
    const { content } = await temp([entry]);
    const { errors, warnings } = await validateLibrary(content);
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/^stats\.traits\[0\]\.text: token \{dc:con:\+1\} adjusts the formula by 1/),
      expect.stringMatching(/^stats\.traits\[0\]\.text: token \{atk:str:20\} adjusts the formula by 20/),
      expect.stringMatching(/^stats\.traits\[0\]\.text: token \{atk:str:20\} renders an attack bonus of \+24, above \+17/),
      expect.stringMatching(/^stats\.initiative\.adjust: initiative adjusted by 1/),
      expect.stringMatching(/^stats\.spellcasting\.adjust: spellcasting adjusted by -1/),
      expect.stringMatching(/^stats\.actions\[0\]\.adjust: Bite adjusted by 1/),
      expect.stringMatching(/^stats\.actions\[0\]\.damage\[0\]\.bonus: Bite damage has a bonus of 1/),
      expect.stringMatching(/^stats\.actions\[2\]\.adjust: Glare adjusted by 30/),
      expect.stringMatching(/^stats\.actions\[2\]: Glare save DC 38 is above DC 30/),
    ]);
  });
});

describe('magic-item warnings (SPEC.md §6.8)', () => {
  it('warns when the effect restates an authored save DC or attack bonus', async () => {
    const wand = await wandOfFrostLances();
    wand.stats.spells = [
      { spell: 'Ray of Frost', attackBonus: 5 },
      { spell: 'Ice Storm', chargeCost: 3, saveDc: 15 },
      { spell: 'Chill Touch', attackBonus: -1 },
    ];
    wand.stats.effect = 'Cast *Ray of Frost* (+5 to hit) or *Ice Storm* (save DC 15). *Chill Touch* attacks at -1.';
    const { content } = await temp([wand]);
    const { errors, warnings } = await validateLibrary(content);
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.message)).toEqual([
      'stats.effect: "+5" restates stats.spells[0].attackBonus; the template renders it',
      'stats.effect: "DC 15" restates stats.spells[1].saveDc; the template renders it',
      'stats.effect: "-1" restates stats.spells[2].attackBonus; the template renders it',
    ]);
  });

  it('does not warn on other numbers in the effect', async () => {
    const wand = await wandOfFrostLances();
    wand.stats.spells[0].saveDc = 15;
    wand.stats.effect = 'It has 7 charges and regains +15 feet of range, or DC 150 on a crit.';
    const { content } = await temp([wand]);
    expect((await validateLibrary(content)).warnings).toEqual([]);
  });
});

describe('spell warnings (SPEC.md §6.8)', () => {
  it('warns on a cantrip marked ritual', async () => {
    const spell = await frostLance();
    spell.stats.level = 0;
    delete spell.stats.higherLevels;
    spell.stats.ritual = true;
    const { content } = await temp([spell]);
    const { errors, warnings } = await validateLibrary(content);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([{ file: 'dnd-5e-2024/spell/frost-lance.json', message: 'stats.ritual: a cantrip is marked ritual; confirm it' }]);
  });

  it('allows concentration on a timed duration and a trigger on a reaction', async () => {
    const spell = await frostLance();
    spell.stats.duration = { kind: 'timed', amount: 1, unit: 'minute', concentration: true };
    spell.stats.castingTime = { amount: 1, unit: 'reaction', trigger: 'which you take when a creature you can see moves' };
    spell.stats.components.m = { text: 'a diamond', costGp: 50, consumed: true };
    const { content } = await temp([spell]);
    const result = await validateLibrary(content);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
