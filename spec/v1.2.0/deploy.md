---
issue: 118
depends: []
---

# Production and preview

## Goal

Keep the released version live while the next one is built and published
beside it. The site isn't public yet, so this is a dry run of the practice
v2.0.0's live hosting will need. It serves P1 (a static build with no
runtime services) and P7 (merging stays the only step that publishes, now to
the preview).

## Current

- [Deploy](../../docs/workflow.md#deploy): `deploy.yml` builds `main` and
  publishes it to GitHub Pages on every push.
- [Releases](../../docs/workflow.md#releases): a release is a tagged point on
  `main`, not a deploy.
- `lib/site.ts`: `SITE_BASE`, the one site base, `/ttrpg-library/`.

## Design

### Two builds, one Pages site

GitHub Pages serves one site per repository, so one deploy publishes two
builds in one artifact:

| Site | Built from | Served at |
|---|---|---|
| **Production** | The latest release tag (`v*`) | The site base, `/ttrpg-library/` |
| **Preview** | `main` | `/ttrpg-library/next/` |

- **Each build runs from its own checkout**, with that checkout's lockfile,
  code, and content: install, validate, and build, as today. The two outputs
  are combined into one folder, the preview's under `next/`, and uploaded as
  the Pages artifact.
- **The deploy runs** on a push to `main`, on a pushed `v*` tag, and on
  `workflow_dispatch`. Every run rebuilds both, so the artifact always holds
  the latest tag and the latest `main`.
- **The site base is set per build.** The preview build sets it to
  `/ttrpg-library/next/` through an environment variable that
  `lib/site.ts` reads, with `/ttrpg-library/` as the default, so Astro's
  `base` and the URLs in `library.json` both follow it. It's set from a Node
  script, not shell syntax ([`AGENTS.md`](../../AGENTS.md) "Rules").
- **Before the first release that knows about this**, production is built
  from the `v1.1.0` tag, whose code has the default base. A tag's code
  needs nothing from the preview, so any older tag builds as it always did.

### The preview

- **Every preview page says it's a preview**: a notice at the top of each
  page names it the next version and links to the same path on production,
  or production's Library where the path doesn't exist there.
- **Not indexed:** preview pages carry `<meta name="robots" content="noindex">`.
- **Content waits for the release.** Content merged to `main` shows on the
  preview, and on production only once a release tags it. Releases name
  their content changes in the changelog as they do now.

### Releases

A release now publishes: tagging the release PR's squash commit deploys it
to production. The release PR's steps don't change.

## Done when

- `deploy.yml` builds the latest `v*` tag at the site base and `main` under
  `next/`, in one Pages artifact, on a push to `main`, a `v*` tag, and
  `workflow_dispatch`.
- A test checks that the site base follows the environment variable and
  defaults to `/ttrpg-library/`, and that a preview build's pages carry the
  notice and `noindex` while a production build's don't.
- `docs/workflow.md` "Deploy" and "Releases" describe the two sites.
- Seeing both sites live on GitHub Pages is a Testing backlog item.

## Open questions

- **Patch releases while v1.2.0 is built.** Production follows the latest
  tag, and every tag is a point on `main`. Once v1.2.0 work has merged, a
  patch tag (`v1.1.1`) on `main` would publish the unfinished v1.2.0 to
  production. Either no patch releases are made while a version is in
  development (Spot Fixes ship with v1.2.0), or patches come from a branch
  cut at the last release tag, which the lane check and branch rules don't
  allow today.

## Out of scope

- A separate hosting platform, and publishing content separately from code
  releases: v2.0.0 (#370).
