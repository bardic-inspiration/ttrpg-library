// Rules data for the site (docs/rulesets.md#rules-data, docs/site.md#rules-pages): each ruleset's
// primitives, groups, and rules pages, read at build time. Validation has
// already run in build:index, so the data here is known good.

import type { RefLabels, RulesetDefinition, RulesetModule } from '../../../rulesets/module.ts';
import { GroupTree, extensionPage, type Primitive, type RulesData, type RulesGroup, type RulesPage } from '../../../lib/rules.ts';
import type { Links } from '../../../scripts/validate/refs.ts';
import { entryNames, linkAll, refPaths, refTargets, rulesetModule, type LoadedEntry } from './library.ts';
import type { RefTarget } from './refs.ts';

const definitions = import.meta.glob<RulesetDefinition>('../../../rulesets/*/ruleset.json', { eager: true, import: 'default' });
const ruleFiles = import.meta.glob<unknown>('../../../rulesets/*/rules/**/*.json', { eager: true, import: 'default' });

/**
 * One ruleset's rules data from its files, keyed by their path inside
 * `rules/`: `<type>/<id>.json`, `<type>-groups.json`, and `pages.json`.
 */
export function rulesData(definition: RulesetDefinition, files: Record<string, unknown>): RulesData {
  const types = definition.rules ?? [];
  const primitives: Primitive[] = [];
  const groups = new Map<string, GroupTree>();
  for (const { type } of types) {
    const groupList = files[`${type}-groups.json`] as RulesGroup[] | undefined;
    if (groupList) groups.set(type, new GroupTree(type, groupList));
    for (const [path, data] of Object.entries(files)) if (path.startsWith(`${type}/`)) primitives.push(data as Primitive);
  }
  primitives.sort((a, b) => a.name.localeCompare(b.name));
  return { ruleset: definition.id, types, primitives, groups, pages: (files['pages.json'] as RulesPage[] | undefined) ?? [] };
}

/** Every ruleset's rules data under rulesets/, for rulesets that have rules types. */
export function loadRules(): RulesData[] {
  return Object.entries(definitions)
    .filter(([, definition]) => (definition.rules ?? []).length > 0)
    .map(([path, definition]) => {
      const prefix = path.replace(/ruleset\.json$/, 'rules/');
      const files = Object.fromEntries(
        Object.entries(ruleFiles)
          .filter(([file]) => file.startsWith(prefix))
          .map(([file, data]) => [file.slice(prefix.length), data]),
      );
      return rulesData(definition, files);
    });
}

/** Everything a rules page renders from: one ruleset's data, with names, paths, and links across the library. */
export interface RulesContext {
  data: RulesData;
  names: Map<string, string>;
  paths: Map<string, string>;
  targets: Map<string, RefTarget>;
  /** Forward refs and back-refs of every primitive and group, by key. */
  links: Map<string, Links>;
  /** The ruleset's extension entries (entries of its rules types), by name. */
  extensions: LoadedEntry[];
  labelFor: (type: string, path: string) => RefLabels;
  /** A primitive's derived values, for sorting a group's members. */
  derive: (primitive: { type: string; stats: unknown }) => Record<string, unknown>;
}

/**
 * The context for one ruleset's rules pages. `rules` is every ruleset's data,
 * for names and paths; `module` defaults to the ruleset's own.
 */
export function rulesContext(
  data: RulesData,
  all: LoadedEntry[],
  rules: RulesData[],
  module: RulesetModule = rulesetModule(data.ruleset),
): RulesContext {
  const types = new Set(data.types.map((t) => t.type));
  return {
    data,
    names: entryNames(all, rules),
    paths: refPaths(rules),
    targets: refTargets(all, rules),
    links: linkAll(
      all.map(({ entry }) => entry),
      rules,
    ),
    extensions: all.filter(({ entry }) => entry.ruleset === data.ruleset && types.has(entry.type)),
    labelFor: (type, path) => module.refLabels(type, path),
    derive: (primitive) => module.derive(primitive.type, primitive.stats, data),
  };
}

/** The extensions listed at the bottom of one rules page. */
export const pageExtensions = (ctx: RulesContext, page: string): LoadedEntry[] =>
  ctx.extensions.filter(({ entry }) => extensionPage(ctx.data, entry) === page);

/**
 * Names, qualifiers, and category nouns of equipment keys, for wording an item's base item
 * (docs/rulesets.md#items): a group's noun is its category's.
 */
export function baseLookup(rules: RulesData[]): (key: string) => { name: string; qualifier?: string; noun?: string; group: boolean } | undefined {
  const entries = new Map<string, { name: string; qualifier?: string; noun?: string; group: boolean }>();
  for (const data of rules) {
    for (const p of data.primitives) entries.set(`${p.type}/${p.id}`, { name: p.name, group: false });
    for (const tree of data.groups.values()) {
      for (const g of tree.groups) {
        let root = g;
        while (root.parent !== undefined) root = tree.byId.get(root.parent) ?? root;
        entries.set(`${tree.type}/${g.id}`, {
          name: g.name,
          group: true,
          ...(g.qualifier ? { qualifier: g.qualifier } : {}),
          ...(root.noun ? { noun: root.noun } : {}),
        });
      }
    }
  }
  return (key) => entries.get(key);
}
