// Launches Chromium for `npm run a11y` and `npm run snapshots` (docs/styling.md#accessibility,
// docs/styling.md#refinement-workflow). Cloud sessions ship a preinstalled Chromium whose build can differ
// from the one the installed Playwright expects, so a failed launch is retried
// with that browser when it exists.

import { existsSync } from 'node:fs';
import { chromium, type Browser, type LaunchOptions } from 'playwright';

export const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';

/**
 * Launches with Playwright's own browser, and on failure with `fallback` if it
 * exists. The first error is rethrown when there is no fallback to try.
 */
export async function launchWithFallback<T>(
  launch: (options: LaunchOptions) => Promise<T>,
  fallback: string,
  exists: (path: string) => boolean,
): Promise<T> {
  try {
    return await launch({});
  } catch (error) {
    if (!exists(fallback)) throw error;
    console.warn(`Playwright's bundled Chromium failed to launch; using ${fallback}.`);
    return launch({ executablePath: fallback });
  }
}

export const launchChromium = (): Promise<Browser> =>
  launchWithFallback((options) => chromium.launch(options), PREINSTALLED_CHROMIUM, existsSync);
