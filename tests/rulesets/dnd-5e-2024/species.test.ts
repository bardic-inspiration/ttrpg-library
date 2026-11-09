// dnd-5e-2024 species (docs/rulesets.md#species): a page type whose special traits are species-trait
// components, its schema and checks, and its page.
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it } from 'vitest';
import { validateLibrary } from '../../../scripts/validate/index.ts';
import EntryTemplate from '../../../site/src/components/templates/EntryTemplate.astro';
import { entryNames, loadLibrary, refPaths, refTargets, type Entry } from '../../../site/src/lib/library.ts';
import { groupPageRefs } from '../../../site/src/lib/refs.ts';
import { rulesData } from '../../../site/src/lib/rules.ts';
import { speciesIntro, speciesSize } from '../../../site/src/lib/species.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { SpeciesStats } from '../../../rulesets/dnd-5e-2024/types.ts';
import definition from '../../../rulesets/dnd-5e-2024/ruleset.json' with { type: 'json' };
import { FIXTURES, tempLibrary } from '../../helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (name: string) =>
  Promise.all((await readdir(join(FIXTURES, name))).sort().map((f) => readJson(join(FIXTURES, name, f)) as Promise<Entry & Record<string, any>>));
const fixtures = async () => [...(await dir('species')), ...(await dir('species-trait'))];

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function validate(change: (entries: Record<string, any>[]) => Record<string, any>[] | void = () => {}) {
  let entries: Record<string, any>[] = structuredClone(await fixtures());
  entries = change(entries) ?? entries;
  const lib = await tempLibrary(entries);
  temps.push(lib.repo);
  const result = await validateLibrary(lib.content, { assetsRoot: lib.repo });
  return { ...result, messages: result.errors.map((e) => `${e.file}: ${e.message}`) };
}
const byId = (entries: Record<string, any>[], id: string) => entries.find((e) => e.id === id)!;

describe('validation', () => {
  it('passes the fixtures, with each trait on its species and the sizes derived', async () => {
    const result = await validate();
    expect(result.messages).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.entries.map((e) => [e.entry.id, e.derived])).toEqual([
      ['dragonborn', { sizes: ['medium'] }],
      ['tiefling', { sizes: ['medium', 'small'] }],
    ]);
    expect(result.components.filter((c) => c.parent === 'species/tiefling').map((c) => c.entry.id)).toEqual([
      'tiefling-darkvision',
      'tiefling-fiendish-legacy',
      'tiefling-otherworldly-presence',
    ]);
  });

  it('rejects a speed off the 5-foot grid, a third size, and a trait list with another type', async () => {
    const { messages } = await validate((entries) => {
      byId(entries, 'dragonborn').stats.speed = 32;
      byId(entries, 'tiefling').stats.sizes.push({ size: 'large', height: 'about 8 feet tall' });
      byId(entries, 'tiefling').stats.traits.push({ ref: 'feat/alert' });
    });
    expect(messages).toContain('dnd-5e-2024/species/dragonborn.json: stats.speed: speed 32 is not a multiple of 5');
    expect(messages).toContain('dnd-5e-2024/species/tiefling.json: stats.sizes: must NOT have more than 2 items');
    expect(messages).toContain('dnd-5e-2024/species/tiefling.json: stats.traits[3].ref: must match pattern "^species-trait/[a-z0-9]+(-[a-z0-9]+)*$"');
  });

  it('rejects a trait no species lists, a trait with a summary, and a missing trait', async () => {
    const { messages } = await validate((entries) => {
      const dragonborn = byId(entries, 'dragonborn');
      dragonborn.stats.traits = dragonborn.stats.traits.filter((t: { ref: string }) => t.ref !== 'species-trait/dragonborn-darkvision');
      dragonborn.stats.traits.push({ ref: 'species-trait/dragonborn-scales' });
      byId(entries, 'tiefling-darkvision').summary = 'A trait with a summary.';
    });
    expect(messages).toContain(
      'dnd-5e-2024/species-trait/dragonborn-darkvision.json: species-trait/dragonborn-darkvision is listed by no parent; a species lists it by ref in its stats',
    );
    expect(messages).toContain('dnd-5e-2024/species-trait/tiefling-darkvision.json: summary: unknown key');
    expect(messages).toContain(
      'dnd-5e-2024/species/dragonborn.json: stats.traits[4]: ref "species-trait/dragonborn-scales" does not resolve: no species-trait has id "dragonborn-scales"',
    );
  });
});

describe('wording', () => {
  it('words sizes and the traits’ opening sentence', async () => {
    const [dragonborn, tiefling] = await dir('species');
    expect(speciesSize(dragonborn!.stats as SpeciesStats)).toBe('Medium (about 5–7 feet tall)');
    expect(speciesSize(tiefling!.stats as SpeciesStats)).toBe(
      'Medium (about 4–7 feet tall) or Small (about 3–4 feet tall), chosen when you select this species',
    );
    expect(speciesIntro('Dragonborn', dragonborn!.stats as SpeciesStats)).toBe('As a Dragonborn, you have these special traits.');
    expect(speciesIntro('Elf', dragonborn!.stats as SpeciesStats)).toBe('As an Elf, you have these special traits.');
    expect(speciesIntro('Tiefling', tiefling!.stats as SpeciesStats)).toBe('As a Tiefling, you have the following special traits.');
  });
});

describe('the page', async () => {
  const files: Record<string, unknown> = {};
  const rulesDir = join(ROOT, 'rulesets/dnd-5e-2024/rules');
  for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) files[file] = await readJson(join(rulesDir, file));
  const data = rulesData(definition, files);
  const all = loadLibrary(await fixtures(), [data]);
  const names = entryNames(all, [data]);
  const paths = refPaths([data], all);
  const dragonborn = all.find(({ entry }) => entry.id === 'dragonborn')!;
  const html = (await (await AstroContainer.create()).renderToString(EntryTemplate, { props: { ...dragonborn, names, paths, components: dragonborn.components } })).replace(
    / data-astro-cid-\w+/g,
    '',
  );

  it('prints its lines and the opening sentence', () => {
    expect(html).toContain('<dt>Creature Type</dt><dd>Humanoid</dd><dt>Size</dt><dd>Medium (about 5–7 feet tall)</dd><dt>Speed</dt><dd>30 feet</dd>');
    expect(html).toContain('<p>As a Dragonborn, you have these special traits.</p>');
  });

  it('prints each trait as a titled paragraph at its anchor, in order, and no generic sections', () => {
    expect(html).toContain('<div class="species-trait" id="species-trait-dragonborn-darkvision" data-type="species-trait"><div class="rules-text"><p><em><strong>Darkvision.</strong></em> You have Darkvision');
    const order = ['draconic-ancestry', 'breath-weapon', 'damage-resistance', 'darkvision', 'draconic-flight'].map((id) => html.indexOf(`id="species-trait-dragonborn-${id}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(html).toContain('<caption>Draconic Ancestors</caption>');
    expect(html).not.toContain('page-component');
  });

  it('lists a trait’s links on its species’ page, and names the trait from the other end', () => {
    const { forward } = groupPageRefs(dragonborn, dragonborn.components!, refTargets(all, [data]), ruleset.refLabels);
    expect(forward).toEqual([{ label: 'References', targets: [{ type: 'condition', name: 'Incapacitated', path: 'dnd-5e-2024/rules/conditions/#condition-incapacitated' }] }]);
    expect(refTargets(all, [data]).get('species-trait/dragonborn-draconic-flight')?.name).toBe('Dragonborn › Draconic Flight');
  });
});
