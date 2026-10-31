/**
 * Builds an internal link under Astro's `base` (SPEC.md §3.1). Every internal
 * link goes through this, so the site works at /ttrpg-library/.
 */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return base + path.replace(/^\//, '');
}
