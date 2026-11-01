// `npm run gap-fill` (SPEC.md §8.2 step 5): reads site/public/library.json and
// config/types.json, and prints the type and bucket label a gap-fill run
// generates for, in the ruleset config/defaults.json names.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { loadDefaults } from './defaults.ts';
import { pickGap, type GapRecord, type GapRegistry } from './gap.ts';

const library = await readFile(join(PROJECT_ROOT, 'site/public/library.json'), 'utf8').catch(() => {
  console.error('site/public/library.json not found; run `npm run build:index` first.');
  process.exit(1);
});
const records = JSON.parse(library) as GapRecord[];
const registry = JSON.parse(await readFile(join(PROJECT_ROOT, 'config/types.json'), 'utf8')) as GapRegistry;
const { ruleset } = await loadDefaults();

const pick = pickGap(records, registry, ruleset);
if (!pick) {
  console.error(`No type in ${ruleset} has gap buckets.`);
  process.exitCode = 1;
} else {
  console.log(`${pick.type} ${pick.bucket.label}`);
}
