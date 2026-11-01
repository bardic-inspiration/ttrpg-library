// `npm run snapshots [label]` (SPEC.md §9.8): serves the built site
// (site/dist) under the site base and captures full-page screenshots of the
// pages snapshotPages picks, in the light and dark themes, into the
// git-ignored snapshots/<label>/ folder. Not a CI gate. Run `npm run build`
// first.

import { mkdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import type { IndexRecord } from '../a11y/index.ts';
import { serveSite } from '../serve/index.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { defaultLabel, isValidLabel, snapshotPages } from './index.ts';

const DIST = join(PROJECT_ROOT, 'site/dist');

const label = process.argv[2] ?? defaultLabel();
if (!isValidLabel(label)) {
  console.error(`Invalid label "${label}": use letters, digits, ".", "_", or "-", starting with a letter or digit.`);
  process.exit(1);
}

const index = await readFile(join(DIST, 'library.json'), 'utf8').catch(() => {
  console.error('site/dist/library.json not found; run `npm run build` first.');
  process.exit(1);
});
const pages = snapshotPages(JSON.parse(index) as IndexRecord[]);
const out = join(PROJECT_ROOT, 'snapshots', label);
await mkdir(out, { recursive: true });

const server = await serveSite(DIST);
const browser = await chromium.launch();
let failures = 0;

try {
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 800 } });
    for (const page of pages) {
      const tab = await context.newPage();
      const response = await tab.goto(server.url + page.path, { waitUntil: 'networkidle' });
      const file = join(out, `${page.file}-${theme}.png`);
      if (!response?.ok()) {
        failures++;
        console.log(`✗ ${page.path || '/'} (${theme}): HTTP ${response?.status() ?? 'no response'}`);
      } else {
        await tab.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${relative(PROJECT_ROOT, file)}`);
      }
      await tab.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures) {
  console.error(`\n${failures} page(s) could not be captured.`);
  process.exit(1);
}
console.log(`\n${pages.length * 2} snapshots in ${relative(PROJECT_ROOT, out)}/.`);
