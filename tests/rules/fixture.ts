// The fixture ruleset for rules data (docs/rulesets.md#rules-data) and page types
// (docs/content-model.md#components): `fixture-rules`, with a
// content type `note`, a primitive-only rules type `term`, and a rules type
// with groups and extensions, `gear`; and a page type, `manual`, whose `chapter`
// components it lists. Tests validate it in place, or copy it
// to a temporary folder to break one thing.
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { RulesData } from '../../lib/rules.ts';
import type { RulesetDefinition, RulesetModule } from '../../rulesets/module.ts';
import { validateLibrary } from '../../scripts/validate/index.ts';
import { loadLibrary, type Entry } from '../../site/src/lib/library.ts';
import { rulesContext, rulesData } from '../../site/src/lib/rules.ts';
import { FIXTURES } from '../helpers.ts';

export const RULES_FIXTURE = join(FIXTURES, 'rules');

/** Validates a copy of the fixture (or the fixture itself) as the build would. */
export async function validateFixture(root = RULES_FIXTURE) {
  const registry = JSON.parse(await readFile(join(root, 'types.json'), 'utf8'));
  return validateLibrary(join(root, 'content'), { rulesetsRoot: join(root, 'rulesets'), registry });
}

/** A temporary copy of the fixture, with `changes` applied to the files named by their path inside it. */
export async function brokenFixture(changes: Record<string, unknown | null>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ttrpg-rules-'));
  await cp(RULES_FIXTURE, root, { recursive: true });
  // The fixture module imports the repo's module.ts by a relative path; in the copy, point it back.
  const index = join(root, 'rulesets/fixture-rules/index.ts');
  const source = await readFile(index, 'utf8');
  await writeFile(index, source.replace("'../../../../../rulesets/module.ts'", `'${join(import.meta.dirname, '../../rulesets/module.ts')}'`));
  for (const [path, value] of Object.entries(changes)) {
    const file = join(root, path);
    if (value === null) await rm(file);
    else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    }
  }
  return root;
}

/** A JSON file of the fixture, parsed. */
export const fixtureJson = async (path: string): Promise<any> => JSON.parse(await readFile(join(RULES_FIXTURE, path), 'utf8'));

/** The fixture as the site loads it: rules data, entries derived and linked, and a rules page context. */
export async function fixtureSite() {
  const rulesDir = join(RULES_FIXTURE, 'rulesets/fixture-rules/rules');
  const files: Record<string, unknown> = {};
  for (const file of (await readdir(rulesDir, { recursive: true })).filter((f) => f.endsWith('.json'))) {
    files[file.split('\\').join('/')] = JSON.parse(await readFile(join(rulesDir, file), 'utf8'));
  }
  const definition = (await fixtureJson('rulesets/fixture-rules/ruleset.json')) as RulesetDefinition;
  const data: RulesData = rulesData(definition, files);
  const contentDir = join(RULES_FIXTURE, 'content');
  const entries: Entry[] = [];
  for (const file of (await readdir(contentDir, { recursive: true })).filter((f) => f.endsWith('.json'))) {
    entries.push(JSON.parse(await readFile(join(contentDir, file), 'utf8')) as Entry);
  }
  const { ruleset: module } = (await import('../fixtures/rules/rulesets/fixture-rules/index.ts')) as { ruleset: RulesetModule };
  const all = loadLibrary(entries, [data], () => module);
  return { data, all, ctx: rulesContext(data, all, [data], module), module };
}
