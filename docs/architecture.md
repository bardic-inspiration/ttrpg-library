# Architecture

## Purpose

An overview of the whole system: what the library is, how an entry gets from a
request to the live site, the technology it's built on, where things are in the
repo, and the terms every doc uses.

The library is a static GitHub Pages gallery of D&D 5e (SRD 5.2) content. Claude
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
Merge to main ──► deploy.yml: build the index (derive) → astro build → Pages
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
| Search | MiniSearch | Field boosting, prefix and fuzzy matching |
| Markdown in text fields | `marked`, sanitized | A limited subset ([content-model.md](content-model.md#text-fields)) |
| PNG capture | `html-to-image` | Fonts self-hosted so capture is faithful |
| Styling | Plain CSS | Custom properties, cascade layers, nesting, container queries ([styling.md](styling.md)) |
| Fonts | Alegreya, Alegreya SC, Alegreya Sans (OFL) via `@fontsource` | No external font requests |
| UI icons | Lucide (ISC), inlined SVG | A handful of control icons |
| CSS lint | Stylelint | Forbids literal design values outside `tokens/` |
| Tests | Vitest; Playwright with axe-core | Unit suites and contrast; accessibility checks on built pages |

The site is served from `https://bardic-inspiration.github.io/ttrpg-library/`.
Astro's `base` is `/ttrpg-library/`, held in `lib/site.ts`, and every internal
link goes through it.

### Repository layout

```
content/<ruleset>/<type>/<id>.json       entries
assets/images/<ruleset>/<type>/<id>.*    optional art
schemas/envelope.schema.json             the envelope every entry shares
rulesets/module.ts                       the contract every ruleset module meets
rulesets/<ruleset>/                      everything ruleset-specific (rulesets.md)
lib/                                     ruleset-independent helpers for scripts and the site
config/                                  types.json, defaults.json, export.json, blocklist.json
scripts/
  validate/        the validator CLI and checks
  lane/            lane rules for the lane CI job
  links/           the link check
  build-index/     content to library.json, data copies, export bundles
  pr-summary/      the job summary for changed entries
  generate/        request defaults and the gap-fill picker
  srd-coverage/    SRD manifest records the library lacks
  serve/, a11y/, snapshots/, browser/   serving and browser checks of the built site
site/                                    the Astro project (site.md)
tests/                                   Vitest suites and fixtures
.claude/                                 session settings, hooks, and skills
.github/                                 workflows, labeler, issue and PR templates, Dependabot
docs/                                    these docs (README.md is the index)
spec/v2/                                 the v2 stage spec: design not yet built
AGENTS.md, CLAUDE.md, README.md          working guide and repo intro
LICENSE, LICENSE-CONTENT, ATTRIBUTION.md licensing (licensing.md)
```

npm scripts:

| Script | Does |
|---|---|
| `validate` | Validate every entry |
| `build:index` | Validate, then write `library.json` and the data copies |
| `build` | `build:index`, then `astro build` |
| `dev` | Run the site locally |
| `check` | Types, `astro check`, Stylelint, and the link check |
| `links` | The link check alone |
| `test` | Vitest, including contrast |
| `a11y` | Axe checks against the built site |
| `snapshots` | On-demand visual captures |
| `gap-fill` | Print the type and bucket gap fill would take |
| `srd-coverage` | List the SRD entries the library lacks |

### Terms

- **Entry:** one item in the library, such as a creature, stored as one JSON
  file. Either an SRD entry or a custom entry.
- **Ruleset:** a game system's rules, as one module in `rulesets/<ruleset>/`.
  The one ruleset is `dnd-5e-2024`.
- **Type:** a kind of entry within a ruleset: `creature`, `magic-item`, `spell`.
- **Envelope:** the fixed keys every entry has, around its `stats`.
- **Stats:** an entry's rules data, validated by its type's schema.
- **Derived value:** a number the ruleset computes from an entry's inputs, such
  as a creature's HP. Never stored.
- **Token:** markup in rules text that renders a value or a link: a ruleset
  token such as `{dmg:2d6:fire}`, or `{ref:<type>/<id>}`.
- **Ref:** a link from one entry to another, keyed `<type>/<id>`. Its reverse is
  a back-reference.
- **Tag:** open organizational data on an entry, filterable in the gallery.
- **Facet:** a `stats` or derived path the registry lifts into the index for
  filtering and sorting.
- **Registry:** `config/types.json`, the display and generation defaults per
  type.
- **Routine:** a scheduled or on-demand Claude run that works content issues.
- **Lane:** the kind of a PR, content or dev, set by its branch prefix.
- **Stage spec:** `spec/v2/`, the design not yet built.

## Where the rules live

- `package.json`: the scripts and dependencies.
- `site/astro.config.mjs` and `lib/site.ts`: the site base.

## Extending

Each topic doc has its own "Extending" section: types, rulesets, and formulas
in [rulesets.md](rulesets.md#extending); fields and art in
[content-model.md](content-model.md#extending); filters and templates in
[site.md](site.md#extending); visual changes and themes in
[styling.md](styling.md#extending); exporters and page sizes in
[export.md](export.md#extending).
