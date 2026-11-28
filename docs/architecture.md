# Architecture

## Purpose

An overview of the whole system: what the library is, how an entry gets from a
request to the live site, the technology it's built on, where things are in the
repo, and the terms every doc uses.

The library is a static GitHub Pages gallery of D&D 5e content, built on SRD 5.2. Claude
routines generate entries as JSON files in response to GitHub issues, open one
PR per batch, and revise the batch from review comments. CI validates every
entry against strict schemas and rule-derived checks. Merging a PR to `main` is
the only step that publishes anything. It's a private tool for now, but the repo
and site are public, and licensing, attribution, and stable URLs are right so it
can be shared later.

## Behavior

### Pipeline

```
GitHub issue (request)
        │
        ▼
Claude routine ── reads config, the ruleset module, the library index
        │         writes content/<ruleset>/<type>/<id>.json (inputs only)
        │         runs npm run validate until clean
        ▼
Pull request on a gen/ branch (content lane, "Closes #n")
        │
        ├── validate.yml: lane rules, schemas, checks, refs, build → job summary
        │
        ├── review comments ──► routine revises, re-validates, pushes, replies
        │
        ▼
Merge to main ──► deploy.yml: build the index (derive) → astro build → Pages preview (next/)
Release tag ─────► deploy.yml: the same build of the tag → Pages production
```

Each stage has its doc: requests, routines, and revision in
[generation.md](generation.md); entries and validation in
[content-model.md](content-model.md) and [rulesets.md](rulesets.md); the build
and the gallery in [site.md](site.md); CI and lanes in
[workflow.md](workflow.md).

### Technology

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript, Node 22 LTS | One language for scripts, validator, and site |
| Package manager | npm | Lockfile committed; installs use `npm ci` |
| Site generator | Astro, static output | One HTML page per entry; the gallery is a client-side island |
| Island framework | Preact | Small runtime, enough for filters and search |
| Schema validation | Ajv, JSON Schema draft 2020-12 | Schemas are plain JSON files |
| Markdown in text fields | `marked`, sanitized | A limited subset ([content-model.md](content-model.md#text-fields)) |
| PNG capture | `html-to-image` | Fonts self-hosted so capture is faithful |
| Styling | Plain CSS | Custom properties, cascade layers, nesting, container queries ([styling.md](styling.md)) |
| Fonts | Alegreya, Alegreya SC, Alegreya Sans (OFL) via `@fontsource` | No external font requests |
| UI icons | Lucide (ISC), inlined SVG | A handful of control icons |
| CSS lint | Stylelint | Forbids literal design values outside `tokens/` |
| Tests | Vitest; Playwright with axe-core | Unit suites, with happy-dom as the environment of a component test file that types and moves focus; accessibility checks and screenshots of built pages |

The site is served from `https://bardic-inspiration.github.io/ttrpg-library/`.
Astro's `base` is `/ttrpg-library/`, held in `lib/site.ts`, and every internal
link goes through it. A build can set another base through `SITE_BASE`, as the
preview does ([Deploy](workflow.md#deploy)).

### Repository layout

```
content/<ruleset>/<type>/<id>.json       entries
assets/images/<ruleset>/<type>/<id>.*    optional art
schemas/envelope.schema.json             the envelope every entry shares
schemas/component.schema.json            the envelope of a component (content-model.md)
schemas/primitive.schema.json, rules-*.schema.json   rules data files (rulesets.md)
rulesets/module.ts                       the contract every ruleset module meets
rulesets/<ruleset>/                      everything ruleset-specific (rulesets.md)
lib/                                     ruleset-independent helpers for scripts and the site, and the library root (site.md)
config/                                  types.json, defaults.json, export.json, blocklist.json, licenses.json
scripts/
  validate/        the validator CLI and checks
  lane/            lane rules for the lane CI job
  links/           the link check
  build-index/     content to library.json, data copies, export bundles
  with-library/    runs npm scripts with a variable such as LIBRARY_ROOT set, in any shell (site.md "Library root")
  build-preview/   `build` at the preview's site base (workflow.md "Deploy")
  pr-summary/      the job summary for changed entries
  generate/        request defaults and the gap-fill picker
  import/          the import script: an import issue's file to entries
  srd-coverage/    SRD manifest records the library lacks
  srd-extract/     SRD PDF text extraction for import sessions (Python; not run in CI)
  serve/, a11y/, snapshots/, browser/   serving and browser checks of the built site
site/                                    the Astro project (site.md)
tests/                                   Vitest suites and fixtures
.claude/                                 session settings, hooks, skills, and archived skills
.github/                                 workflows, labeler, issue and PR templates, Dependabot
docs/                                    these docs (README.md is the index)
spec/tracks/                             development tracks' specs: ongoing design not yet built
AGENTS.md, CLAUDE.md, README.md          working guide and repo intro
CHANGELOG.md                             what each release changed (workflow.md "Releases")
LICENSE, LICENSE-CONTENT, ATTRIBUTION.md licensing (licensing.md)
```

npm scripts:

| Script | Does |
|---|---|
| `validate` | Validate every entry |
| `build:index` | Validate, then write `library.json` and the data copies |
| `build` | `build:index`, then `astro build` |
| `build:preview` | `build` at the preview's site base, `/ttrpg-library/next/` ([Deploy](workflow.md#deploy)) |
| `dev` | Run the site locally |
| `build:originals` | `build` for the fixture rulesets' library ([Library root](site.md#library-root)) |
| `dev:originals` | Index the fixture rulesets, then run their site locally |
| `check` | Types, `astro check`, Stylelint, and the link check |
| `links` | The link check alone |
| `test` | Vitest |
| `test:originals` | The fixture rulesets' own tests ([Fixture rulesets](rulesets.md#fixture-rulesets)) |
| `a11y` | Axe checks against the built site |
| `snapshots` | On-demand screenshots at 390, 820, and 1440px |
| `gap-fill` | Print the type and bucket gap fill would take |
| `import` | Import one import issue's file into `content/` ([Imports](generation.md#imports)) |
| `srd-coverage` | List the SRD entries the library lacks |

Every script runs the same under sh on Linux and cmd.exe on Windows, so none
uses shell syntax or a Unix-only command; `tests/portable-scripts.test.ts`
checks them. `build:originals` and `dev:originals` set `LIBRARY_ROOT` through
`scripts/with-library/`, which runs npm scripts in order with it set, and
`build:preview` sets `SITE_BASE` the same way.

### Terms

- **Entry:** one item in the library, such as a creature, stored as one JSON
  file. Either an SRD entry or a custom entry.
- **Ruleset:** a game system's rules, as one module in `rulesets/<ruleset>/`.
  The library's one ruleset is `dnd-5e-2024`; two fixture rulesets test the
  generic code ([Fixture rulesets](rulesets.md#fixture-rulesets)).
- **Type:** a kind of entry within a ruleset, such as `creature`, `spell`,
  or `class`.
- **Envelope:** the fixed keys every entry has, around its `stats`.
- **Stats:** an entry's rules data, validated by its type's schema.
- **Derived value:** a number the ruleset computes from an entry's inputs, such
  as a creature's HP. Never stored.
- **Token:** markup in rules text that renders a value or a link: a ruleset
  token such as `{dmg:2d6:fire}`, or `{ref:<type>/<id>}`.
- **Ref:** a link from one entry to another, keyed `<type>/<id>`. Its reverse is
  a back-reference.
- **Facet:** a `stats` or derived path the registry lifts into the index for
  filtering and sorting.
- **Registry:** `config/types.json`, the display and generation defaults per
  type.
- **Routine:** a scheduled or on-demand Claude run that works content issues.
- **Lane:** the kind of a PR, content or dev, set by its branch prefix.
- **Track:** ongoing development outside a version's build, with a tracking
  issue and its unbuilt design in `spec/tracks/`.
- **Version spec:** a version's unbuilt design, one file per area, in
  `spec/v<version>/`.

## Where the rules live

- `package.json`: the scripts and dependencies.
- `site/astro.config.mjs` and `lib/site.ts`: the site base.

## Extending

Each topic doc has its own "Extending" section: types, rulesets, and formulas
in [rulesets.md](rulesets.md#extending); fields and art in
[content-model.md](content-model.md#extending); filters and templates in
[site.md](site.md#extending); visual changes and the palette in
[styling.md](styling.md#extending); exporters in
[export.md](export.md#extending).
