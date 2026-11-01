// Which pages `npm run a11y` checks (SPEC.md §9.7), read from the built
// library.json: the home page, a type gallery with a filter applied, one
// detail page per type that has an entry, and the print view (§10.4) showing
// those same entries. A type with no entries has no detail page to check yet.

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

/** A gallery filter that matches `record`, from its first facet value, in §9.3 URL form. */
function filterFor(record: IndexRecord): string | undefined {
  for (const [path, value] of Object.entries(record.facets)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'number') return `f.${path}=${first}..${first}`;
    if (typeof first === 'string') return `f.${path}=${encodeURIComponent(first)}`;
  }
  return undefined;
}

export function a11yPages(records: IndexRecord[]): A11yPage[] {
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
      path: `print/?ids=${firsts.map((r) => encodeURIComponent(r.id)).join(',')}`,
      ready: '.print-entry',
    });
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
