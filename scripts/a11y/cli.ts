// `npm run a11y` (docs/styling.md#accessibility): runs axe-core through Playwright against the
// built site (site/dist) on the pages a11yPages picks, in the light and dark
// themes, and exits non-zero on any serious or critical violation. Run
// `npm run build` first.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { launchChromium } from '../browser/index.ts';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { serveSite } from '../serve/index.ts';
import { a11yPages, type IndexRecord, type RulesPageRef } from './index.ts';

const DIST = join(PROJECT_ROOT, 'site/dist');
const BLOCKING = new Set(['serious', 'critical']);

const index = await readFile(join(DIST, 'library.json'), 'utf8').catch(() => {
  console.error('site/dist/library.json not found; run `npm run build` first.');
  process.exit(1);
});
const records = JSON.parse(index) as IndexRecord[];
// Each ruleset's rules pages, from rulesets/<ruleset>/rules/pages.json and ruleset.json.
const rulesPages: RulesPageRef[] = [];
const RULESETS = join(PROJECT_ROOT, 'rulesets');
for (const dir of (await readdir(RULESETS, { withFileTypes: true })).filter((d) => d.isDirectory())) {
  const listed = await readFile(join(RULESETS, dir.name, 'rules/pages.json'), 'utf8').catch(() => undefined);
  if (listed === undefined) continue;
  const definition = JSON.parse(await readFile(join(RULESETS, dir.name, 'ruleset.json'), 'utf8')) as { id: string; rules?: { extensions: boolean }[] };
  const extensions = (definition.rules ?? []).some((r) => r.extensions);
  for (const page of JSON.parse(listed) as { id: string; title: string }[]) rulesPages.push({ ruleset: definition.id, id: page.id, title: page.title, extensions });
}
const pages = a11yPages(records, rulesPages);
const server = await serveSite(DIST);
const browser = await launchChromium();
let failures = 0;

try {
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: theme });
    // The print view opens the print dialog on load; there is no one to close it.
    await context.addInitScript(() => {
      window.print = () => {};
    });
    for (const page of pages) {
      const tab = await context.newPage();
      await tab.goto(server.url + page.path, { waitUntil: 'networkidle' });
      if (page.ready) await tab.waitForSelector(page.ready);
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
