// `npm run srd-coverage` (SPEC.md §5.9): lists the SRD manifest records with no
// SRD entry in the library, by type and tier, and SRD entries the manifest
// lacks. `--type <type>` and `--tier <complex|simple>` narrow the report;
// `--ruleset <id>` picks a ruleset other than config/defaults.json's.

import { parseArgs } from 'node:util';
import { loadDefaults } from '../generate/defaults.ts';
import { loadRegistry, PROJECT_ROOT } from '../validate/schema.ts';
import { checkManifest, coverage, formatReport, loadEntryHeads, loadManifest, TIERS, type Tier } from './coverage.ts';

const { values } = parseArgs({
  options: { type: { type: 'string' }, tier: { type: 'string' }, ruleset: { type: 'string' } },
});

const ruleset = values.ruleset ?? (await loadDefaults()).ruleset;
const types = Object.keys((await loadRegistry())[ruleset]?.types ?? {});
const usage: string[] = [];
if (types.length === 0) usage.push(`unknown ruleset "${ruleset}"`);
if (values.type && !types.includes(values.type)) usage.push(`--type must be one of ${types.join(', ')}`);
if (values.tier && !(TIERS as readonly string[]).includes(values.tier)) usage.push(`--tier must be one of ${TIERS.join(', ')}`);
if (usage.length > 0) {
  console.error(usage.join('\n'));
  process.exit(2);
}

const manifest = await loadManifest(PROJECT_ROOT, ruleset);
const problems = checkManifest(manifest, ruleset, types);
if (problems.length > 0) {
  console.error(`rulesets/${ruleset}/srd-manifest.json:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const entries = await loadEntryHeads(PROJECT_ROOT, ruleset);
console.log(formatReport(coverage(manifest, entries, { type: values.type, tier: values.tier as Tier | undefined })));
