// `{ref:<type>/<id>}` links in text (docs/content-model.md#references): validated like any ref,
// counted in refs and refBy, read as the target's name in search, and
// rendered as the target's name linked to its page.
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex } from '../scripts/build-index/index.ts';
import { validateLibrary } from '../scripts/validate/index.ts';
import { renderInlineMarkdown, renderMarkdown } from '../site/src/lib/markdown.ts';
import { refOrTextName } from '../site/src/lib/refs.ts';
import { cinderHound, frostLance, tempLibrary, wandOfFrostLances } from './helpers.ts';

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const library = async (entries: Record<string, any>[]) => {
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  return lib.content;
};

/** The three example entries, with Frost Lance's effect and the hound's description changed. */
async function examples(effect: string, description?: string) {
  const spell = await frostLance();
  spell.stats.effect = effect;
  const hound = await cinderHound();
  if (description !== undefined) hound.description = description;
  return [spell, hound, await wandOfFrostLances()];
}

describe('{ref:…} tokens in text (docs/content-model.md#references)', () => {
  it('resolve, and link both ways with the text field as the path', async () => {
    const entries = await examples(
      'The lance summons a {ref:creature/cinder-hound} that fights beside you.',
      'Hunters carry a *{ref:item/wand-of-frost-lances}* against them.',
    );
    const { errors, entries: valid } = await validateLibrary(await library(entries));
    expect(errors).toEqual([]);
    const byId = new Map(valid.map((e) => [e.entry.id, e]));
    expect(byId.get('frost-lance')!.refs).toEqual([{ path: 'stats.effect', key: 'creature/cinder-hound' }]);
    expect(byId.get('cinder-hound')!.refs).toEqual([{ path: 'description', key: 'item/wand-of-frost-lances' }]);
    expect(byId.get('cinder-hound')!.refBy).toEqual([{ path: 'stats.effect', key: 'spell/frost-lance' }]);
  });

  it('works in creature prose beside the ruleset tokens', async () => {
    const hound = await cinderHound();
    hound.stats.traits[0].text = `${hound.stats.traits[0].text} It hates a {ref:spell/frost-lance}.`;
    const { errors } = await validateLibrary(await library([hound, await frostLance(), await wandOfFrostLances()]));
    expect(errors).toEqual([]);
  });

  it.each([
    ['a missing target', 'Summons a {ref:creature/ash-wolf}.', /^stats\.effect: ref "creature\/ash-wolf" does not resolve: no creature has id "ash-wolf"$/],
    ['the wrong type', 'Summons a {ref:creature/frost-lance}.', /^stats\.effect: ref "creature\/frost-lance" does not resolve: no creature has id "frost-lance"; "frost-lance" is a spell$/],
    ['a malformed token', 'Summons a {ref:cinder-hound}.', /^stats\.effect: ref token \{ref:cinder-hound\} is malformed; write \{ref:<type>\/<id>\}/],
  ])('fail on %s', async (_label, effect, pattern) => {
    const { errors } = await validateLibrary(await library(await examples(effect)));
    expect(errors.map((e) => e.message)).toContainEqual(expect.stringMatching(pattern));
  });

  it('fail outside text fields', async () => {
    const spell = await frostLance();
    spell.stats.components.m.text = 'a {ref:creature/cinder-hound} whisker';
    const { errors } = await validateLibrary(await library([spell, await cinderHound(), await wandOfFrostLances()]));
    expect(errors.map((e) => e.message)).toContainEqual(
      'stats.components.m.text: a {ref:…} token works only in text fields (rules text and description)',
    );
  });

  it('read as the target name in search text', async () => {
    const content = await library(await examples('The lance summons a {ref:creature/cinder-hound}.'));
    const { records } = await buildIndex(content);
    const spell = records.find((r) => r.id === 'frost-lance')!;
    expect(spell.search).toContain('summons a Cinder Hound');
    expect(spell.search).not.toContain('{');
  });
});

describe('rendering {ref:…} (docs/content-model.md#references, docs/site.md#templates)', () => {
  const refs = { names: new Map([['creature/zombie', 'Zombie'], ['spell/cure-wounds', 'Cure Wounds']]), ruleset: 'dnd-5e-2024' };

  it('shows the target name linked to its page, inside any inline markup', () => {
    const html = renderMarkdown('It becomes a {ref:creature/zombie}. Cast *{ref:spell/cure-wounds}*.', refs);
    expect(html).toContain('a <a class="ref-link" href="/dnd-5e-2024/creature/zombie/">Zombie</a>.');
    expect(html).toContain('<em><a class="ref-link" href="/dnd-5e-2024/spell/cure-wounds/">Cure Wounds</a></em>');
    expect(renderInlineMarkdown('{ref:creature/zombie}', refs)).toBe('<a class="ref-link" href="/dnd-5e-2024/creature/zombie/">Zombie</a>');
  });

  it('reads as the plain name in a table label', () => {
    expect(renderMarkdown('| {ref:creature/zombie} |\n|---|\n| 1 |', refs)).toContain('aria-label="Table: Zombie"');
  });

  it('falls back to the id, unlinked, when the target is unknown', () => {
    expect(renderMarkdown('A {ref:creature/ghast}.', refs)).toBe('<p>A ghast.</p>\n');
    expect(renderMarkdown('A {ref:creature/zombie}.')).toBe('<p>A zombie.</p>\n');
  });
});

describe('a {ref:…} token with display text (docs/content-model.md#references)', () => {
  it('resolves its key, renders and indexes its text, and works in a table cell', async () => {
    const content = await library(await examples('The lance calls a {ref:creature/cinder-hound fire hound} to you.'));
    const { errors, entries: valid } = await validateLibrary(content);
    expect(errors).toEqual([]);
    expect(valid.find((e) => e.entry.id === 'frost-lance')!.refs).toEqual([{ path: 'stats.effect', key: 'creature/cinder-hound' }]);
    const { records } = await buildIndex(content);
    expect(records.find((r) => r.id === 'frost-lance')!.search).toContain('calls a fire hound to you');
    const refs = { names: new Map([['creature/zombie', 'Zombie']]), ruleset: 'dnd-5e-2024' };
    expect(renderInlineMarkdown('{ref:creature/zombie risen dead}', refs)).toBe('<a class="ref-link" href="/dnd-5e-2024/creature/zombie/">risen dead</a>');
    expect(renderMarkdown('| A | B |\n|---|---|\n| {ref:creature/zombie risen dead} | 1 |', refs)).toContain('>risen dead</a></td>');
  });

  it.each([
    ['trailing space', '{ref:creature/cinder-hound }'],
    ['leading space in the text', '{ref:creature/cinder-hound  fire hound}'],
    ['a bad key', '{ref:cinder-hound fire hound}'],
  ])('fails on %s', async (_label, token) => {
    const { errors } = await validateLibrary(await library(await examples(`Summons a ${token}.`)));
    expect(errors.map((e) => e.message)).toContainEqual(expect.stringMatching(/ref token .* is malformed; write \{ref:<type>\/<id>\} or \{ref:<type>\/<id> <text>\}/));
  });
});

describe('a ref with a note (docs/content-model.md#references)', () => {
  it('resolves like any ref and reads as the name with the note in parentheses', async () => {
    const wand = await wandOfFrostLances();
    wand.stats.spells[0].spell = { ref: 'spell/frost-lance', note: 'level 3 version' };
    const { errors, entries: valid } = await validateLibrary(await library([wand, await frostLance(), await cinderHound()]));
    expect(errors).toEqual([]);
    expect(valid.find((e) => e.entry.id === 'wand-of-frost-lances')!.refs).toEqual([{ path: 'stats.spells[0].spell', key: 'spell/frost-lance' }]);
    const names = new Map([['spell/frost-lance', 'Frost Lance']]);
    expect(refOrTextName(wand.stats.spells[0].spell, names)).toBe('Frost Lance (level 3 version)');
    expect(refOrTextName({ ref: 'spell/frost-lance' }, names)).toBe('Frost Lance');
    expect(refOrTextName('Fireball (level 5 version)', names)).toBe('Fireball (level 5 version)');
  });

  it('rejects any other key on a ref', async () => {
    const wand = await wandOfFrostLances();
    wand.stats.spells[0].spell = { ref: 'spell/frost-lance', level: 3 };
    const { errors } = await validateLibrary(await library([wand, await frostLance(), await cinderHound()]));
    expect(errors.length).toBeGreaterThan(0);
  });
});
