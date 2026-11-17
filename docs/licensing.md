# Licensing

## Purpose

What the library may contain and how it credits its sources: the licenses for
code and content, the SRD attribution, the licenses accepted for outside
material and how imported works are credited, the blocklist that keeps non-SRD
intellectual property out, and the review a new ruleset needs. The repo and site
are public, so this is right from day one.

## Behavior

### Licenses

- **Code:** MIT (`LICENSE`).
- **Content** (`content/` and `rulesets/*/guidelines/`): CC-BY-4.0
  (`LICENSE-CONTENT`), compatible with the SRD's terms.
- **Third-party assets:** the Alegreya fonts (SIL Open Font License 1.1) and
  Lucide icons (ISC), credited in `ATTRIBUTION.md`, which also credits any art.

### SRD attribution

The full SRD attribution statement is in `ATTRIBUTION.md`, the site footer on
every page, the `/about/` page, and after the last entry of every print run:

> This work includes material from the System Reference Document 5.2 ("SRD
> 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
> The SRD 5.2 is licensed under the Creative Commons Attribution 4.0
> International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode. This site adapts
> that material: it is reformatted for the web and its wording is composed
> from structured data.

The last sentence is the notice of modification the license requires of an
adapter: the site presents SRD material in its own house style
([SRD and custom entries](content-model.md#srd-and-custom-entries)).

PNG exports carry the short form, "Includes adapted SRD 5.2 material, CC-BY-4.0", in
the capture footer. Every printed page carries the same short form in its page
footer, since the full statement doesn't fit a 4×6 margin
([export.md](export.md#print)).

### Source allowlist

`config/licenses.json` is the one list of licenses the library accepts outside
material under, keyed by the kind of material. Licensing questions are
settled by editing it, not case by case.

- `licenses` holds each license by id, an SPDX id or `public-domain`, with
  its `name` and the `url` of its legal code.
- `kinds` lists the ids accepted for each kind of material: `import`
  (imported entries) takes `CC0-1.0`, `CC-BY-2.0`, `CC-BY-3.0`, and
  `CC-BY-4.0`; `art` (images, not yet built) takes those and
  `public-domain`. NC, ND, and SA works can't be relicensed under the
  library's CC-BY-4.0, so no kind takes them.

`lib/licenses.ts` checks the file, and the validator, the import script, and
the detail page read it. The import request's license dropdown lists the
`import` ids, and a test keeps them equal.

### Imported works

`ATTRIBUTION.md` ends with an "Imported works" section: one line per imported
work, naming the work, its author, where it's published, and its license with
a link to the legal code, and noting that it was adapted ("converted from the
Open5e format into this library's entries"), as CC-BY requires. The import
script appends the line, once per work, and the content PR adds it
([Imports](generation.md#imports)). Each imported entry's provenance line
credits the author and license too ([Meta](content-model.md#meta)).

### Blocklist

`config/blocklist.json` is a JSON array of non-SRD proper nouns:
product-identity monsters, named characters, settings, and named spell
prefixes ("Beholder", "Mind Flayer", "Forgotten Realms", "Mordenkainen", …).

- Matching runs across `name`, `summary`, `description`, and every string in
  `stats`, on word boundaries (any character that isn't a letter, digit, or
  underscore).
- It ignores case and diacritics ("Faerun" matches "Faerûn"), and catches cheap
  variants so the list holds only base forms: plurals in -s, -es, and -y to
  -ies; possessives with `'` or `’`; and the words of a multi-word term joined
  by whitespace, a hyphen, or nothing ("mind-flayer", "mindflayer"). Irregular
  plurals are listed as their own terms.
- A match is an error. A borderline false positive is fixed by a PR that edits
  the blocklist, so the decision is visible in history.

The blocklist is the minimum. The guidelines' naming rules and the SRD rules
([content-model.md](content-model.md#srd-and-custom-entries)) apply as well.

### New rulesets

Another ruleset needs its own licensing review and attribution statement before
it's added. Each ruleset's `attribution` key in `config/types.json` points to
its statement.

## Where the rules live

- `LICENSE`, `LICENSE-CONTENT`, `ATTRIBUTION.md`.
- `config/licenses.json` and `lib/licenses.ts`: the source allowlist.
- `config/blocklist.json`; the matcher is `termMatcher` in `lib/text.ts`.
- `site/src/components/Footer.astro`, `site/src/pages/about.astro`.

## Extending

| To add | Touch |
|---|---|
| A blocked term | `config/blocklist.json`, base form only |
| A license or a kind of material | `config/licenses.json`, as a dev PR with a row in `docs/decisions.md`; an `import` license also goes in `import-request.yml`'s dropdown |
| A ruleset | A licensing review, an attribution statement in `ATTRIBUTION.md`, and its `attribution` key |
| Art or another third-party asset | Its credit in `ATTRIBUTION.md` |
