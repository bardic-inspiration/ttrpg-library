import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import EntryDetail from '../../site/src/components/detail/EntryDetail.astro';
import { provenance, tagChips } from '../../site/src/lib/detail.ts';
import { fixtureLibrary, textOf } from './library-fixtures.ts';

const lib = await fixtureLibrary();

async function render(id: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(EntryDetail, { props: { loaded: lib.byId(id), names: lib.names, targets: lib.targets } });
}

describe('detail page (SPEC.md §9.4)', () => {
  it('links Frost Lance to the wand that casts it, and the wand to Frost Lance', async () => {
    const spell = await render('frost-lance');
    expect(textOf(spell)).toContain('Cast by Wand of Frost Lances');
    expect(spell).toMatch(/<a href="[^"]*\/dnd-5e-2024\/magic-item\/wand-of-frost-lances\/"[^>]*>Wand of Frost Lances<\/a>/);
    const wand = await render('wand-of-frost-lances');
    expect(textOf(wand)).toContain('Casts Frost Lance');
    expect(wand).toMatch(/<a href="[^"]*\/dnd-5e-2024\/spell\/frost-lance\/"[^>]*>Frost Lance<\/a>/);
  });

  it('shows the name, type, summary, placeholder art, template, and lore', async () => {
    const html = await render('cinder-hound');
    const text = textOf(html);
    expect(html).toMatch(/<h1[^>]*>Cinder Hound<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Cinder Hound<\/h2>/); // the stat block's own name, one level down
    expect(text).toContain('A soot-black hunting hound');
    expect(html).toMatch(/class="art-frame art-frame--placeholder[^"]*" aria-hidden="true"/);
    expect(text).toContain('HP 32 (5d8 + 10)');
    expect(html).toMatch(/class="lore[^"]*"[^>]*>\s*<p>Bred in the forges/);
  });

  it('links each tag to the type gallery filtered by it', async () => {
    const html = await render('cinder-hound');
    expect(html).toContain('/dnd-5e-2024/creature/?f.tags.theme=fire"');
    expect(html).toContain('/dnd-5e-2024/creature/?f.tags.environment=underdark"');
    expect(html).toContain('/dnd-5e-2024/creature/?f.tags.environment=mountains"');
  });

  it('shows provenance with source issues linked to GitHub', async () => {
    const { meta } = lib.byId('cinder-hound').entry;
    const issue = meta.source.issues![0];
    const html = await render('cinder-hound');
    expect(textOf(html)).toContain(`Added ${meta.createdAt}. From #${issue}.`);
    expect(html).toContain(`href="https://github.com/bardic-inspiration/ttrpg-library/issues/${issue}"`);
  });
});

describe('detail helpers (SPEC.md §9.3, §9.4)', () => {
  it('encodes tag values in gallery URL form', () => {
    const { entry } = lib.byId('cinder-hound');
    const chips = tagChips({ ...entry, tags: { world: 'Ash, Ember', lair: true } });
    expect(chips.map((c) => c.path)).toEqual([
      'dnd-5e-2024/creature/?f.tags.world=Ash%2C%20Ember',
      'dnd-5e-2024/creature/?f.tags.lair=true',
    ]);
  });

  it('includes the revision date only when there is one', () => {
    const { entry } = lib.byId('cinder-hound');
    expect(provenance(entry).updatedAt).toBeUndefined();
    expect(provenance({ ...entry, meta: { ...entry.meta, updatedAt: '2026-12-01' } }).updatedAt).toBe('2026-12-01');
  });

  it('places the page\'s export controls in the intro, after the summary', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryDetail, {
      props: { loaded: lib.byId('cinder-hound'), names: lib.names, targets: lib.targets },
      slots: { export: '<div class="export-slot-probe"></div>' },
    });
    const intro = html.slice(html.indexOf('entry-detail__intro'), html.indexOf('</header>'));
    expect(intro).toMatch(/entry-detail__summary[\s\S]*export-slot-probe/);
  });
});
