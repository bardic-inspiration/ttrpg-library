# Contributing

This project is built by AI coding sessions and humans following the same
process. **Read [`AGENTS.md`](AGENTS.md) first** — it is the canonical guide.
This file covers what a human needs to get set up, and the short version.

## Getting started

Node 22 LTS and npm ([`SPEC.md`](SPEC.md) §3.1). Then:

```bash
git clone https://github.com/bardic-inspiration/ttrpg-library
cd ttrpg-library
npm ci
npm run validate
npm run build
```

`npm run dev` serves the site locally. The full set of scripts, and which
ones each lane runs before a push, are in [`AGENTS.md`](AGENTS.md)
"Commands".

## The short version

- **Two lanes, one per PR.** Content (`content/`, `assets/images/`) on `gen/`,
  `revise/`, or `manual/` branches; everything else on `dev/` branches
  ([`SPEC.md`](SPEC.md) §12.4).
- **One concern per PR**, on a branch from `main`. Link its issue, or state
  the task in the description.
- **Test first, and the lane's checks green before you push** — CI runs the
  same scripts.
- **PRs land by squash merge** with the title as the commit message, so write
  the title in the lane's form and the description for whoever reads it next.
- **Never force-push a pushed branch**; merge `main` in to catch up.

The details — issues, branches, commits, PRs, merging — are in
[`docs/workflow.md`](docs/workflow.md).
