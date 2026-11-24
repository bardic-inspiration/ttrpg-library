import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import EntryDetail from '../../site/src/components/detail/EntryDetail.astro';
import { provenance, tagChips } from '../../site/src/lib/detail.ts';
import { fixtureLibrary, textOf } from './library-fixtures.ts';

const lib = await fixtureLibrary();

async function render(id: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(EntryDetail, { props: { loaded: lib.byId(id), names: lib.names, targets: lib.targets } });
}

describe('detail page (docs/site.md#detail-page)', () => {
  it('links Frost Lance to the wand that casts it, and the wand to Frost Lance', async () => {
    const spell = await render('frost-lance');
    expect(textOf(spell)).toContain('Cast by Wand of Frost Lances');
    expect(spell).toMatch(/<a href="[^"]*\/dnd-5e-2024\/item\/wand-of-frost-lances\/"[^>]*>Wand of Frost Lances<\/a>/);
    const wand = await render('wand-of-frost-lances');
    expect(textOf(wand)).toContain('Casts Frost Lance');
    expect(wand).toMatch(/<a href="[^"]*\/dnd-5e-2024\/spell\/frost-lance\/"[^>]*>Frost Lance<\/a>/);
  });

  it('lists an SRD page\'s links to homebrew in a Homebrew section after its links, and a homebrew page\'s links unsplit', async () => {
    const html = await render('sorcerer');
    // Frost Lance is homebrew and names the Sorcerer: not on its spell list, and only under Homebrew.
    const at = html.indexOf('<h2 id="homebrew-heading"');
    expect(at).toBeGreaterThan(html.indexOf('<h2 id="links-heading"'));
    const [before, homebrew] = [html.slice(0, at), html.slice(at)];
    expect(before).not.toContain('Frost Lance');
    expect(textOf(homebrew).trim()).toMatch(/^Homebrew Spells Frost Lance /);
    expect(homebrew).toMatch(/<a href="[^"]*\/dnd-5e-2024\/spell\/frost-lance\/"[^>]*>Frost Lance<\/a>/);
    const spell = await render('frost-lance');
    expect(spell).not.toContain('homebrew-heading');
    expect(textOf(spell)).toContain('Classes Sorcerer, Wizard');
  });

  it('shows the name, type, summary, template, and lore, with no art frame when there is no art', async () => {
    const html = await render('cinder-hound');
    const text = textOf(html);
    expect(html).toMatch(/<h1[^>]*>Cinder Hound<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Cinder Hound<\/h2>/); // the stat block's own name, one level down
    expect(text).toContain('A soot-black hunting hound');
    expect(html).not.toContain('art-frame');
    expect(html).not.toContain('entry-detail__art');
    expect(text).not.toContain('Art placeholder');
    expect(text).toContain('HP 32 (5d8 + 10)');
    expect(html).toMatch(/class="lore[^"]*"[^>]*>\s*<p>Bred in the forges/);
  });

  it('shows the art frame when the entry has art', async () => {
    const loaded = lib.byId('cinder-hound');
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryDetail, {
      props: {
        loaded: { ...loaded, entry: { ...loaded.entry, image: 'assets/images/dnd-5e-2024/creature/cinder-hound.webp' } },
        names: lib.names,
        targets: lib.targets,
      },
    });
    expect(html).toContain('entry-detail__art');
    expect(html).toMatch(/<img class="art-frame art-frame--image[^"]*" src="[^"]*cinder-hound\.webp" alt="Cinder Hound"/);
  });

  it('links each tag to the Library filtered by the type and the tag, and the type to the Library filtered by it', async () => {
    const html = await render('cinder-hound');
    expect(html).toContain('/?f.ruleset=dnd-5e-2024&amp;f.type=dnd-5e-2024/creature&amp;f.tags.theme=fire"');
    expect(html).toContain('/?f.ruleset=dnd-5e-2024&amp;f.type=dnd-5e-2024/creature&amp;f.tags.environment=underdark"');
    expect(html).toContain('/?f.ruleset=dnd-5e-2024&amp;f.type=dnd-5e-2024/creature&amp;f.tags.environment=mountains"');
    expect(html).toContain('class="entry-detail__type" href="/?sort=stats.cr:asc&amp;f.ruleset=dnd-5e-2024&amp;f.type=dnd-5e-2024/creature"');
  });

  it('shows provenance with source issues linked to GitHub', async () => {
    const { meta } = lib.byId('cinder-hound').entry;
    const issue = meta.source.issues![0];
    const html = await render('cinder-hound');
    expect(textOf(html)).toContain(`Added ${meta.createdAt}. From #${issue}.`);
    expect(html).toContain(`href="https://github.com/bardic-inspiration/ttrpg-library/issues/${issue}"`);
  });

  it('credits an imported entry\'s author, source, and license (docs/content-model.md#meta)', async () => {
    const loaded = lib.byId('cinder-hound');
    const license = { id: 'CC-BY-4.0', author: 'A. Author', url: 'https://example.com/hounds' };
    const entry = { ...loaded.entry, meta: { createdAt: '2026-11-17', source: { kind: 'import', issues: [7], license } } };
    expect(provenance(entry).credit).toEqual({
      author: 'A. Author',
      source: 'https://example.com/hounds',
      license: 'Creative Commons Attribution 4.0 International',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    });
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryDetail, { props: { loaded: { ...loaded, entry }, names: lib.names, targets: lib.targets } });
    expect(textOf(html)).toContain('From #7. Adapted from a work by A. Author, licensed under Creative Commons Attribution 4.0 International.');
    expect(html).toContain('href="https://example.com/hounds"');
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/legalcode"');
    expect(provenance(loaded.entry).credit).toBeUndefined();
  });

  // #295: an implicit grid track is sized `auto`, so it grew to a wide table's min-content
  // width and the whole page scrolled sideways. A `minmax(0, 1fr)` track keeps every child
  // to the page's width, and a wide table scrolls inside its own box (docs/site.md#templates).
  it.each([
    ['detail/EntryDetail.astro', 'entry-detail'],
    ['templates/parts/Accordion.astro', 'accordion__body'],
    ['templates/parts/PageComponents.astro', 'page-components'],
  ])('%s sizes .%s to its container, never to a wide table', (file, name) => {
    const source = readFileSync(new URL(`../../site/src/components/${file}`, import.meta.url), 'utf8');
    const rule = source.match(new RegExp(`\\.${name} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule).toContain('display: grid;');
    expect(rule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  // #299: a property line's label column took its widest label ("Saving Throw Proficiencies"),
  // so at 320px the values column couldn't fit its longest word. The label column now starts at
  // its min-content width and grows to max-content only while the values still fit.
  it('lets property-line labels wrap before the values overflow', () => {
    const source = readFileSync(new URL('../../site/src/components/templates/parts/PropertyList.astro', import.meta.url), 'utf8');
    const rule = source.match(/\.property-list \{([^}]*)/)?.[1] ?? '';
    expect(rule).toMatch(/grid-template-columns:\s*minmax\(min-content,\s*max-content\)\s+minmax\(min-content,\s*1fr\);/);
  });

  // #299: "Antipathy/Sympathy" has no break point, so its heading set the page's width at 320px.
  it('lets the name break after a slash', async () => {
    const loaded = lib.byId('cinder-hound');
    const container = await AstroContainer.create();
    const html = await container.renderToString(EntryDetail, {
      props: { loaded: { ...loaded, entry: { ...loaded.entry, name: 'Cinder/Ash Hound' } }, names: lib.names, targets: lib.targets },
    });
    expect(html).toMatch(/<h1[^>]*>Cinder\/<wbr[^>]*>Ash Hound<\/h1>/);
  });
});

describe('detail helpers (docs/site.md#gallery, docs/site.md#detail-page)', () => {
  it('encodes tag values in gallery URL form', () => {
    const { entry } = lib.byId('cinder-hound');
    const chips = tagChips({ ...entry, tags: { world: 'Ash, Ember', lair: true } });
    expect(chips.map((c) => c.path)).toEqual([
      '?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/creature&f.tags.world=Ash%2C%20Ember',
      '?f.ruleset=dnd-5e-2024&f.type=dnd-5e-2024/creature&f.tags.lair=true',
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
