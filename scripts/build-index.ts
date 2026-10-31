import { validateLibrary } from './validate/index.ts';

// SPEC.md §9.1 step 1: the build fails if validation fails. Writing
// site/public/library.json arrives with the index builder (#9); until then
// the site reads content/ directly (site/src/lib/library.ts).
const { files, errors, warnings } = await validateLibrary('content');

if (errors.length > 0) {
  for (const { file, message } of errors) console.error(`content/${file}: ${message}`);
  console.error(`build:index: ${errors.length} validation errors; run npm run validate.`);
  process.exit(1);
}
console.log(`build:index: ${files.length} entries validated, ${warnings.length} warnings.`);
