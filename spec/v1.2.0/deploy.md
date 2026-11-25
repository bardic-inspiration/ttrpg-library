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
- [Deploy](../../docs/workflow.md#deploy) "The site base" and "The
  preview": `SITE_BASE`, `npm run build:preview`, and the preview notice.

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
- **The preview build** is `npm run build:preview`, which sets the site base
  to `/ttrpg-library/next/`.
- **Before the first release that knows about this**, production is built
  from the `v1.1.0` tag, whose code has the default base. A tag's code
  needs nothing from the preview, so any older tag builds as it always did.

### The preview

- **Content waits for the release.** Content merged to `main` shows on the
  preview, and on production only once a release tags it. Releases name
  their content changes in the changelog as they do now.

### Releases

A release now publishes: tagging the release PR's squash commit deploys it
to production. The release PR's steps don't change.

- **No patch releases while a version is in development.** Every tag is a
  point on `main`, so once the next version's work has merged, a patch tag
  would publish it unfinished. Spot Fixes then ship with the next minor
  release. A patch release is made only while `main` holds nothing past the
  last release but Spot Fixes. Branches and the lane check don't change.

## Done when

- `deploy.yml` builds the latest `v*` tag at the site base and `main` under
  `next/`, in one Pages artifact, on a push to `main`, a `v*` tag, and
  `workflow_dispatch`.
- `docs/workflow.md` "Deploy" and "Releases" describe the two sites, and
  "Releases" says when a patch release can be made.
- Seeing both sites live on GitHub Pages is a Testing backlog item.

## Out of scope

- A separate hosting platform, and publishing content separately from code
  releases: v2.0.0 (#370).
