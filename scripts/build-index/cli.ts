// `npm run build:index` (SPEC.md §9.1 steps 1–2): validates content/, then
// writes site/public/library.json and site/public/data/. Fails, writing
// nothing, if validation fails. Usage: build-index [content root] [out dir].

import { join } from 'node:path';
import { buildIndex, writeIndex } from './index.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';

const root = process.argv[2] ?? join(PROJECT_ROOT, 'content');
const out = process.argv[3] ?? join(PROJECT_ROOT, 'site/public');
const result = await buildIndex(root);

if (result.errors.length > 0) {
  for (const { file, message } of result.errors) console.error(`${file}: ${message}`);
  console.error(`build:index: ${result.errors.length} validation errors; run npm run validate.`);
  process.exit(1);
}
await writeIndex(root, out, result);
console.log(`build:index: ${result.records.length} entries indexed, ${result.warnings.length} warnings.`);
