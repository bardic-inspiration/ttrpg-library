// The library the site is built from (docs/site.md#library-root): a folder holding `content/`,
// `rulesets/`, and `config/types.json`. The repo itself by default; `LIBRARY_ROOT` names another,
// such as the fixture rulesets (docs/rulesets.md#fixture-rulesets). The site reads it through the
// `@library` alias, and each library gets its own public and dist folders, so the fixture build
// never overwrites the library's.

import { basename, join, resolve } from 'node:path';

/** The repository root. */
export const REPO_ROOT = resolve(import.meta.dirname, '..');

/** The import alias site code reads the library through: `@library/content/…`, `@library/config/types.json`. */
export const LIBRARY_ALIAS = '@library';

/** The library root: `LIBRARY_ROOT`, relative to the repo root, or the repo root when unset or empty. */
export const libraryRoot = (env: Record<string, string | undefined> = process.env): string => resolve(REPO_ROOT, env.LIBRARY_ROOT || '.');

/**
 * Where a library's site is staged and built: `site/public` and `site/dist` for the repo's own
 * library, and `site/public-<name>` and `site/dist-<name>` for any other, by its folder's name.
 */
export function siteDirs(root: string): { publicDir: string; outDir: string } {
  const suffix = root === REPO_ROOT ? '' : `-${basename(root)}`;
  return { publicDir: join(REPO_ROOT, 'site', `public${suffix}`), outDir: join(REPO_ROOT, 'site', `dist${suffix}`) };
}
