// Running npm scripts against another library (docs/site.md#library-root) without shell syntax, so
// `build:originals` and `dev:originals` work in every shell npm uses, cmd.exe included.

/** One npm script to run: the program, its arguments, and its environment. */
export interface Run {
  command: string;
  args: string[];
  env: Record<string, string | undefined>;
  /** Whether it needs a shell to find npm, only when npm didn't start this process. */
  shell: boolean;
}

/**
 * The runs of `scripts` in order, each with `LIBRARY_ROOT` set to `root`. Under npm, each runs npm's
 * own CLI with the current Node, which needs no shell; otherwise `npm` is looked up through one.
 */
export function libraryRuns(root: string, scripts: string[], env: Record<string, string | undefined>, node: string): Run[] {
  const npm = env.npm_execpath;
  return scripts.map((script) => ({
    command: npm ? node : 'npm',
    args: [...(npm ? [npm] : []), 'run', script],
    env: { ...env, LIBRARY_ROOT: root },
    shell: !npm,
  }));
}
