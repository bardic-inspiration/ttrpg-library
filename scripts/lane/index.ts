export type Lane = 'content' | 'dev';

/** Branch prefixes per lane (docs/workflow.md#work-lanes). */
export const LANE_PREFIXES: Record<Lane, readonly string[]> = {
  content: ['gen/', 'revise/', 'manual/'],
  dev: ['dev/', 'dependabot/'],
};

/** Paths only the content lane may change, or a dev PR with the `migration` label. */
const CONTENT_PATHS = ['content/', 'assets/images/'];

/**
 * Paths no code or test reads, so a PR that changes only these skips the
 * content and dev checks (docs/workflow.md#docs-only-prs): Markdown at the repo
 * root, `docs/**`, and the issue and dev PR templates. A file that a test or
 * script reads (`docs/routines.md`, the content PR template) stays code.
 */
const DOCS_EXCEPTIONS = ['docs/routines.md'];

export function isDocsPath(path: string): boolean {
  if (DOCS_EXCEPTIONS.includes(path)) return false;
  if (!path.includes('/')) return path.endsWith('.md');
  if (path.startsWith('docs/')) return true;
  if (/^\.github\/ISSUE_TEMPLATE\/[^/]+\.md$/.test(path)) return true;
  return path === '.github/PULL_REQUEST_TEMPLATE/dev.md';
}

export interface LaneInput {
  branch: string;
  /** Paths the PR changes, relative to the repo root. */
  paths: string[];
  labels: string[];
}

export interface LaneResult {
  lane: Lane | undefined;
  contentChanged: boolean;
  /** Every changed path is docs (and there is at least one). */
  docsOnly: boolean;
  errors: string[];
}

/** Prefixes that never get a lane, so a branch under them can't merge. */
export const REJECTED_PREFIXES: readonly string[] = ['spike/'];

/**
 * A branch with a lane prefix is in that lane. Any other branch (a GitHub
 * web-editor `<user>-patch-1`, a `claude/...` cloud-session name) is in the dev
 * lane, whose rules still block content changes without the `migration` label.
 * Only a rejected prefix has no lane.
 */
export function laneOf(branch: string): Lane | undefined {
  for (const lane of Object.keys(LANE_PREFIXES) as Lane[]) {
    if (LANE_PREFIXES[lane].some((prefix) => branch.startsWith(prefix))) return lane;
  }
  if (REJECTED_PREFIXES.some((prefix) => branch.startsWith(prefix))) return undefined;
  return 'dev';
}

export function isContentPath(path: string): boolean {
  return CONTENT_PATHS.some((prefix) => path.startsWith(prefix));
}

/** Applies the lane rules (docs/workflow.md#lane-rules) to a PR. */
export function checkLane({ branch, paths, labels }: LaneInput): LaneResult {
  const lane = laneOf(branch);
  const contentChanged = paths.some(isContentPath);
  const docsOnly = paths.length > 0 && paths.every(isDocsPath);
  const errors: string[] = [];
  const list = (items: string[]) => items.map((item) => `  ${item}`).join('\n');

  if (lane === undefined) {
    errors.push(
      `Branch "${branch}" is under a prefix that can't merge (${REJECTED_PREFIXES.join(', ')}). Open the PR from a new branch.`,
    );
  } else if (lane === 'content') {
    const outside = paths.filter((path) => !isContentPath(path));
    if (outside.length > 0) {
      errors.push(
        `A content-lane PR may change only content/** and assets/images/**. Outside those:\n${list(outside)}`,
      );
    }
  } else if (needsMigrationLabel({ branch, paths, labels })) {
    errors.push(
      `A dev-lane PR may change content only with the migration label, which the labeler adds. Content paths:\n${list(paths.filter(isContentPath))}`,
    );
  }
  return { lane, contentChanged, docsOnly, errors };
}

/** Whether a PR is a dev PR that changes content without the `migration` label the labeler adds. */
export const needsMigrationLabel = ({ branch, paths, labels }: LaneInput): boolean =>
  laneOf(branch) === 'dev' && paths.some(isContentPath) && !labels.includes('migration');

export interface WaitOptions {
  /** How many times to read the labels (default 12). */
  attempts?: number;
  /** The pause before each read (default 5 seconds). */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads a PR's current labels until `label` appears, for up to `attempts`
 * reads, and returns the last labels read (docs/workflow.md#labeling). The labeler adds
 * `migration` a few seconds after a PR opens or changes, with the workflow's
 * token, and GitHub starts no new run for that label event, so the lane job
 * waits for it instead of reading only the labels in its event payload.
 */
export async function waitForLabel(
  label: string,
  fetchLabels: () => Promise<string[]>,
  { attempts = 12, delayMs = 5000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: WaitOptions = {},
): Promise<string[]> {
  let labels: string[] = [];
  for (let i = 0; i < attempts; i++) {
    await sleep(delayMs);
    labels = await fetchLabels();
    if (labels.includes(label)) break;
  }
  return labels;
}
