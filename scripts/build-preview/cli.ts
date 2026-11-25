// `npm run build:preview` (docs/workflow.md#deploy): `npm run build` with SITE_BASE set to the
// preview's base, so the site is built as the preview, in any shell.

import { spawnSync } from 'node:child_process';
import { PREVIEW_BASE } from '../../lib/site.ts';
import { npmRuns } from '../with-library/index.ts';

for (const { command, args, env, shell } of npmRuns({ SITE_BASE: PREVIEW_BASE }, ['build'], process.env, process.execPath)) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
