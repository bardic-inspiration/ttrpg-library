// The import script (docs/generation.md#imports): runs a translator's import side on an import
// issue's file and turns what it returns into library entries. It checks the license against the
// source allowlist, resolves names against the library, skips what a custom entry can't be (an SRD
// name, a blocklisted term, a name or id the library already has), writes `summary`, `tags`, and
// `meta`, and returns the skip list and the work's ATTRIBUTION.md line. The `generate` skill runs it.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { accepts, type Licenses } from '../../lib/licenses.ts';
import { ruleNames } from '../../lib/rules.ts';
import { termMatcher } from '../../lib/text.ts';
import { open5e } from '../../site/src/translators/open5e/index.ts';
import type { ImportedEntry, Skip, Translator } from '../../site/src/translators/types.ts';
import type { Tags } from '../generate/defaults.ts';
import { loadLicenses, validateLibrary } from '../validate/index.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { checkBlocklist, loadBlocklist } from '../validate/text.ts';

/** The translators an import issue's format dropdown offers, by id. */
export const TRANSLATORS: Record<string, Translator> = { open5e };

/** What an import issue gives the script (docs/generation.md#requests). */
export interface ImportRequest {
  issue: number;
  /** A translator id. */
  format: string;
  /** The attached file, parsed. */
  file: unknown;
  /** The work's title, for ATTRIBUTION.md. */
  work: string;
  author: string;
  /** Where the work is published. */
  url: string;
  /** A license id in config/licenses.json. */
  license: string;
  ruleset: string;
  /** `meta.createdAt`, as YYYY-MM-DD. */
  date: string;
  /** Default tags (config/defaults.json), under the entries' own. */
  tags?: Tags;
}

/** A written entry: the envelope, ready to save at `content/<ruleset>/<type>/<id>.json`. */
export interface WrittenEntry extends ImportedEntry {
  summary: string;
  tags: Tags;
  meta: {
    createdAt: string;
    source: { kind: 'import'; issues: number[]; license: { id: string; author: string; url: string } };
  };
}

export type ImportOutcome =
  | { rejected: string }
  | { rejected?: undefined; entries: WrittenEntry[]; skipped: Skip[]; attribution: string };

/** What the import resolves against: the library's names, the SRD's names, and the allowlist. */
export interface ImportLibrary {
  /** Names of the ruleset's entries and rules, by `<type>/<id>`. */
  names: Map<string, string>;
  /** Every SRD name of the ruleset, any type, lowercased (rulesets/<ruleset>/srd-manifest.json). */
  srdNames: Set<string>;
  licenses: Licenses;
  blocklist: string[];
  /** config/types.json. */
  registry: Record<string, { types: Record<string, { label: string }> }>;
}

/** Reads what an import resolves against from the repo at `root` and the library under `content`. */
export async function loadImportLibrary(ruleset: string, root = PROJECT_ROOT, content = join(root, 'content')): Promise<ImportLibrary> {
  const readJson = async (path: string) => JSON.parse(await readFile(join(root, path), 'utf8'));
  const { entries, components, rules } = await validateLibrary(content);
  const names = new Map<string, string>(rules.filter((r) => r.ruleset === ruleset).flatMap((data) => [...ruleNames(data)]));
  for (const { entry } of [...entries, ...components]) {
    if (entry.ruleset === ruleset) names.set(`${entry.type}/${entry.id}`, entry.name);
  }
  const manifest = (await readJson(`rulesets/${ruleset}/srd-manifest.json`).catch(() => ({}))) as Record<string, { name: string }[] | undefined>;
  const srdNames = new Set(
    [...(manifest.entries ?? []), ...(manifest.components ?? []), ...(manifest.rules ?? [])].map((r) => r.name.toLowerCase()),
  );
  return {
    names,
    srdNames,
    licenses: await loadLicenses(root),
    blocklist: await loadBlocklist(root),
    registry: await readJson('config/types.json'),
  };
}

/** The work's line in ATTRIBUTION.md's "Imported works" section (docs/licensing.md#imported-works). */
export function attributionLine(request: Pick<ImportRequest, 'work' | 'author' | 'url' | 'license' | 'format'>, licenses: Licenses): string {
  const license = licenses.licenses[request.license]!;
  const format = TRANSLATORS[request.format]?.label ?? request.format;
  return `- **${request.work}** by ${request.author}, ${request.url}, licensed under [${license.name}](${license.url}). Adapted: converted from the ${format} format into this library's entries.`;
}

/** A plain one-line summary the run rewrites in the type's voice ([The generate skill](docs/generation.md#the-generate-skill)). */
function draftSummary(label: string, author: string): string {
  const summary = `An imported ${label.toLowerCase()} by ${author}.`;
  return summary.length <= 160 ? summary : `An imported ${label.toLowerCase()}.`;
}

/** Runs one import issue (docs/generation.md#imports). Rejects it, or returns its entries and skips. */
export function runImport(request: ImportRequest, library: ImportLibrary): ImportOutcome {
  const { licenses } = library;
  if (!(request.license in licenses.licenses) || !accepts(licenses, 'import', request.license)) {
    const accepted = licenses.kinds.import?.join(', ') ?? 'none';
    return { rejected: `The license "${request.license}" isn't one the library accepts for imports (config/licenses.json: ${accepted}). NC, ND, and SA works can't be relicensed under the library's CC-BY-4.0.` };
  }
  const translator = TRANSLATORS[request.format];
  if (!translator) return { rejected: `"${request.format}" isn't a format the library imports (${Object.keys(TRANSLATORS).join(', ')}).` };
  if (translator.ruleset !== request.ruleset) {
    return { rejected: `The ${translator.label} format maps the ${translator.ruleset} ruleset, not ${request.ruleset}.` };
  }

  const imported = translator.import(request.file, { ruleset: request.ruleset, names: library.names });
  const skipped = [...imported.skipped];
  const blocked = termMatcher(library.blocklist);
  const taken = new Set([...library.names.keys()]);
  const takenNames = new Set([...library.names].map(([key, name]) => `${key.slice(0, key.indexOf('/'))}/${name.toLowerCase()}`));
  const entries: WrittenEntry[] = [];
  for (const entry of imported.entries) {
    const skip = (reason: string) => skipped.push({ entry: entry.name, path: '', reason });
    const key = `${entry.type}/${entry.id}`;
    if (library.srdNames.has(entry.name.toLowerCase())) {
      skip('Its name is an SRD name; an imported entry is custom and can\'t reuse one.');
      continue;
    }
    if (taken.has(key) || takenNames.has(`${entry.type}/${entry.name.toLowerCase()}`)) {
      skip(`The library already has a ${entry.type} named ${entry.name}.`);
      continue;
    }
    const label = library.registry[request.ruleset]?.types[entry.type]?.label ?? entry.type;
    const written: WrittenEntry = {
      ruleset: entry.ruleset,
      type: entry.type,
      id: entry.id,
      name: entry.name,
      summary: draftSummary(label, request.author),
      ...(entry.description === undefined ? {} : { description: entry.description }),
      stats: entry.stats,
      tags: { ...request.tags, author: request.author },
      meta: {
        createdAt: request.date,
        source: { kind: 'import', issues: [request.issue], license: { id: request.license, author: request.author, url: request.url } },
      },
    };
    const terms = checkBlocklist(written, blocked);
    if (terms.length > 0) {
      skip(`It uses a blocklisted term: ${terms.join('; ')}.`);
      continue;
    }
    taken.add(key);
    takenNames.add(`${entry.type}/${entry.name.toLowerCase()}`);
    entries.push(written);
  }
  return { entries, skipped, attribution: attributionLine(request, licenses) };
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** One issue's section of the content PR's skip list (docs/generation.md#imports). */
export function skipListSection(issue: number, work: string, skipped: Skip[]): string {
  const head = `#### #${issue}: ${work}`;
  if (skipped.length === 0) return `${head}\n\nNothing skipped.\n`;
  const rows = skipped.map((s) => `| ${cell(s.entry)} | ${s.path === '' ? '(whole entry)' : `\`${cell(s.path)}\``} | ${cell(s.reason)} |`);
  return [head, '', '| Record | Field | Reason |', '|---|---|---|', ...rows, ''].join('\n');
}

const SECTION = '## Imported works';

/** ATTRIBUTION.md with `line` in its "Imported works" section, which comes last; unchanged if the line is there. */
export function addAttribution(text: string, line: string): string {
  if (text.split('\n').includes(line)) return text;
  const body = text.endsWith('\n') ? text : `${text}\n`;
  if (!body.includes(`\n${SECTION}\n`)) return `${body}\n${SECTION}\n\n${line}\n`;
  return `${body}${line}\n`;
}
