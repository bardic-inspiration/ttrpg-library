// `npm run srd-coverage` (docs/content-model.md#srd-manifest-and-coverage): lists the SRD manifest records with no
// SRD entry in the library, by type and tier, and SRD entries the manifest
// lacks; then the same for the rules data's primitives and groups, which have no tier.
// `--type <type>` (a type or a rules type) and `--tier <complex|simple>` narrow the report;
// `--ruleset <id>` picks a ruleset other than config/defaults.json's.

import { parseArgs } from 'node:util';
import { loadDefaults } from '../generate/defaults.ts';
import { loadRegistry, PROJECT_ROOT } from '../validate/schema.ts';
import { checkManifest, coverage, formatReport, loadEntryHeads, loadManifest, loadRuleHeads, loadRulesTypes, rulesCoverage, TIERS, type Tier } from './coverage.ts';

const { values } = parseArgs({
  options: { type: { type: 'string' }, tier: { type: 'string' }, ruleset: { type: 'string' } },
});

const ruleset = values.ruleset ?? (await loadDefaults()).ruleset;
const types = Object.keys((await loadRegistry())[ruleset]?.types ?? {});
const rulesTypes = types.length === 0 ? [] : await loadRulesTypes(PROJECT_ROOT, ruleset);
const usage: string[] = [];
if (types.length === 0) usage.push(`unknown ruleset "${ruleset}"`);
const allTypes = [...new Set([...types, ...rulesTypes])];
if (values.type && !allTypes.includes(values.type)) usage.push(`--type must be one of ${allTypes.join(', ')}`);
if (values.tier && !(TIERS as readonly string[]).includes(values.tier)) usage.push(`--tier must be one of ${TIERS.join(', ')}`);
if (usage.length > 0) {
  console.error(usage.join('\n'));
  process.exit(2);
}

const manifest = await loadManifest(PROJECT_ROOT, ruleset);
const problems = checkManifest(manifest, ruleset, types, rulesTypes);
if (problems.length > 0) {
  console.error(`rulesets/${ruleset}/srd-manifest.json:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const entries = await loadEntryHeads(PROJECT_ROOT, ruleset);
const filter = { type: values.type, tier: values.tier as Tier | undefined };
// Rules records have no tier, so --tier leaves them out.
const rules = values.tier ? undefined : rulesCoverage(manifest, await loadRuleHeads(PROJECT_ROOT, ruleset), { type: values.type });
console.log(formatReport(coverage(manifest, entries, filter), rules));
