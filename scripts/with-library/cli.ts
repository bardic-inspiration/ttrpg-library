// `with-library <library root> <npm script>...` (docs/site.md#library-root): runs each npm script in
// order with LIBRARY_ROOT set to the root, stopping at the first that fails. Used by
// `build:originals` and `dev:originals` in place of shell syntax for setting a variable.

import { spawnSync } from 'node:child_process';
import { libraryRuns } from './index.ts';

const [root, ...scripts] = process.argv.slice(2);
if (!root || scripts.length === 0) {
  console.error('Usage: with-library <library root> <npm script>...');
  process.exit(1);
}
for (const { command, args, env, shell } of libraryRuns(root, scripts, process.env, process.execPath)) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
