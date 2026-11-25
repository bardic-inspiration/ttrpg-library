// Where the site is served (docs/architecture.md#technology, docs/workflow.md#deploy). Astro's
// `base` and the URLs the index builder writes into library.json both come from here.

/** The production site's base: the GitHub Pages project path, with leading and trailing slashes. */
export const PRODUCTION_BASE = '/ttrpg-library/';

/** The preview's base, where the build of `main` is served beside production. */
export const PREVIEW_BASE = `${PRODUCTION_BASE}next/`;

/**
 * The site base a build uses: `SITE_BASE` when set and not empty, or the production base. It must
 * start and end with a slash.
 */
export function siteBase(env: Record<string, string | undefined> = process.env): string {
  const base = env.SITE_BASE || PRODUCTION_BASE;
  if (!base.startsWith('/') || !base.endsWith('/')) throw new Error(`SITE_BASE must start and end with "/": ${JSON.stringify(base)}`);
  return base;
}

/**
 * This build's site base. Read as `process.env.SITE_BASE` so that the site's Vite config can
 * define it for code bundled for the browser, where `process` doesn't exist.
 */
export const SITE_BASE = siteBase({ SITE_BASE: process.env.SITE_BASE });

/** Whether a build at `base` is a preview: any base but production's. */
export const isPreview = (base: string = SITE_BASE): boolean => base !== PRODUCTION_BASE;

/**
 * The production path for a page at `pathname` in a build at `base`: the same path under the
 * production base. A path outside `base` maps to production's Library.
 */
export function productionPath(pathname: string, base: string = SITE_BASE): string {
  return pathname.startsWith(base) ? PRODUCTION_BASE + pathname.slice(base.length) : PRODUCTION_BASE;
}

/** The repository, for links to source issues (docs/content-model.md#meta, docs/site.md#detail-page). */
export const REPO_URL = 'https://github.com/bardic-inspiration/ttrpg-library';
