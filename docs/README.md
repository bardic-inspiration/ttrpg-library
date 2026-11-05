# Docs

The index of `docs/` and the conventions every doc follows. The approach was
decided in #196. These docs describe what is built; design not yet built is in
the stage spec, [`spec/v2/`](../spec/v2/README.md). The v1 spec is kept at the
`v1.0.0` tag.

## Index

| File | Covers | Read it when |
|---|---|---|
| [`architecture.md`](architecture.md) | What the library is, the pipeline, technology, repo layout, npm scripts, and the shared terms | Starting out, or looking for where something lives |
| [`content-model.md`](content-model.md) | Entries in every ruleset: envelope, IDs, tags, meta, text, tables, images, refs, situational fields, SRD vs custom entries, validation | Writing or validating any entry, or changing what an entry is |
| [`rulesets.md`](rulesets.md) | The ruleset module, derived values, tokens, and how creatures, magic items, and spells print | Working on `rulesets/`, a type's schema, or a stat block's wording |
| [`generation.md`](generation.md) | Requests, labels, the run order, defaults, the `generate` and `revise` skills, guidelines, schedule, gap buckets, SRD import | Changing how routines or skills work |
| [`site.md`](site.md) | The type registry, index build, pages, gallery, detail page, templates | Working on `site/`, `config/types.json`, or the index builder |
| [`styling.md`](styling.md) | The styling system, tokens, themes, visual direction, accessibility, refinement workflow | Changing how anything looks, or checking accessibility |
| [`export.md`](export.md) | Exporters, JSON, PNG, print, `config/export.json` | Working on exports or adding a translator |
| [`workflow.md`](workflow.md) | Lanes, labeling, CI, docs-only PRs, the link check, deploy, repo settings, review | Changing CI or lanes, or asking why a check failed |
| [`licensing.md`](licensing.md) | Licenses, SRD attribution, the blocklist, new rulesets | Adding content sources, art, or a ruleset |
| [`decisions.md`](decisions.md) | What each version decided and why, and the principles that carry forward | Weighing a design, or asking why something is the way it is |
| [`routines.md`](routines.md) | Routine prompts, schedule, and run order | Setting up or changing a routine; a routine reads it on every run |
| [`SRD_CC_v5.2.pdf`](SRD_CC_v5.2.pdf) | The SRD 5.2 reference copy | Transcribing or checking an SRD entry |

## Conventions

### What goes where

Each rule is stated once, in the place its reader already looks:

- **`docs/`**: reference for what is built and live, written for developers
  and dev sessions.
- **Skills and guidelines**: rules that routines follow. A routine reads only
  these and `docs/`, never the stage spec.
- **The stage spec** ([`spec/v2/`](../spec/v2/README.md)): design that
  isn't built yet.
- **Code, schemas, and data files**: the exact rules. A doc explains them and
  links to them; it doesn't restate them. A field's meaning goes in its
  schema's `description` keyword, not in a table in a doc.

### Kinds of doc

Reference and explanation only. A recurring task, such as adding a type or an
exporter, gets a short "Extending" section in its topic file. Tutorials wait
until the project has human newcomers.

### Topic files

- One subsystem per file, in this folder with no subfolders.
- About 100–300 lines. Split a file when it serves two different readers, not
  when it gets long.
- Every topic file has the same sections, in this order:
  1. **Purpose**: what the subsystem is for.
  2. **Behavior**: how it works, and the guarantees it keeps.
  3. **Where the rules live**: links to the code, schemas, and data files.
  4. **Extending**: how to add to it, where that's a recurring task.
- Add each new file to the index above, with what it covers and when to read
  it.

### Headings and citations

- Headings are the citation targets. Keep them short, stable noun phrases.
- Cite a doc as `docs/<file>.md#<heading>`, using GitHub's anchor for the
  heading. No section numbers.
- Renaming a heading breaks its citations. Update them in the same PR. The
  link check ([workflow.md](workflow.md#link-check)) catches any that are
  missed.

### Decisions

`decisions.md` records what each version did and why. It is history, not a
set of rules: later versions may change any decision. Each version adds its
own section, and a PR that makes a decision adds its row (`AGENTS.md`
"Rules"). The principles carry forward as the guide for weighing new designs.

### Keeping docs current

A dev PR that changes behavior updates the docs that describe it, in the same
PR, so `main` is complete after every merge.
