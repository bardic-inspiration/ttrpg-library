#!/bin/bash
# SessionStart hook: installs dependencies in a cloud session so the local
# checks can run (AGENTS.md "Commands"). Runs only in Claude Code on the web;
# a local machine is set up by hand (README.md).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Nothing to install until the npm project exists (SPEC.md §16, milestone 1).
if [ ! -f package-lock.json ]; then
  exit 0
fi

# `npm ci` installs exactly what the committed lockfile pins and never
# rewrites it, as CI does (SPEC.md §12.1). `npm install` reuses what's already
# in node_modules, but it can rewrite package-lock.json (it dropped `"dev":
# true` from esbuild's optional platform packages), leaving an unrequested
# change in the session.
npm ci --no-audit --no-fund
