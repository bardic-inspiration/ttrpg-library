import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryTemplate from '../../site/src/components/templates/EntryTemplate.astro';
import type { Entry } from '../../site/src/lib/library.ts';
import { templateFor } from '../../site/src/lib/template.ts';
import { fixtureLibrary, textOf } from './library-fixtures.ts';

const lib = await fixtureLibrary();

async function render(entry: Entry, derived: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(EntryTemplate, { props: { entry, derived, names: lib.names, ...extra } });
}

describe('type templates render the §6.9 examples (SPEC.md §9.5)', () => {
  it('renders the cinder hound with the numbers §6.9 shows', async () => {
    const { entry, derived } = lib.byId('cinder-hound');
    const text = textOf(await render(entry, derived));
    for (const line of [
      'Cinder Hound',
      'Medium Monstrosity, Unaligned',
      'AC 13 (natural armor)',
      'Initiative +2 (12)',
      'HP 32 (5d8 + 10)',
      'Skills Perception +3, Stealth +4',
      'Senses Darkvision 60 ft.; Passive Perception 13',
      'CR 2 (XP 450; PB +2)',
      'Smoldering Hide. A creature that touches the hound or hits it with a melee attack while within 5 feet of it takes 2 (1d4) Fire damage.',
      'Bite. Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8 + 2) Piercing damage plus 3 (1d6) Fire damage.',
      'Ember Breath (Recharge 5–6). Dexterity Saving Throw: DC 12, each creature in a 15-foot Cone. Failure: 10 (3d6) Fire damage. Success: Half damage.',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('renders Frost Lance as a spell card', async () => {
    const { entry, derived } = lib.byId('frost-lance');
    const html = await render(entry, derived);
    const text = textOf(html);
    expect(html).toContain('data-type="spell"');
    for (const line of [
      'Level 1 Evocation (Sorcerer, Wizard)',
      'Casting Time Action',
      'Range 60 feet',
      'Components V, S, M (a sliver of ice)',
      'Duration Instantaneous',
      'the target takes 3d8 Cold damage',
      'Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('renders a reaction trigger as markdown (SPEC.md §6.7)', async () => {
    const { entry, derived } = lib.byId('frost-lance');
    const stats = { ...(entry.stats as Record<string, unknown>), castingTime: { amount: 1, unit: 'reaction', trigger: 'when targeted by the *Magic Missile* spell' } };
    const html = await render({ ...entry, stats }, derived);
    expect(html).toContain('which you take when targeted by the <em>Magic Missile</em> spell');
    expect(textOf(html)).toContain('Casting Time Reaction, which you take when targeted by the Magic Missile spell');
  });

  it('renders the Wand of Frost Lances as a magic item card, with the spell by name and markdown as markup', async () => {
    const { entry, derived } = lib.byId('wand-of-frost-lances');
    const html = await render(entry, derived);
    const text = textOf(html);
    expect(html).toContain('data-rarity="uncommon"');
    expect(html).toContain('<em>Frost Lance</em>');
    for (const line of [
      'Wand, Uncommon (Requires Attunement by a spellcaster)',
      'Charges 7; regains 1d6 + 1 daily at dawn',
      'If you expend the last charge, roll 1d20. On a 1, the wand melts away.',
      'Frost Lance (1 charge; +5 to hit)',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('renders markdown in every creature text field, after tokens, and plain fields as plain text (SPEC.md §5.5)', async () => {
    const { entry, derived } = lib.byId('cinder-hound');
    const e = structuredClone(entry) as Entry & { stats: Record<string, any> };
    const d = structuredClone(derived) as Record<string, any>;
    const s = e.stats;
    s.traits[0].text = 'It glows *dimly*, dealing {dmg:1d4} Fire damage.\n\n- one\n- two';
    s.actions[0].name = 'Bite *Hot*';
    s.actions[0].onHit = '*Constitution Saving Throw:* DC 10. **Charred**';
    s.actions[1].onSuccess = 'Half damage. *Ouch.*';
    s.legendaryActions = { uses: 3, intro: 'It acts **{atk:dex}** times.', items: [{ name: 'Snap', kind: 'other', text: 'It *snaps*.' }] };
    d.legendaryActions = { items: [{}] };
    s.spellcasting = { ability: 'wis', atWill: ['Light *Bright*'], note: 'It casts *nothing* else.' };
    d.spellcasting = { dc: 11, attackBonus: 3 };
    const html = await render(e, d);
    expect(html).toContain('<em>dimly</em>, dealing 2 (1d4) Fire damage.');
    expect(html).toMatch(/<ul>\s*<li>one<\/li>\s*<li>two<\/li>\s*<\/ul>/);
    expect(html).toContain('<em>Constitution Saving Throw:</em> DC 10. <strong>Charred</strong>');
    expect(html).toContain('Half damage. <em>Ouch.</em>');
    expect(html).toContain('<strong>+4</strong> times.');
    expect(html).toContain('<strong>Snap.</strong> It <em>snaps</em>.');
    expect(html).toContain('It casts <em>nothing</em> else.');
    // Names and spell strings are plain text, not markdown.
    expect(html).toContain('<strong>Bite *Hot*.</strong>');
    expect(html).toContain('Light *Bright*');
    expect(html).not.toMatch(/\*(dimly|Charred|snaps|nothing)\*/);
  });

  it('nests headings under the level it is given', async () => {
    const { entry, derived } = lib.byId('cinder-hound');
    const html = await render(entry, derived, { level: 3 });
    expect(html).toMatch(/<h3[^>]*>Cinder Hound<\/h3>/);
    expect(html).toMatch(/<h4[^>]*>Actions<\/h4>/);
  });

  it('marks the render mode, defaulting to screen', async () => {
    const { entry, derived } = lib.byId('frost-lance');
    expect(await render(entry, derived)).toContain('data-mode="screen"');
    expect(await render(entry, derived, { mode: 'capture' })).toContain('data-mode="capture"');
  });
});

describe('templates compute no rules values (SPEC.md §6.1, §9.5)', () => {
  it('shows whatever the derived values say, so every number comes from the ruleset module', async () => {
    const { entry, derived } = lib.byId('cinder-hound');
    const d = structuredClone(derived) as Record<string, any>;
    d.hp = { ...d.hp, average: 999, formula: '5d8 + 994' };
    d.initiative = { bonus: 7, score: 17 };
    d.passivePerception = 21;
    d.actions[0].attackBonus = 11;
    d.actions[1].saveDc = 19;
    const text = textOf(await render(entry, d));
    expect(text).toContain('HP 999 (5d8 + 994)');
    expect(text).toContain('Initiative +7 (17)');
    expect(text).toContain('Passive Perception 21');
    expect(text).toContain('Melee Attack Roll: +11');
    expect(text).toContain('DC 19');
  });
});

describe('generic template (SPEC.md §9.5)', () => {
  it('falls back for a template name with no component', () => {
    expect(templateFor('spell-card')).toBe('spell-card');
    expect(templateFor('npc-sheet')).toBe('generic');
    expect(templateFor(undefined)).toBe('generic');
  });

  it('renders fixed keys, stats as a definition list, and tags, by presence alone', async () => {
    const entry: Entry = {
      ruleset: 'dnd-5e-2024',
      type: 'location',
      id: 'ember-gate',
      name: 'Ember Gate',
      summary: 'A gate of cooling slag at the edge of the forge district.',
      description: 'Smoke *always* curls from its hinges.',
      stats: { level: 0, open: false, guardedBy: { ref: 'creature/cinder-hound' }, size: { width: 20, height: 30 } },
      tags: { theme: 'fire', environment: ['city', 'forge'] },
      meta: { createdAt: '2026-11-02', source: { kind: 'manual' } },
    };
    const html = await render(entry, {});
    const text = textOf(html);
    expect(html).toContain('<em>always</em>');
    for (const line of ['Ember Gate', 'A gate of cooling slag', 'Level 0', 'Open No', 'Guarded by Cinder Hound', 'Size width 20', 'Size height 30', 'theme fire', 'environment city, forge']) {
      expect(text).toContain(line);
    }
    expect(text).not.toContain('Cursed');
  });
});
