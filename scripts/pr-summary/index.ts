// The content-checks job summary (docs/workflow.md#ci-checks): each changed entry with its name, type,
// summary field, and summary; a creature's derived values; every warning; and the back-links the
// change adds. Everything but a removed entry comes from the validator's result for the PR, so
// nothing here recomputes a rule.

import { ruleNames } from '../../lib/rules.ts';
import { vocabularyName } from '../../lib/wording/book.ts';
import { printMinus, signed } from '../../rulesets/dnd-5e-2024/derive.ts';
import { ACTION_LISTS, type Action, type CreatureStats, type DerivedAction, type DerivedCreature } from '../../rulesets/dnd-5e-2024/types.ts';
import type { RulesetModule } from '../../rulesets/module.ts';
import { acLine, hpLine } from '../../site/src/lib/creature.ts';
import { formatValue } from '../../site/src/lib/format.ts';
import type { Registry } from '../build-index/index.ts';
import type { ValidationResult } from '../validate/index.ts';
import { collectRefs, entryKey } from '../validate/refs.ts';

export type ChangeStatus = 'added' | 'modified' | 'removed';

export interface EntryChange {
  status: ChangeStatus;
  /** content/<ruleset>/<type>/<id>.json */
  path: string;
}

/** A changed entry file, with what it held at the merge base. */
export interface ChangedFile extends EntryChange {
  /**
   * The file at the merge base, parsed: a removed entry's row is read from it, and a modified
   * entry's links are new only if it lacked them. Undefined for a file that can't be read there.
   */
  base?: unknown;
}

export interface SummaryInput {
  changes: ChangedFile[];
  /** The validator's result for the PR, which passed, so every entry it adds or keeps is in it. */
  library: Pick<ValidationResult, 'entries' | 'components' | 'warnings' | 'rules'>;
  registry: Registry;
  /** Each ruleset's module, for its phrase book and back-link labels. */
  modules: Map<string, RulesetModule>;
}

const STATUSES: Record<string, ChangeStatus> = { A: 'added', M: 'modified', D: 'removed' };

/** Reads `git diff --name-status --no-renames` output, keeping entry files. */
export function parseNameStatus(output: string): EntryChange[] {
  const changes: EntryChange[] = [];
  for (const line of output.split('\n')) {
    const [code, path] = line.split('\t');
    const status = STATUSES[code ?? ''];
    if (status && path?.startsWith('content/') && path.endsWith('.json')) {
      changes.push({ status, path });
    }
  }
  return changes;
}

const cell = (value: unknown): string =>
  typeof value === 'string' ? value.replaceAll('|', '\\|').replaceAll('\n', ' ') : '';

type Head = { ruleset?: unknown; type?: unknown; name?: unknown; summary?: unknown; stats?: unknown };
const asHead = (value: unknown): Head | undefined => (typeof value === 'object' && value !== null ? (value as Head) : undefined);

/** The value at a dotted path such as `stats.cr`, or undefined. */
function at(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** The type's `summaryField` value (docs/site.md#type-registry), read as its facet reads it: by vocabulary or format. */
function summaryField(entry: Head, registry: Registry, modules: Map<string, RulesetModule>): string | undefined {
  if (typeof entry.ruleset !== 'string' || typeof entry.type !== 'string') return undefined;
  const config = registry[entry.ruleset]?.types[entry.type];
  const path = config?.summaryField;
  if (typeof path !== 'string') return undefined;
  const value = at(entry, path);
  if (value === undefined) return undefined;
  const facet = config?.facets.find((f) => f.path === path);
  const book = modules.get(entry.ruleset)?.phrases;
  if (facet?.vocabulary && book && typeof value === 'string') return vocabularyName(book, facet.vocabulary, value) ?? value;
  return formatValue(value, facet?.format);
}

/** One action's attack bonus, DC, and damage, as the stat block derives them; undefined for one with none. */
function actionValues(derived: DerivedAction | undefined): string | undefined {
  if (!derived) return undefined;
  const parts: string[] = [];
  if (derived.attackBonus !== undefined) parts.push(`${signed(derived.attackBonus)} to hit`);
  if (derived.saveDc !== undefined) parts.push(`DC ${derived.saveDc}`);
  if (derived.damage.length > 0) {
    const average = derived.damage.reduce((sum, d) => sum + d.average, 0);
    parts.push(`${derived.damage.map((d) => printMinus(d.display)).join(' + ')} damage, ${average} on average`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** A dnd-5e-2024 creature's AC, derived HP, and each action's derived values (docs/rulesets.md#creatures). */
function creatureValues(name: string, stats: CreatureStats, derived: DerivedCreature): string[] {
  const lines = [`**${name}**: AC ${acLine(stats)}, HP ${hpLine(derived)}`];
  const lists: [Action[] | undefined, DerivedAction[]][] = [
    ...ACTION_LISTS.map((list) => [stats[list], derived[list]] as [Action[] | undefined, DerivedAction[]]),
    [stats.legendaryActions?.items, derived.legendaryActions.items],
  ];
  for (const [actions = [], derivedActions] of lists) {
    actions.forEach((action, i) => {
      const values = actionValues(derivedActions[i]);
      if (values) lines.push(`- ${action.name}: ${values}`);
    });
  }
  if (derived.spellcasting) lines.push(`- Spellcasting: ${signed(derived.spellcasting.attackBonus)} to hit, DC ${derived.spellcasting.dc}`);
  return [...lines, ''];
}

/** The targets a file's base version linked to: its `{ ref }` objects and `{ref:…}` tokens. */
function baseTargets(base: unknown): Set<string> {
  const { description, stats } = (asHead(base) ?? {}) as { description?: unknown; stats?: unknown };
  return new Set([...(typeof description === 'string' ? collectRefs(description, 'description') : []), ...collectRefs(stats)].map((r) => r.ref));
}

/** The job summary for changed entries (docs/workflow.md#ci-checks). */
export function renderSummary({ changes, library, registry, modules }: SummaryInput): string {
  const lines = ['## Changed entries', ''];
  if (changes.length === 0) return [...lines, 'No entries changed.', ''].join('\n');

  const all = [...library.entries, ...library.components.map((c) => ({ ...c, parentKey: c.parent }))];
  const byPath = new Map(all.map((item) => [`content/${item.file}`, item]));
  // Targets read as their pages show them: a component as "Parent › Component" (docs/content-model.md#components).
  const names = new Map<string, string>([
    ...library.rules.flatMap((data) => [...ruleNames(data)]),
    ...library.entries.map(({ entry }) => [entryKey(entry), entry.name] as [string, string]),
  ]);
  for (const { entry, parent } of library.components) names.set(entryKey(entry), `${names.get(parent) ?? parent} › ${entry.name}`);
  const found = (change: ChangedFile) => (change.status === 'removed' ? undefined : byPath.get(change.path));

  lines.push('| Change | Name | Type | Summary field | Summary |', '|---|---|---|---|---|');
  for (const change of changes) {
    const item = found(change);
    const head = item ? (item.entry as Head) : asHead(change.base);
    const [, , type, file] = change.path.split('/');
    const name = item ? names.get(entryKey(item.entry)) : typeof head?.name === 'string' ? head.name : undefined;
    const entryType = typeof head?.type === 'string' ? head.type : type;
    const key = head ? summaryField(head, registry, modules) : undefined;
    lines.push(`| ${change.status} | ${name ? cell(name) : `\`${file?.replace(/\.json$/, '')}\``} | ${cell(entryType)} | ${cell(key)} | ${cell(head?.summary)} |`);
  }

  const creatures = changes.flatMap((change) => {
    const item = found(change);
    return item && item.entry.ruleset === 'dnd-5e-2024' && item.entry.type === 'creature' ? [item] : [];
  });
  if (creatures.length > 0) {
    lines.push('', '### Creature values', '');
    for (const { entry, derived } of creatures) lines.push(...creatureValues(entry.name, entry.stats as CreatureStats, derived as unknown as DerivedCreature));
    lines.pop();
  }

  lines.push('', '### Warnings', '');
  if (library.warnings.length === 0) lines.push('None.');
  for (const { file, message } of library.warnings) lines.push(`- \`${file}\`: ${message}`);

  // A link is new when the changed entry's base version didn't link to its target. The links among a
  // page's own parts aren't back-links (docs/content-model.md#components), so they're left out.
  const added = new Map<string, [string, string]>();
  for (const change of changes) {
    const item = found(change);
    if (!item) continue;
    const from = entryKey(item.entry);
    const page = 'parentKey' in item ? item.parentKey : from;
    const own = new Set([page, ...library.components.filter((c) => c.parent === page).map((c) => entryKey(c.entry))]);
    const had = change.status === 'modified' ? baseTargets(change.base) : new Set<string>();
    const module = modules.get(item.entry.ruleset);
    for (const { path, key } of item.refs) {
      if (own.has(key) || had.has(key)) continue;
      const label = module?.refLabels(item.entry.type, path).back ?? 'Referenced by';
      const row: [string, string] = [names.get(key) ?? key, `${label}: ${names.get(from) ?? from}`];
      added.set(row.join('\u0000'), row);
    }
  }
  lines.push('', '### New back-links', '');
  if (added.size === 0) lines.push('None.');
  else {
    lines.push('| Entry | Back-link |', '|---|---|');
    for (const [target, link] of added.values()) lines.push(`| ${cell(target)} | ${cell(link)} |`);
  }
  return [...lines, ''].join('\n');
}
