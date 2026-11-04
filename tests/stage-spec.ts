import { parse } from 'yaml';

// spec/v2/README.md "Area files" and "Checks": the shape every area file of
// the stage spec keeps, and the references it makes that must resolve.

/** The area template's sections, in order. Goal and Design are required. */
export const SECTIONS = [
  'Goal',
  'Current',
  'Design',
  'Cases',
  'Migration',
  'Done when',
  'Open questions',
  'Out of scope',
] as const;
const REQUIRED = ['Goal', 'Design'];
const KEYS = new Set(['issue', 'depends']);

export interface AreaFile {
  /** The file name without `.md`, which is how other areas name it in `depends`. */
  name: string;
  text: string;
}

const ENTRY_KEY = /^[a-z]+(?:-[a-z]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function frontMatter(text: string): { data: Record<string, unknown>; body: string } | undefined {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return undefined;
  const data = parse(match[1]!) as unknown;
  return {
    data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
    body: text.slice(match[0].length),
  };
}

/** The text of one `## ` section, up to the next `## ` heading. */
function section(body: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(body);
  return match?.[1] ?? '';
}

function checkFile(file: AreaFile, areas: Set<string>, entryExists: (key: string) => boolean): string[] {
  const where = `${file.name}.md`;
  const parsed = frontMatter(file.text);
  if (!parsed) return [`${where}: no front matter`];
  const problems: string[] = [];
  const { data, body } = parsed;

  for (const key of Object.keys(data)) if (!KEYS.has(key)) problems.push(`${where}: unknown front matter key "${key}"`);
  if (!Number.isInteger(data.issue) || (data.issue as number) < 1)
    problems.push(`${where}: issue must be a positive integer`);
  for (const dep of dependsOf(data)) {
    if (dep === file.name) problems.push(`${where}: depends on itself`);
    else if (!areas.has(dep)) problems.push(`${where}: depends on "${dep}", which has no area file`);
  }

  if (!body.trimStart().startsWith('# ')) problems.push(`${where}: must start with a "# " title`);
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim());
  let last = -1;
  const seen = new Set<string>();
  for (const heading of headings) {
    const index = (SECTIONS as readonly string[]).indexOf(heading);
    if (index < 0) problems.push(`${where}: unknown section "## ${heading}"`);
    else if (seen.has(heading)) problems.push(`${where}: "## ${heading}" appears more than once`);
    else if (index < last) problems.push(`${where}: "## ${heading}" is out of order`);
    else last = index;
    seen.add(heading);
  }
  for (const heading of REQUIRED) if (!seen.has(heading)) problems.push(`${where}: missing "## ${heading}"`);

  for (const [, span] of section(body, 'Cases').matchAll(/`([^`\n]+)`/g)) {
    if (ENTRY_KEY.test(span!) && !entryExists(span!)) problems.push(`${where}: case "${span}" is not a library entry`);
  }
  return problems;
}

const dependsOf = (data: Record<string, unknown>): string[] =>
  Array.isArray(data.depends) ? data.depends.map(String) : [];

/** The first dependency cycle among the areas, as names from start back to start. */
function findCycle(graph: Map<string, string[]>): string[] | undefined {
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];
  const visit = (node: string): string[] | undefined => {
    if (state.get(node) === 'done') return undefined;
    if (state.get(node) === 'visiting') return [...path.slice(path.indexOf(node)), node];
    state.set(node, 'visiting');
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      if (next === node || !graph.has(next)) continue; // reported per file
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(node, 'done');
    return undefined;
  };
  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return undefined;
}

/** One message per problem across the stage spec's area files. */
export function checkAreas(files: AreaFile[], entryExists: (key: string) => boolean): string[] {
  const areas = new Set(files.map((f) => f.name));
  const problems = files.flatMap((file) => checkFile(file, areas, entryExists));
  const graph = new Map(files.map((f) => [f.name, dependsOf(frontMatter(f.text)?.data ?? {})]));
  const cycle = findCycle(graph);
  if (cycle) problems.push(`dependency cycle: ${cycle.join(' → ')}`);
  return problems;
}
