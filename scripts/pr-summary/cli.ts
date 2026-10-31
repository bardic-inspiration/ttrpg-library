import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { type EntrySummary, parseNameStatus, renderSummary } from './index.ts';

// Writes the content-checks job summary (SPEC.md §12.1). The workflow passes
// the PR's base and head commits as environment variables.
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!base || !head) throw new Error('BASE_SHA and HEAD_SHA must be set');

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });

const read = (commit: string, path: string): EntrySummary | undefined => {
  try {
    return JSON.parse(git('show', `${commit}:${path}`)) as EntrySummary;
  } catch {
    return undefined;
  }
};

const changes = parseNameStatus(git('diff', '--name-status', '--no-renames', `${base}...${head}`, '--', 'content/'));
const markdown = renderSummary(
  changes.map((change) => ({
    ...change,
    // A removed entry is read from the merge base, the rest from the PR head.
    entry: read(change.status === 'removed' ? git('merge-base', base, head).trim() : head, change.path),
  })),
);

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else console.log(markdown);
