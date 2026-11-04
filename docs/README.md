# Docs

The index of `docs/` and the conventions every doc follows. The approach was
decided in #196.

Until the `SPEC.md` migration (#108) lands, `SPEC.md` remains the source of
truth for what the library does. The migration writes the topic files listed
under "Coming with the migration" and moves them into the index.

## Index

| File | Covers | Read it when |
|---|---|---|
| [`decisions.md`](decisions.md) | What each version decided and why, and the principles that carry forward | Weighing a design, or asking why something is the way it is |
| [`routines.md`](routines.md) | Routine prompts, schedule, and run order | Setting up or changing a routine; a routine reads it on every run |
| [`SRD_CC_v5.2.pdf`](SRD_CC_v5.2.pdf) | The SRD 5.2 reference copy | Transcribing or checking an SRD entry |

### Coming with the migration

| File | Covers |
|---|---|
| `architecture.md` | Pipeline overview, technology choices, repo layout, and the shared terms (entry, type, ruleset, facet, tag, ref, token, derived value) every doc and the stage spec use as defined |
| `content-model.md` | Envelope, IDs, tags, meta, text fields, refs, situational fields, SRD vs custom entries, validation |
| `rulesets.md` | The ruleset module contract, derivation, tokens, notes per type for `dnd-5e-2024` |
| `generation.md` | Requests, routines, skills, defaults, gap fill, revision, SRD import |
| `site.md` | Index build, gallery, detail pages, templates |
| `styling.md` | Tokens, themes, accessibility, refinement workflow |
| `export.md` | Exporters, JSON, PNG, print |
| `workflow.md` | Lanes, CI, labels, repo settings, review, issue tracking |
| `licensing.md` | Licenses, attribution, blocklist, review for a new ruleset |

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
  link check (#108) catches any that are missed.

### Decisions

`decisions.md` records what each version did and why. It is history, not a
set of rules: later versions may change any decision. Each version adds its
own section, and a PR that makes a decision adds its row (`AGENTS.md`
"Rules"). The principles carry forward as the guide for weighing new designs.

### Keeping docs current

A dev PR that changes behavior updates the docs that describe it, in the same
PR, so `main` is complete after every merge.
