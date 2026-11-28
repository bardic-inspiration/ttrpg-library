# TTRPG Content Library

A free, browsable library of D&D 5e content built on the SRD 5.2: its rules,
classes and subclasses, species, backgrounds, feats, spells, creatures, and
magic items, with original entries alongside. It's made for DMs who look
things up and prep sessions, on a phone at the table or a laptop at a desk.

**Browse it:** https://bardic-inspiration.github.io/ttrpg-library/

## What you can do

- **Look things up.** Browse, filter, and search entries.
- **Take entries with you.** Print any entry or rules page, and download most
  entries as JSON or PNG. Creatures, spells, magic items, and custom
  conditions and equipment also download for Open5e. Classes, subclasses, and species only print.
- **Know what's what.** SRD 5.2 entries are reproduced as published, and
  original entries are kept separate.

The site is static: no accounts, no servers.

## Where it's going

What each release added is in [`CHANGELOG.md`](CHANGELOG.md). The highlights so
far:

- **The full SRD 5.2 rules base**, as linked data that your own content can
  build on.
- **A redesigned interface** for fast lookup and one-button export.
- **Import and export with Open5e.**

Built on `main` for the next release, v1.2.0: characters, maps, encounters,
and modules, and a revised interface.

Three development tracks carry on ([`spec/tracks/`](spec/tracks/README.md)):

- **Integrations:** import and export for more open TTRPG formats, for VTTs
  and other sites.
- **Images:** public domain and openly licensed art on entries.
- **Rulesets:** a second published ruleset, and a redesigned Rulesets page.

## Contributing

Request new content or a revision by opening an issue. Every change is a pull
request that a person reviews and merges. To work on the code, install Node 22
LTS, run `npm ci` and `npm run dev`, and read [`AGENTS.md`](AGENTS.md) first.

## License

Code is MIT; content is CC-BY-4.0; the library includes SRD 5.2 material
under CC-BY-4.0 ([`docs/licensing.md`](docs/licensing.md)).
