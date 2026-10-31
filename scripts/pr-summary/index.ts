export type ChangeStatus = 'added' | 'modified' | 'removed';

export interface EntryChange {
  status: ChangeStatus;
  /** content/<ruleset>/<type>/<id>.json */
  path: string;
}

export interface EntrySummary {
  name?: unknown;
  type?: unknown;
  summary?: unknown;
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

/**
 * The job summary for changed entries (SPEC.md §12.1). An entry that can't be
 * read falls back to the id and type its path gives. The type's summaryField
 * value, creature derived values, and warnings join once the type registry
 * and ruleset module exist (#6, #9).
 */
export function renderSummary(changes: (EntryChange & { entry: EntrySummary | undefined })[]): string {
  const lines = ['## Changed entries', ''];
  if (changes.length === 0) return [...lines, 'No entries changed.', ''].join('\n');
  lines.push('| Change | Name | Type | Summary |', '|---|---|---|---|');
  for (const { status, path, entry } of changes) {
    const [, , type, file] = path.split('/');
    const name = typeof entry?.name === 'string' ? cell(entry.name) : `\`${file?.replace(/\.json$/, '')}\``;
    const entryType = typeof entry?.type === 'string' ? cell(entry.type) : cell(type);
    lines.push(`| ${status} | ${name} | ${entryType} | ${cell(entry?.summary)} |`);
  }
  return [...lines, ''].join('\n');
}
