// Which pages `npm run a11y` checks (docs/styling.md#accessibility): each ruleset's Library and the
// About page, then, read from the built library.json, a Library filtered to a type and
// a facet, one detail page per type that has an entry, and the print view (docs/export.md#print)
// showing those same entries. A type with no entries has no detail page to check yet. Then every rules
// page (docs/site.md#rules-pages), and the Extensions page of a ruleset that has one.

import { SITE_BASE } from '../../lib/site.ts';

export interface IndexRecord {
  id: string;
  type: string;
  ruleset: string;
  name: string;
  url: string;
  facets: Record<string, unknown>;
}

export interface A11yPage {
  label: string;
  /** Path under the site base, with any query string. */
  path: string;
  /** A selector to wait for before checking, for content the page loads itself. */
  ready?: string;
}

/** A gallery filter that matches `record`, from its first facet value, in docs/site.md#gallery URL form. */
function filterFor(record: IndexRecord): string | undefined {
  for (const [path, value] of Object.entries(record.facets)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'number') return `f.${path}=${first}..${first}`;
    const span = first as { min?: unknown; max?: unknown } | null;
    if (typeof span?.min === 'number' && typeof span.max === 'number') return `f.${path}=${span.min}..${span.max}`;
    if (typeof first === 'string') return `f.${path}=${encodeURIComponent(first)}`;
  }
  return undefined;
}

/** A rules page from a ruleset's rules/pages.json, and whether the ruleset has an Extensions page. */
export interface RulesPageRef {
  ruleset: string;
  id: string;
  title: string;
  extensions: boolean;
}

export function a11yPages(records: IndexRecord[], rulesPages: RulesPageRef[] = []): A11yPage[] {
  // Each ruleset's Library, from the rulesets the entries and rules pages name; the home URL when none does.
  const rulesets = [...new Set([...records.map((r) => r.ruleset), ...rulesPages.map((p) => p.ruleset)])];
  const pages: A11yPage[] = [
    ...(rulesets.length === 0 ? [{ label: 'Library', path: '' }] : rulesets.map((ruleset) => ({ label: `Library: ${ruleset}`, path: `${ruleset}/` }))),
    { label: 'About', path: 'about/' },
  ];
  const first = records[0];
  if (first) {
    const filter = filterFor(first);
    pages.push({
      label: `Library, filtered to ${first.type}`,
      path: `${first.ruleset}/?f.type=${encodeURIComponent(first.type)}${filter ? `&${filter}` : ''}`,
    });
  }
  const firsts = firstOfEachType(records);
  for (const record of firsts) {
    pages.push({ label: `${record.type} detail: ${record.name}`, path: detailPath(record) });
  }
  if (firsts.length > 0) {
    pages.push({
      label: `print view: ${firsts.map((r) => r.name).join(', ')}`,
      path: `print/?ids=${firsts.map((r) => `${r.type}/${encodeURIComponent(r.id)}`).join(',')}`,
      ready: '.print-entry',
    });
  }
  for (const ruleset of new Set(rulesPages.map((p) => p.ruleset))) {
    const own = rulesPages.filter((p) => p.ruleset === ruleset);
    for (const page of own) pages.push({ label: `rules page: ${page.title}`, path: `${ruleset}/rules/${page.id}/` });
    if (own.some((p) => p.extensions)) pages.push({ label: 'rules page: Extensions', path: `${ruleset}/rules/extensions/` });
  }
  return pages;
}

/** The first record of each ruleset and type, in index order. */
export function firstOfEachType(records: IndexRecord[]): IndexRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.ruleset}/${record.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A record's detail page path under `base`, the site base its `url` starts with: this build's by
 * default, so a preview build is checked with SITE_BASE set as it was built.
 */
export function detailPath(record: IndexRecord, base: string = SITE_BASE): string {
  if (!record.url.startsWith(base)) throw new Error(`${record.url} is not under the site base ${base}; set SITE_BASE as the site was built`);
  return record.url.slice(base.length);
}
