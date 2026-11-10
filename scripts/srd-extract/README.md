# srd-extract

Text extraction from `docs/SRD_CC_v5.2.pdf` for SRD import sessions
([the `srd-import` skill](../../.claude/skills/srd-import/SKILL.md), step 4). It
holds the rules every stage needs: reading order by baseline and column,
styles from fonts, paragraphs, rejoined line-end hyphens, dropped soft
hyphens, and linking mentions of rules. A stage's converter, which turns these
paragraphs into one type's entries, is written in the session's scratch space
and imports this module.

Needs Python 3.10+, `pdfplumber` (`pip install pdfplumber`), and poppler's
`pdftotext` and `pdftoppm`. None of it runs in CI; a test only checks that the
module compiles.

```sh
python3 scripts/srd-extract/srd_extract.py headings 28 83          # every heading, with page and size
python3 scripts/srd-extract/srd_extract.py paragraphs 87 88        # headings and styled paragraphs
python3 scripts/srd-extract/srd_extract.py paragraphs 28 83 --no-tables   # without table cells
python3 scripts/srd-extract/srd_extract.py link "has the Poisoned condition"
pdftoppm -r 100 -f 46 -l 46 -png docs/SRD_CC_v5.2.pdf page         # a page image, to read a table
```

From a converter:

```python
import sys
sys.path.insert(0, 'scripts/srd-extract')
from srd_extract import clean, headings, link, paragraphs

for heading, paras in paragraphs(87, 88):
    ...
```

What it can't do, so a session does by hand and checks against the page image:

- **Tables.** The text layer scrambles cells. Drop them with `--no-tables`
  and transcribe each table from the page image.
- **Run-in options** printed bold (`**Forest Gnome.**`) are written as
  `***Forest Gnome.***`, as the guidelines say; the converter does that.
- **Links to library entries** (spells, creatures, feats, classes) are the
  converter's: an italic spell name becomes `*{ref:spell/<id>}*` when the
  spell is in the library. `link` covers only conditions, equipment, and
  glossary terms, and a session reviews each link in its sentence.
