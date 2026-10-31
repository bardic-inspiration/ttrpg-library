import { validateLibrary } from './index.ts';

const root = process.argv[2] ?? 'content';
const { files, errors } = await validateLibrary(root);

for (const { file, message } of errors) {
  console.error(`${root}/${file}: ${message}`);
}
console.log(`${files.length} entries checked, ${errors.length} errors.`);
process.exitCode = errors.length > 0 ? 1 : 0;
