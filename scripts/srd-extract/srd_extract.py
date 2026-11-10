#!/usr/bin/env python3
"""Text extraction from the SRD PDF for SRD import sessions (.claude/skills/srd-import/SKILL.md, step 4).

Reads docs/SRD_CC_v5.2.pdf with pdfplumber and gives what a session transcribes from:

  styled      a page range as lines, column by column, ordered by baseline, with *italic*,
              **bold**, and ***bold italic*** from the fonts, "# " before a heading, and a
              paragraph mark (¶) where a line starts with the PDF's first-line indent
  paragraphs  the same range as headings, each with its paragraphs: lines joined, words broken
              across lines rejoined, bullets and run-in heads starting their own paragraph
  headings    every heading of a page range, with its page and size, to map a chapter's
              entries and their features
  link        a text with its mentions of conditions, equipment, and glossary terms made
              {ref:…} tokens, by docs/content-model.md#references "Mentions of rules"

`--no-tables` drops the table cells (set in GillSans), whose text the text layer scrambles:
read each table from the page image (`pdftoppm -r 100 -f <p> -l <p> -png`) and write it by hand.
Every result is checked against the PDF before it becomes an entry (the skill's step 6).

Import it from a session's converter (`sys.path.insert(0, 'scripts/srd-extract')`) for
`paragraphs()`, `clean()`, `headings()`, and `link()`. Needs Python 3.10+, pdfplumber, and
poppler's pdftotext; none of it runs in CI.
"""

from __future__ import annotations

import argparse
import functools
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / 'docs/SRD_CC_v5.2.pdf'
RULES = ROOT / 'rulesets/dnd-5e-2024/rules'

# The page's two columns split at its midline; the running header and footer sit outside these baselines.
MIDLINE = 297
BODY = (40, 780)
MARKS = {'BI': '***', 'B': '**', 'I': '*'}


@functools.cache
def _pdf():
    import pdfplumber

    return pdfplumber.open(PDF)


def _style(char: dict) -> str:
    """H for a heading, G for a table cell, or the run's emphasis: BI, B, I, or ''."""
    font = char['fontname']
    if 'GillSans-SemiBold' in font and char['size'] >= 11.5:
        return 'H'
    if 'GillSans' in font:
        return 'G'
    bold, italic = 'Bold' in font, 'Italic' in font
    return 'BI' if bold and italic else 'B' if bold else 'I' if italic else ''


def styled(first: int, last: int, tables: bool = True) -> str:
    """Pages `first`–`last` (1-based) as styled lines, left column before right, by baseline."""
    lines: list[str] = []
    for index in range(first - 1, last):
        rows: dict[tuple[int, int], list[dict]] = {}
        for char in _pdf().pages[index].chars:
            # Order by the text matrix's baseline, not `top`, which is off for bold and italic fonts.
            baseline = char['matrix'][5]
            if not BODY[0] <= baseline <= BODY[1]:
                continue
            if not tables and 'GillSans' in char['fontname'] and char['size'] < 11:
                continue
            column = 0 if char['x0'] < MIDLINE else 1
            rows.setdefault((column, round(baseline)), []).append(char)
        lines.append(f'=== page {index + 1}')
        previous = None
        for key in sorted(rows, key=lambda k: (k[0], -k[1])):
            chars = sorted(rows[key], key=lambda c: c['x0'])
            # A soft hyphen comes through as a space at the same x as the next letter: drop it.
            chars = [c for i, c in enumerate(chars) if not (c['text'] == ' ' and i + 1 < len(chars) and chars[i + 1]['x0'] - c['x0'] < 0.5)]
            if not chars:
                continue
            out, current, right = '', '', None
            for char in chars:
                if right is not None and char['x0'] - right > 1.2 and not out.endswith(' '):
                    out += ' '
                # Whitespace is style-neutral, so a run's markers sit outside its spaces.
                style = _style(char) if char['text'].strip() else current
                style = '' if style in ('G', 'H') else style
                if style != current:
                    trimmed = out.rstrip(' ')
                    out = trimmed + MARKS.get(current, '') + out[len(trimmed):] + MARKS.get(style, '')
                    current = style
                out += char['text']
                right = char['x1']
            out = out.rstrip(' ') + MARKS.get(current, '')
            gap = previous is not None and previous[0] == key[0] and previous[1] - key[1] > 14
            if any(_style(c) == 'H' for c in chars):
                lines.append('# ' + out.replace('*', ''))
            else:
                lines.append(('\n' if gap else '') + ('¶' if chars[0]['text'] == ' ' else '') + out)
            previous = key
    return '\n'.join(lines)


@functools.cache
def _whole_hyphenated() -> frozenset[str]:
    """Hyphenated words the SRD prints whole on one line, which keep their hyphen when broken at it."""
    text = subprocess.run(['pdftotext', str(PDF), '-'], capture_output=True, text=True, check=True).stdout
    words = set()
    for line in text.split('\n'):
        body = line[:-1] if line.endswith('-') else line
        words.update(w.lower() for w in re.findall(r'\b([A-Za-z]+-[A-Za-z]+)\b', body))
    return frozenset(words)


def paragraphs(first: int, last: int, tables: bool = True) -> list[tuple[str | None, list[str]]]:
    """Pages `first`–`last` as (heading, paragraphs) pairs, in reading order."""
    blocks: list[tuple[str | None, list[str]]] = []
    heading: str | None = None
    paras: list[str] = []
    buffer = ''

    def flush() -> None:
        nonlocal buffer
        if buffer.strip():
            paras.append(buffer.strip())
        buffer = ''

    for raw in styled(first, last, tables).split('\n'):
        if raw.startswith('=== page'):
            continue
        if raw.startswith('# '):
            flush()
            if heading is not None or paras:
                blocks.append((heading, paras))
            heading, paras = raw[2:].strip(), []
            continue
        line = raw.strip()
        if line.startswith('¶'):
            flush()
            line = line[1:].strip()
        if not line:
            flush()
            continue
        # A paragraph starts at a run-in head (bold italic, or a bold "Name." item) or a bullet.
        if line.startswith('***') or re.match(r'^\*\*[^*]+\.\*\*', line) or line.startswith('•'):
            flush()
        broken = re.search(r'([A-Za-z]+)-(\**)$', buffer)
        start = re.match(r'(\**)([A-Za-z]+)', line)
        if broken and start:
            # A word broken across lines: keep the hyphen only where the SRD prints the word whole.
            if f'{broken.group(1)}-{start.group(2)}'.lower() in _whole_hyphenated():
                buffer += line
            elif broken.group(2) == start.group(1):
                buffer = buffer[: broken.start()] + broken.group(1) + line[len(start.group(1)) :]
            else:
                buffer = buffer[:-1] + line
        elif buffer.endswith(('-', '—')):
            buffer += line
        else:
            buffer = f'{buffer} {line}' if buffer else line
    flush()
    blocks.append((heading, paras))
    return blocks


def clean(text: str) -> str:
    """Merges adjacent runs of one style and collapses spaces."""
    text = re.sub(r'\*\*\*\s*\*\*\*', ' ', text)
    text = re.sub(r'(?<!\*)\*\s\*(?!\*)', ' ', text)
    return re.sub(r'  +', ' ', text)


def headings(first: int, last: int) -> list[tuple[int, float, str]]:
    """Every heading on pages `first`–`last`, as (page, size, text); 18 names a class or chapter part, 12 a feature."""
    found = []
    for index in range(first - 1, last):
        rows: dict[tuple[int, int], list[dict]] = {}
        for char in _pdf().pages[index].chars:
            if 'SemiBold' in char['fontname'] and char['size'] >= 11.5:
                rows.setdefault((0 if char['x0'] < MIDLINE else 1, round(char['matrix'][5])), []).append(char)
        for key in sorted(rows, key=lambda k: (k[0], -k[1])):
            chars = sorted(rows[key], key=lambda c: c['x0'])
            text, right = '', None
            for char in chars:
                if right is not None and char['x0'] - right > 1.5:
                    text += ' '
                text += char['text']
                right = char['x1']
            found.append((index + 1, round(chars[0]['size'], 1), text.strip()))
    return found


# Glossary names that are ordinary words in most sentences; a review links them by hand where they mean the term.
ORDINARY = {
    'Action', 'Adventure', 'Ally', 'Attitude', 'Bloodied', 'Burning', 'Campaign', 'Cantrip', 'Climbing', 'Condition', 'Cone',
    'Crawling', 'Creature', 'Cube', 'Curses', 'Cylinder', 'Damage', 'Dead', 'Emanation', 'Encounter', 'Enemy', 'Expertise',
    'Falling', 'Flying', 'Friendly', 'Grappling', 'Hazard', 'Healing', 'Hostile', 'Hover', 'Illusions', 'Indifferent',
    'Jumping', 'Line', 'Magical Effect', 'Monster', 'Object', 'Possession', 'Proficiency', 'Reach', 'Ritual', 'Save',
    'Size', 'Skill', 'Speed', 'Spell', 'Sphere', 'Stable', 'Swimming', 'Target', 'Telepathy', 'Teleportation', 'Weapon',
}
# Action names, linked only as "<Name> action".
ACTIONS = {'Attack', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Influence', 'Magic', 'Ready', 'Search', 'Study', 'Utilize'}


@functools.cache
def _rules_names() -> list[tuple[str, str, str]]:
    names = []
    for kind in ('condition', 'glossary', 'equipment'):
        for path in (RULES / kind).glob('*.json'):
            entry = json.loads(path.read_text())
            names.append((entry['name'], kind, entry['id']))
    for group in json.loads((RULES / 'equipment-groups.json').read_text()):
        names.append((group['name'], 'equipment', group['id']))
    names = [n for n in names if n[0] not in ORDINARY]
    return sorted(names, key=lambda n: -len(n[0]))


def link(text: str, item: bool = False) -> tuple[str, list[str]]:
    """
    `text` with each mention of a condition, equipment, or glossary term as a token, and the names
    linked: conditions and equipment at every mention, a glossary term at its first. A name that
    starts a sentence or table cell, or sits inside a longer capitalized name ("Patient Defense",
    "Boon of Truesight"), stays plain. `item` is a starting-equipment item, whose first word may link.
    """
    spans = [(m.start(), m.end()) for m in re.finditer(r'\{ref:[^}]*\}|\*\*\*[^*]+\*\*\*', text)]
    replacements: list[tuple[int, int, str]] = []
    linked: list[str] = []
    glossary_used: set[str] = set()
    for name, kind, ident in _rules_names():
        pattern = r"(?<![A-Za-z’'-])" + re.sub(r"['’]", "['’]", re.escape(name)) + r"(?![A-Za-z’'-])"
        for m in re.finditer(pattern, text):
            a, b = m.span()
            if any(x < b and a < y for x, y in spans) or any(x < b and a < y for x, y, _ in replacements):
                continue
            before, after = text[:a], text[b:]
            lead = before.rstrip('*') if before.endswith('*') and not before.endswith('***') else before
            if not (item and before == '') and re.search(r'(^|[.!?:]\s+|\|\s*|\n\s*[-•]?\s*|\*\*\*\s)$', lead):
                continue
            if re.search(r"[A-Z][a-z’']+ (of |of the )?$", before) and not re.search(r'(^|[.!?]\s+)[A-Z][a-z]+ $', before):
                continue
            if re.match(r' (?:of )?[A-Z][a-z]', after):
                continue
            if name in ACTIONS and not re.match(r' actions?\b', after):
                continue
            if kind == 'glossary':
                if ident in glossary_used:
                    continue
                glossary_used.add(ident)
            replacements.append((a, b, f'{{ref:{kind}/{ident}}}'))
            linked.append(name)
    for a, b, token in sorted(replacements, reverse=True):
        text = text[:a] + token + text[b:]
    return text, linked


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('styled', 'paragraphs', 'headings'):
        command = commands.add_parser(name)
        command.add_argument('first', type=int, help='first page, 1-based')
        command.add_argument('last', type=int, help='last page')
        if name != 'headings':
            command.add_argument('--no-tables', action='store_true', help='drop table cells (GillSans)')
    command = commands.add_parser('link')
    command.add_argument('text')
    command.add_argument('--item', action='store_true', help='a starting-equipment item')
    args = parser.parse_args()

    if args.command == 'styled':
        print(styled(args.first, args.last, not args.no_tables))
    elif args.command == 'paragraphs':
        for heading, paras in paragraphs(args.first, args.last, not args.no_tables):
            print(f'# {heading}')
            for para in paras:
                print(f'  | {clean(para)}')
    elif args.command == 'headings':
        for page, size, text in headings(args.first, args.last):
            print(page, size, text, sep='\t')
    else:
        text, linked = link(args.text, args.item)
        print(text)
        print('linked:', ', '.join(linked) or 'nothing', file=sys.stderr)


if __name__ == '__main__':
    main()
