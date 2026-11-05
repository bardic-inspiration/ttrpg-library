import { dirname, normalize } from 'node:path';

// The link check (docs/workflow.md#link-check). Docs are cited by file and
// heading, so a renamed heading or a moved file must fail CI wherever it was
// cited. Uses only Node built-ins: the `lane` job runs it without `npm ci`.

const TEXT = /\.(md|ts|tsx|astro|mjs|js|json|ya?ml|css|sh)$/;
/** Data, not prose: entries and fixtures, the lockfile, and this check's own tests. */
const SKIP = [/^content\//, /^tests\/fixtures\//, /^package-lock\.json$/, /^tests\/links\.test\.ts$/];

export const isScanned = (path: string): boolean => TEXT.test(path) && !SKIP.some((skip) => skip.test(path));

/** A heading's anchor as GitHub writes it, before repeats are numbered. */
export const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');

/** Every heading anchor in a Markdown file, with repeats numbered `-1`, `-2`, … */
export function anchors(markdown: string): Set<string> {
  const found = new Set<string>();
  const counts = new Map<string, number>();
  let fence: string | undefined;
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1];
    if (!heading) continue;
    const base = slug(heading);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    found.add(count === 0 ? base : `${base}-${count}`);
  }
  return found;
}

/** A citation of a doc anywhere in a file: `docs/<file>.md` or `spec/v2/<file>.md`, with an optional anchor. */
const CITATION = /(?<![\w./-])((?:docs|spec\/v2)\/[\w./-]*?\.md)(?:#([\w-]+))?/g;
/** An inline Markdown link or image target. */
const LINK = /\]\(([^)\s]+)\)/g;
const SECTION = /§\s?\d+(?:\.\d+)*/g;

/**
 * One message per problem: a cited file or heading that doesn't exist, a
 * relative Markdown link that doesn't resolve, or a section-number citation.
 * `files` holds every scanned file's text by repo path; `exists` reports any
 * repo path, including folders and files that aren't scanned.
 */
export function checkLinks(files: Map<string, string>, exists: (path: string) => boolean): string[] {
  const anchorCache = new Map<string, Set<string>>();
  const anchorsOf = (path: string) => {
    if (!anchorCache.has(path)) anchorCache.set(path, anchors(files.get(path) ?? ''));
    return anchorCache.get(path)!;
  };
  const problems: string[] = [];

  for (const [path, text] of files) {
    text.split('\n').forEach((line, index) => {
      const where = `${path}:${index + 1}`;
      const check = (target: string, file: string, anchor: string | undefined) => {
        if (file !== path && !exists(file)) problems.push(`${where}: ${target}: no such file`);
        else if (anchor && file.endsWith('.md') && !anchorsOf(file).has(anchor))
          problems.push(`${where}: ${target}: no such heading`);
      };

      for (const match of line.matchAll(CITATION)) {
        check(match[0], match[1]!, match[2]);
      }
      if (path.endsWith('.md')) {
        for (const [, target] of line.matchAll(LINK)) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(target!) || target!.startsWith('/')) continue; // URLs and site paths
          const [file, anchor] = target!.split('#') as [string, string | undefined];
          const resolved = file ? normalize(`${dirname(path)}/${file}`).replace(/\/$/, '') : path;
          check(target!, resolved, anchor);
        }
      }
      for (const [section] of line.matchAll(SECTION)) {
        problems.push(`${where}: "${section}": cite a doc by file and heading, not section number`);
      }
    });
  }
  return problems;
}
