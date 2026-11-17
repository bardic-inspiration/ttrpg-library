// `npm run import` (docs/generation.md#imports): one import issue's file into entries under
// content/, its line appended to ATTRIBUTION.md, and its skip-list section printed for the PR body.
// A rejected issue exits 2 with the reason to comment; any other failure exits 1.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadDefaults } from '../generate/defaults.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { addAttribution, loadImportLibrary, runImport, skipListSection } from './index.ts';

const { values } = parseArgs({
  options: {
    issue: { type: 'string' },
    format: { type: 'string' },
    file: { type: 'string' },
    work: { type: 'string' },
    author: { type: 'string' },
    url: { type: 'string' },
    license: { type: 'string' },
    ruleset: { type: 'string' },
    date: { type: 'string' },
  },
});
const missing = ['issue', 'format', 'file', 'work', 'author', 'url', 'license'].filter((k) => !values[k as keyof typeof values]);
if (missing.length > 0) {
  console.error(`Missing ${missing.map((k) => `--${k}`).join(', ')}.`);
  process.exit(1);
}
const defaults = await loadDefaults();
const ruleset = values.ruleset ?? defaults.ruleset;
let file: unknown;
try {
  file = JSON.parse(await readFile(values.file!, 'utf8'));
} catch (e) {
  console.error(`The attached file isn't JSON a translator reads: ${(e as Error).message}`);
  process.exit(2);
}
const outcome = runImport(
  {
    issue: Number(values.issue),
    format: values.format!,
    file,
    work: values.work!,
    author: values.author!,
    url: values.url!,
    license: values.license!,
    ruleset,
    date: values.date ?? new Date().toISOString().slice(0, 10),
    tags: defaults.tags,
  },
  await loadImportLibrary(ruleset),
);
if (outcome.rejected !== undefined) {
  console.error(outcome.rejected);
  process.exit(2);
}
for (const entry of outcome.entries) {
  const path = join(PROJECT_ROOT, 'content', entry.ruleset, entry.type, `${entry.id}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`);
  console.log(`wrote content/${entry.ruleset}/${entry.type}/${entry.id}.json`);
}
if (outcome.entries.length > 0) {
  const attribution = join(PROJECT_ROOT, 'ATTRIBUTION.md');
  await writeFile(attribution, addAttribution(await readFile(attribution, 'utf8'), outcome.attribution));
}
console.log(`\n${skipListSection(Number(values.issue), values.work!, outcome.skipped)}`);
