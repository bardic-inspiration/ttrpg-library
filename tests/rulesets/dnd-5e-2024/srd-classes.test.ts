// The SRD classes in the library (docs/rulesets.md#classes): each derives its Features table and its
// spell list as SRD 5.2 prints them, from tests/fixtures/srd/class-tables.json, transcribed from the PDF.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { featuresTable } from '../../../site/src/lib/class.ts';
import { ruleset } from '../../../rulesets/dnd-5e-2024/index.ts';
import type { ClassStats, DerivedClass, LinkedClass } from '../../../rulesets/dnd-5e-2024/types.ts';
import { FIXTURES } from '../../helpers.ts';

const CONTENT = join(import.meta.dirname, '../../../content/dnd-5e-2024');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const dir = async (type: string) =>
  Promise.all((await readdir(join(CONTENT, type)).catch(() => [] as string[])).map((f) => readJson(join(CONTENT, type, f))));

const srd = (await readJson(join(FIXTURES, 'srd/class-tables.json'))) as {
  features: Record<string, string[][]>;
  spellLists: Record<string, string[]>;
  inconsistencies: Record<string, string[]>;
};
const entries = (await Promise.all(['class', 'class-feature', 'class-option', 'subclass', 'spell'].map(dir))).flat() as {
  type: string;
  id: string;
  name: string;
  stats: unknown;
  meta: { source: { srd?: true } };
}[];
const names = new Map(entries.map((e) => [`${e.type}/${e.id}`, e.name]));
const classes = entries.filter((e) => e.type === 'class' && e.meta.source.srd);
const derivedOf = (e: (typeof entries)[number]) =>
  ({ ...ruleset.derive('class', e.stats), ...ruleset.deriveLinked!('class', `class/${e.id}`, e.stats, entries) }) as unknown as DerivedClass & LinkedClass;
/** A rendered cell as plain text: each link token as its target's name, escapes dropped. */
const plain = (cell: string) => cell.replace(/\{ref:([^ }]+)\}/g, (_, key: string) => names.get(key) ?? key).replace(/\\(.)/g, '$1');

describe('SRD classes (docs/rulesets.md#classes)', () => {
  it('are all in the library', () => {
    expect(classes.map((e) => e.name).sort()).toEqual(Object.keys(srd.features).sort());
  });

  it.each(classes.map((e) => [e.name, e] as const))('%s derives its Features table as printed', (name, e) => {
    const rows = featuresTable(name, e.stats as ClassStats, derivedOf(e))
      .split('\n')
      .slice(4)
      .map((row) => row.slice(2, -2).split(' | ').slice(1).map(plain));
    expect(rows).toEqual(srd.features[name]);
  });

  it.each(classes.filter((e) => srd.spellLists[e.name]).map((e) => [e.name, e] as const))('%s derives its spell list as printed', (name, e) => {
    const derived = derivedOf(e).spellList.flatMap((level) => level.spells.map((s) => names.get(s.ref)!));
    // The SRD's own inconsistencies: a spell whose entry names the class, which its list omits.
    const extra = srd.inconsistencies[name] ?? [];
    expect(derived.filter((n) => !extra.includes(n)).sort()).toEqual(srd.spellLists[name]);
    for (const n of extra) expect(derived).toContain(n);
  });
});
