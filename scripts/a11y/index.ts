// Which pages `npm run a11y` checks (SPEC.md §9.7), read from the built
// library.json: the home page, a type gallery with a filter applied, and one
// detail page per type that has an entry. A type with no entries has no
// detail page to check yet. The print view joins once it exists (§10.4).

export interface IndexRecord {
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
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.ruleset}/${record.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push({ label: `${record.type} detail: ${record.name}`, path: record.url.replace(SITE_PATH, '') });
  }
  return pages;
}
