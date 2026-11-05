import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { checkLinks, isScanned } from './index.ts';

// `npm run links`, and a step of the `lane` job in validate.yml
// (docs/workflow.md#link-check). Scans every tracked text file.
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const files = new Map(tracked.filter(isScanned).filter(existsSync).map((path) => [path, readFileSync(path, 'utf8')]));
const problems = checkLinks(files, (path) => existsSync(path));

for (const problem of problems) {
  console.error(process.env.GITHUB_ACTIONS ? `::error::${problem}` : problem);
}
console.log(`${files.size} files checked, ${problems.length} broken links.`);
process.exit(problems.length > 0 ? 1 : 0);
