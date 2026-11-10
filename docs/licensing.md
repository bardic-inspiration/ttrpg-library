# Licensing

## Purpose

What the library may contain and how it credits its sources: the licenses for
code and content, the SRD attribution, the blocklist that keeps non-SRD
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
- `config/blocklist.json`; the matcher is `termMatcher` in `lib/text.ts`.
- `site/src/components/Footer.astro`, `site/src/pages/about.astro`.

## Extending

| To add | Touch |
|---|---|
| A blocked term | `config/blocklist.json`, base form only |
| A ruleset | A licensing review, an attribution statement in `ATTRIBUTION.md`, and its `attribution` key |
| Art or another third-party asset | Its credit in `ATTRIBUTION.md` |
