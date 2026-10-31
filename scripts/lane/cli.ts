import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { checkLane } from './index.ts';

// The `lane` job in validate.yml (SPEC.md §12.1). The workflow passes the PR's
// branch, base and head commits, and labels as environment variables.
const env = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};

const diff = execFileSync('git', ['diff', '--name-only', `${env('BASE_SHA')}...${env('HEAD_SHA')}`], {
  encoding: 'utf8',
});
const paths = diff.split('\n').filter(Boolean);
const labels = JSON.parse(env('LABELS')) as string[];
const { lane, contentChanged, errors } = checkLane({ branch: env('BRANCH'), paths, labels });

console.log(`Lane: ${lane ?? 'none'}. ${paths.length} paths changed; content changed: ${contentChanged}.`);
for (const error of errors) {
  // One annotation per error; %0A keeps multi-line messages together.
  console.log(`::error title=Lane rules::${error.replaceAll('\n', '%0A')}`);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `lane=${lane ?? ''}\ncontent-changed=${contentChanged}\n`);
}
process.exitCode = errors.length > 0 ? 1 : 0;
