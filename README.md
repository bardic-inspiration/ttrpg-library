# TTRPG Content Library

A free, browsable library of original D&D 5e content built on the SRD 5.2:
creatures, magic items, and spells. It's made for DMs who look things up and
prep sessions, on a phone at the table or a laptop at a desk.

**Browse it:** https://bardic-inspiration.github.io/ttrpg-library/

## What you can do

- **Look things up.** Browse, filter, and search entries.
- **Take entries with you.** Export any entry as JSON, PNG, or a print-ready
  page.
- **Know what's what.** SRD 5.2 entries are reproduced as published, and
  original entries are kept separate.

The site is static: no accounts, no servers.

## Where it's going

v1 is complete. v2 is designed in [`spec/v2/`](spec/v2/README.md):

- **The full SRD 5.2 rules base**, as linked data that your own content can
  build on.
- **A redesigned interface** for fast lookup and one-button export, styled
  after early twentieth-century architectural prints.
- **Import and export for open TTRPG formats**, for VTTs and other sites.
- **Public domain and openly licensed art** on entries.

## Contributing

Request new content or a revision by opening an issue. Every change is a pull
request that a person reviews and merges. To work on the code, install Node 22
LTS, run `npm ci` and `npm run dev`, and read [`AGENTS.md`](AGENTS.md) first.

## License

Code is MIT; content is CC-BY-4.0; the library includes SRD 5.2 material
under CC-BY-4.0 ([`docs/licensing.md`](docs/licensing.md)).
