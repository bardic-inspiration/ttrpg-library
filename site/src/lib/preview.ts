// The preview notice's link (docs/workflow.md#deploy "The preview").

import { fetchFresh } from './fetch-fresh.ts';

/**
 * Asks production for the page the preview notice links to and, when production doesn't have it,
 * points the link at its `data-fallback-href` with its `data-fallback-text`. When the request
 * fails to complete, the link stays as it is.
 */
export async function checkPreviewLink(link: HTMLAnchorElement, get: typeof fetchFresh = fetchFresh): Promise<void> {
  const response = await get(link.href).catch(() => undefined);
  if (!response || response.ok) return;
  link.href = link.dataset.fallbackHref!;
  link.textContent = link.dataset.fallbackText!;
}
