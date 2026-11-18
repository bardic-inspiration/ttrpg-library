import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RulesetModule } from '../../rulesets/module.ts';
import { validateLibrary } from '../validate/index.ts';
import { loadRegistry, loadRuleset, PROJECT_ROOT } from '../validate/schema.ts';
import { parseNameStatus, renderSummary } from './index.ts';

// Writes the content-checks job summary (docs/workflow.md#ci-checks). The workflow passes
// the PR's base and head commits as environment variables, and runs this after
// `npm run validate` passed on the checked-out content, which the summary reads.
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!base || !head) throw new Error('BASE_SHA and HEAD_SHA must be set');

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });

const read = (commit: string, path: string): unknown => {
  try {
    return JSON.parse(git('show', `${commit}:${path}`));
  } catch {
    return undefined;
  }
};

const changes = parseNameStatus(git('diff', '--name-status', '--no-renames', `${base}...${head}`, '--', 'content/'));
const mergeBase = git('merge-base', base, head).trim();
const registry = await loadRegistry();
const modules = new Map<string, RulesetModule>();
for (const id of Object.keys(registry)) {
  const loaded = await loadRuleset(id);
  if (loaded) modules.set(id, loaded.module);
}
const markdown = renderSummary({
  // A removed entry is read from the merge base, and a modified one's links are compared with it there.
  changes: changes.map((change) => ({ ...change, base: change.status === 'added' ? undefined : read(mergeBase, change.path) })),
  library: await validateLibrary(join(PROJECT_ROOT, 'content')),
  registry,
  modules,
});

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else console.log(markdown);
