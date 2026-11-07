import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { checkLane, needsMigrationLabel, waitForLabel } from './index.ts';

// The `lane` job in validate.yml (docs/workflow.md#ci-checks). The workflow passes the PR's
// branch, base and head commits, and labels as environment variables, and the
// repository, PR number, and a read token for checking the PR's live labels.
const env = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};

const diff = execFileSync('git', ['diff', '--name-only', `${env('BASE_SHA')}...${env('HEAD_SHA')}`], {
  encoding: 'utf8',
});
const paths = diff.split('\n').filter(Boolean);
let labels = JSON.parse(env('LABELS')) as string[];

// The event payload's labels are from when the run started. The labeler adds
// `migration` a few seconds later, and its label event starts no new run, so
// wait for it by reading the PR's current labels (docs/workflow.md#labeling).
const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: pr } = process.env;
if (needsMigrationLabel({ branch: env('BRANCH'), paths, labels }) && token && repo && pr) {
  console.log('The migration label is not in the event payload yet; waiting for the labeler.');
  labels = await waitForLabel('migration', async () => {
    const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`Reading the PR's labels failed: ${response.status} ${response.statusText}`);
    const body = (await response.json()) as { labels: { name: string }[] };
    return body.labels.map((l) => l.name);
  });
  console.log(`Labels now: ${labels.join(', ') || 'none'}.`);
}
const { lane, contentChanged, docsOnly, textOnly, milestone, errors } = checkLane({ branch: env('BRANCH'), paths, labels });

console.log(`Lane: ${lane ?? 'none'}. ${paths.length} paths changed; content changed: ${contentChanged}; docs only: ${docsOnly}; text only: ${textOnly}; milestone: ${milestone}.`);
for (const error of errors) {
  // One annotation per error; %0A keeps multi-line messages together.
  console.log(`::error title=Lane rules::${error.replaceAll('\n', '%0A')}`);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `lane=${lane ?? ''}\ncontent-changed=${contentChanged}\ndocs-only=${docsOnly}\ntext-only=${textOnly}\nmilestone=${milestone}\n`);
}
process.exitCode = errors.length > 0 ? 1 : 0;
