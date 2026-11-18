import { validateLibrary } from './index.ts';

const root = process.argv[2] ?? 'content';
const { files, errors, warnings } = await validateLibrary(root);

// Each issue names its file from the repo root (docs/content-model.md#validation).
for (const { file, message } of errors) console.error(`error   ${file}: ${message}`);
for (const { file, message } of warnings) console.warn(`warning ${file}: ${message}`);
console.log(`${files.length} entries checked, ${errors.length} errors, ${warnings.length} warnings.`);
process.exitCode = errors.length > 0 ? 1 : 0;
