// The wording layer (docs/site.md#wording): every type composes text through lib/wording/ and the
// phrase book. A composer that defines its own casing, list, plural, or article helper, or holds a
// fixed sentence, fails here, so a phrasing rule is defined once.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SITE = join(ROOT, 'site/src');

/**
 * Site code that composes text from data: the site's modules and the template and rules
 * components, but not the wording layer's own entry point. Pages and the page shell hold static
 * copy (the About page, the attribution statement), which is written, not composed.
 */
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : /\.(ts|tsx|astro)$/.test(d.name) ? [join(dir, d.name)] : [],
  );
const composers = ['lib', 'components/templates', 'components/rules']
  .flatMap((dir) => files(join(SITE, dir)))
  .filter((f) => relative(SITE, f) !== 'lib/wording.ts');

/** Source without comments, so prose in doc comments isn't mistaken for a sentence. */
const code = (file: string): string => stripComments(readFileSync(file, 'utf8'));
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** String and template literals, without error messages, which aren't text a reader sees. */
const literals = (source: string): string[] =>
  [...source.replace(/throw new Error\([^;]*\);/g, '').matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? '');

const HELPERS: { name: string; pattern: RegExp }[] = [
  { name: 'a capitalize helper', pattern: /charAt\(0\)\.toUpperCase\(\)/ },
  { name: 'a list joined with "and" or "or"', pattern: /\.join\(\s*['`] (and|or) ['`]\s*\)/ },
  { name: 'a local casing, list, plural, or article helper', pattern: /\b(const|function)\s+(capitalize|titleCase|englishList|plural|pluralize|article|MINOR_WORDS)\b/ },
];

/** Four lowercase words in a row in a literal: prose that belongs in the phrase book. */
const SENTENCE = /\b[a-z]+ [a-z]+ [a-z]+ [a-z]+\b/;

describe('the wording layer (docs/site.md#wording)', () => {
  it('catches a local helper and a fixed sentence', () => {
    const source = stripComments(`const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);\nconst x = items.join(' or ');\nconst y = \`The \${n} casts one of the following spells\`;`);
    expect(HELPERS.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name)).toEqual([
      'a capitalize helper',
      'a list joined with "and" or "or"',
      'a local casing, list, plural, or article helper',
    ]);
    expect(literals(source).filter((l) => SENTENCE.test(l))).toHaveLength(1);
    expect(literals(stripComments('// a comment with four lower words\nconst ok = "x";'))).toEqual([]);
  });

  it.each(composers.map((f) => [relative(ROOT, f), f]))('%s defines no grammar helper of its own', (_, file) => {
    const source = code(file);
    expect(HELPERS.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name)).toEqual([]);
  });

  it.each(composers.map((f) => [relative(ROOT, f), f]))('%s holds no fixed sentence', (_, file) => {
    expect(literals(code(file)).filter((l) => SENTENCE.test(l))).toEqual([]);
  });
});
