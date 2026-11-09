// Reads every entry under content/ at build time, derives its values with its
// ruleset module, and links its refs (docs/content-model.md#references, docs/site.md#index-build step 3). Validation
// has already run in build:index, so entries here are known good.

import type { RulesetModule } from '../../../rulesets/module.ts';
import type { RefTarget } from './refs.ts';
import { entryKey, linkEntries, objectRefs, type Link, type Links, type RefEntry } from '../../../scripts/validate/refs.ts';
import { anchorId, ruleKey, rulePaths, typedGroups, type RulesData } from '../../../lib/rules.ts';

export interface Entry {
  ruleset: string;
  type: string;
  id: string;
  name: string;
  /** Absent only on a component (docs/content-model.md#components), which never reaches a card or page of its own. */
  summary: string;
  description?: string;
  stats: unknown;
  tags?: Record<string, unknown>;
  image?: string;
  meta: { createdAt: string; updatedAt?: string; source: { kind: string; issues?: number[]; gapFill?: string; srd?: true } };
}

export interface LoadedEntry {
  entry: Entry;
  derived: Record<string, unknown>;
  /** Refs out of this entry, keyed `<type>/<id>`. */
  refs: Link[];
  /** Refs into this entry from other entries. */
  refBy: Link[];
  /** A page type's components, in the order its stats list them (docs/content-model.md#components). */
  components?: LoadedComponent[];
}

/** A component, loaded with its parent and shown only on the parent's page. */
export interface LoadedComponent {
  entry: Omit<Entry, 'summary'>;
  derived: Record<string, unknown>;
  refs: Link[];
  refBy: Link[];
  /** The parent's entry. */
  parent: Entry;
}

const files = import.meta.glob<Entry>('../../../content/**/*.json', { eager: true, import: 'default' });
const modules = import.meta.glob<{ ruleset: RulesetModule }>('../../../rulesets/*/index.ts', { eager: true });

export function rulesetModule(id: string): RulesetModule {
  const module = modules[`../../../rulesets/${id}/index.ts`];
  if (!module) throw new Error(`No ruleset module for "${id}"`);
  return module.ruleset;
}

/** Every entry under content/, derived and linked, sorted by name. */
export const loadEntries = (rules: RulesData[] = []): LoadedEntry[] => loadLibrary(Object.values(files), rules);

/** The primitives and groups of rules data as link ends (docs/rulesets.md#rules-data). */
export const ruleLinkables = (rules: RulesData[]): RefEntry[] =>
  rules.flatMap((data) => [
    ...data.primitives.map((p) => ({ file: ruleKey(p), ruleset: data.ruleset, type: p.type, id: p.id, stats: p.stats })),
    ...typedGroups(data).map((g) => ({
      file: ruleKey(g),
      ruleset: data.ruleset,
      type: g.type,
      id: g.id,
      ...(g.text ? { stats: g.text, statsPath: `${g.id}.text` } : { stats: {} }),
    })),
  ]);

/** Links among entries, primitives, and groups, by key. */
export function linkAll(entries: Entry[], rules: RulesData[] = []): Map<string, Links> {
  return linkEntries([...entries.map((entry) => ({ ...entry, file: entryPath(entry) })), ...ruleLinkables(rules)]).links;
}

/**
 * Derives and links a set of entries, sorted by name. Refs to rules data
 * resolve when it's given. `moduleFor` defaults to the repo's rulesets.
 */
export function loadLibrary(
  entries: Entry[],
  rules: RulesData[] = [],
  moduleFor: (id: string) => RulesetModule = rulesetModule,
): LoadedEntry[] {
  const links = linkAll(entries, rules);
  const load = (entry: Entry) => ({
    entry,
    derived: moduleFor(entry.ruleset).derive(entry.type, entry.stats, rules.find((r) => r.ruleset === entry.ruleset)),
    ...(links.get(entryKey(entry)) ?? { refs: [], refBy: [] }),
  });
  // A component is loaded onto the entry that lists it by ref, in that order (docs/content-model.md#components).
  const isComponent = (entry: Entry) => (moduleFor(entry.ruleset).definition.components ?? []).some((c) => c.type === entry.type);
  const components = new Map(entries.filter(isComponent).map((entry) => [entryKey(entry), entry]));
  return entries
    .filter((entry) => !components.has(entryKey(entry)))
    .map((entry) => {
      const listed = [...new Set(objectRefs(entry.stats).map((r) => r.ref))].flatMap((key) => {
        const component = components.get(key);
        return component ? [{ ...load(component), parent: entry }] : [];
      });
      return listed.length > 0 ? { ...load(entry), components: listed } : load(entry);
    })
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

/** Every component in a loaded library, with its parent. */
export const allComponents = (all: LoadedEntry[]): LoadedComponent[] => all.flatMap((loaded) => loaded.components ?? []);

/** Where a component's section is: its parent's page, at `#<type>-<id>`. */
export const componentPath = (component: LoadedComponent): string =>
  `${entryPath(component.parent)}#${anchorId(entryKey(component.entry))}`;

export const entryPath = (entry: Pick<Entry, 'ruleset' | 'type' | 'id'>): string => `${entry.ruleset}/${entry.type}/${entry.id}/`;

/** `<type>/<id>` → name of an entry, primitive, or group, for rendering refs as names. */
export const entryNames = (all: LoadedEntry[], rules: RulesData[] = []): Map<string, string> =>
  new Map([
    ...rules.flatMap((data) => [
      ...data.primitives.map((p) => [ruleKey(p), p.name] as [string, string]),
      ...typedGroups(data).map((g) => [ruleKey(g), g.name] as [string, string]),
    ]),
    ...[...all, ...allComponents(all)].map(({ entry }) => [entryKey(entry), entry.name] as [string, string]),
  ]);

/**
 * Primitive, group, and component key → path of its anchor: a rules page's, or a component's on its
 * parent's page. An entry's path needs no lookup.
 */
export const refPaths = (rules: RulesData[], all: LoadedEntry[] = []): Map<string, string> =>
  new Map([
    ...rules.flatMap((data) => [...rulePaths(data)]),
    ...allComponents(all).map((c) => [entryKey(c.entry), componentPath(c)] as [string, string]),
  ]);

/** `<type>/<id>` → link target, for the detail page's refs and back-refs: an entry's page, or a primitive's or group's anchor. */
export function refTargets(all: LoadedEntry[], rules: RulesData[] = []): Map<string, RefTarget> {
  const paths = refPaths(rules);
  const names = entryNames([], rules);
  return new Map([
    ...[...paths].map(([key, path]) => [key, { type: key.slice(0, key.indexOf('/')), name: names.get(key) ?? key, path }] as [string, RefTarget]),
    ...all.map(({ entry }) => [entryKey(entry), { type: entry.type, name: entry.name, path: entryPath(entry) }] as [string, RefTarget]),
    // A link to a component names its parent too, "Barbarian › Rage", since many parents share component names.
    ...allComponents(all).map(
      (c) =>
        [entryKey(c.entry), { type: c.entry.type, name: `${c.parent.name} › ${c.entry.name}`, path: componentPath(c) }] as [string, RefTarget],
    ),
  ]);
}
