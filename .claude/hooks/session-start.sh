#!/bin/bash
# SessionStart hook: installs dependencies in a cloud session so the local
# checks can run (AGENTS.md "Commands"). Runs only in Claude Code on the web;
# a local machine is set up by hand (CONTRIBUTING.md).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Nothing to install until the npm project exists (SPEC.md §16, milestone 1).
if [ ! -f package-lock.json ]; then
  exit 0
fi

# The container is cached once this hook completes, so `npm install` (which
# reuses what's already there) beats `npm ci` here.
npm install --no-audit --no-fund
