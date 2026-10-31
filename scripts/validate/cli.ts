import { validateLibrary } from './index.ts';

const root = process.argv[2] ?? 'content';
const { files, errors, warnings } = await validateLibrary(root);

for (const { file, message } of errors) console.error(`error   ${root}/${file}: ${message}`);
for (const { file, message } of warnings) console.warn(`warning ${root}/${file}: ${message}`);
console.log(`${files.length} entries checked, ${errors.length} errors, ${warnings.length} warnings.`);
process.exitCode = errors.length > 0 ? 1 : 0;
