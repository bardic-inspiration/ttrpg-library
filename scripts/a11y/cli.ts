// `npm run a11y` (SPEC.md §9.7): runs axe-core through Playwright against the
// built site (site/dist) on the pages a11yPages picks, in the light and dark
// themes, and exits non-zero on any serious or critical violation. Run
// `npm run build` first.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { serveSite } from '../serve/index.ts';
import { a11yPages, type IndexRecord } from './index.ts';

const DIST = join(PROJECT_ROOT, 'site/dist');
const BLOCKING = new Set(['serious', 'critical']);

const index = await readFile(join(DIST, 'library.json'), 'utf8').catch(() => {
  console.error('site/dist/library.json not found; run `npm run build` first.');
  process.exit(1);
});
const records = JSON.parse(index) as IndexRecord[];
const pages = a11yPages(records);
const server = await serveSite(DIST);
const browser = await chromium.launch();
let failures = 0;

try {
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: theme });
    for (const page of pages) {
      const tab = await context.newPage();
      await tab.goto(server.url + page.path, { waitUntil: 'networkidle' });
      const { violations } = await new AxeBuilder({ page: tab }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ''));
      const other = violations.length - blocking.length;
      console.log(`${blocking.length ? '✗' : '✓'} ${page.label} (${theme})${other ? `, ${other} minor or moderate` : ''}`);
      for (const v of blocking) {
        failures++;
        console.log(`  ${v.impact}: ${v.id}: ${v.help} (${v.helpUrl})`);
        for (const node of v.nodes) console.log(`    ${node.target.join(' ')}`);
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
  console.error(`\n${failures} serious or critical accessibility violation(s).`);
  process.exit(1);
}
console.log(`\nNo serious or critical violations on ${pages.length} pages in either theme.`);
