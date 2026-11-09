// Which pages `npm run a11y` checks (docs/styling.md#accessibility), read from the built
// library.json: the home page, a type gallery with a filter applied, one
// detail page per type that has an entry, and the print view (docs/export.md#print) showing
// those same entries. A type with no entries has no detail page to check yet. Then every rules
// page (docs/site.md#rules-pages), and the Extensions page of a ruleset that has one.

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

const SITE_PATH = /^\/[^/]+\//; // the site base, which `url` in library.json starts with

/** A gallery filter that matches `record`, from its first facet value, in docs/site.md#gallery URL form. */
function filterFor(record: IndexRecord): string | undefined {
  for (const [path, value] of Object.entries(record.facets)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'number') return `f.${path}=${first}..${first}`;
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
  const pages: A11yPage[] = [{ label: 'home', path: '' }];
  const first = records[0];
  if (first) {
    const filter = filterFor(first);
    pages.push({
      label: `${first.type} gallery, filtered`,
      path: `${first.ruleset}/${first.type}/${filter ? `?${filter}` : ''}`,
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
  const rulesets = [...new Set(rulesPages.map((p) => p.ruleset))];
  for (const ruleset of rulesets) {
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

/** A record's detail page path under the site base. */
export function detailPath(record: IndexRecord): string {
  return record.url.replace(SITE_PATH, '');
}
