// `npm run build:index` (docs/site.md#index-build steps 1–2): validates the library's content/,
// then writes library.json and data/ into its public folder: site/public for the repo's own
// library, or another library's own folder when `LIBRARY_ROOT` names it (docs/site.md#library-root).
// Fails, writing nothing, if validation fails. Usage: build-index [content root] [out dir].

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildIndex, writeIndex, type BuildOptions } from './index.ts';
import { libraryRoot, REPO_ROOT, siteDirs } from '../../lib/library-root.ts';

const library = libraryRoot();
// Another library brings its own rulesets and registry; the repo's own are the defaults.
const options: BuildOptions =
  library === REPO_ROOT
    ? {}
    : { rulesetsRoot: join(library, 'rulesets'), registry: JSON.parse(await readFile(join(library, 'config/types.json'), 'utf8')) };
const root = process.argv[2] ?? join(library, 'content');
const out = process.argv[3] ?? siteDirs(library).publicDir;
const result = await buildIndex(root, options);

if (result.errors.length > 0) {
  for (const { file, message } of result.errors) console.error(`${file}: ${message}`);
  console.error(`build:index: ${result.errors.length} validation errors; run npm run validate.`);
  process.exit(1);
}
await writeIndex(root, out, result);
console.log(`build:index: ${result.records.length} entries indexed, ${result.warnings.length} warnings.`);
