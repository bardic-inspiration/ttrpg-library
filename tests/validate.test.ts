import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../scripts/validate/index.ts';
import { editDistance, normalizeName } from '../scripts/validate/library.ts';
import { listEntryFiles } from '../scripts/validate/walk.ts';
import { FIXTURES, cinderHound, tempLibrary } from './helpers.ts';

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
    expect(await listEntryFiles(join(library, 'valid'))).toEqual(['dnd-5e-2024/creature/cinder-hound.json']);
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

  it('passes the cinder hound with no warnings, and returns its derived values', async () => {
    const result = await validateLibrary(join(library, 'valid'));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.derived).toMatchObject({ xp: 450, hp: { average: 32 } });
  });

  it('reports a file that is not valid JSON', async () => {
    const result = await validateLibrary(join(library, 'broken'));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.file).toBe('dnd-5e-2024/creature/sample.json');
    expect(result.errors[0]?.message).toMatch(/^invalid JSON/);
  });
});

/**
 * One fixture per error in tests/fixtures/invalid/: the cinder hound with one
 * thing broken. Each must fail with a message matching its pattern.
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
};

describe('invalid fixtures', () => {
  it('has a pattern for every fixture file', async () => {
    const files = (await readdir(join(FIXTURES, 'invalid'))).map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(Object.keys(INVALID).sort());
  });

  it.each(Object.entries(INVALID))('%s fails', async (name, pattern) => {
    const entry = JSON.parse(await readFile(join(FIXTURES, 'invalid', `${name}.json`), 'utf8'));
    // Keep the file at the cinder hound's path, so only the broken thing fails.
    const { content } = await temp([{ path: 'dnd-5e-2024/creature/cinder-hound.json', entry }]);
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
