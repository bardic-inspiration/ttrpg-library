// docs/workflow.md#deploy: one Pages artifact holds production, built from the latest release
// tag, and the preview, built from main under next/.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  'working-directory'?: string;
}

const workflow = parse(await readFile(join(PROJECT_ROOT, '.github/workflows/deploy.yml'), 'utf8')) as {
  on: { push: { branches: string[]; tags: string[] }; workflow_dispatch: unknown };
  jobs: { build: { steps: Step[] } };
};
const steps = workflow.jobs.build.steps;
const checkouts = steps.filter((s) => s.uses?.startsWith('actions/checkout@'));
const runsIn = (dir: string) => steps.filter((s) => s['working-directory'] === dir).map((s) => s.run);

describe('deploy.yml', () => {
  it('runs on a push to main, a pushed v* tag, and workflow_dispatch', () => {
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on.push.tags).toEqual(['v*']);
    expect('workflow_dispatch' in workflow.on).toBe(true);
  });

  it('checks out main for the preview and the latest v* tag for production, each in its own folder', () => {
    const preview = checkouts.find((s) => s.with?.path === 'preview');
    const production = checkouts.find((s) => s.with?.path === 'production');
    expect(preview?.with?.ref).toBe('main');
    const tagStep = steps.find((s) => s.id === 'tag');
    expect(tagStep?.run).toContain("'v*'");
    expect(tagStep?.run).toContain('--sort=-v:refname');
    expect(production?.with?.ref).toBe('${{ steps.tag.outputs.tag }}');
  });

  it('installs, validates, and builds each checkout with its own Node and lockfile', () => {
    expect(runsIn('production')).toEqual(['npm ci', 'npm run validate', 'npm run build']);
    expect(runsIn('preview')).toEqual(['npm ci', 'npm run validate', 'npm run build:preview']);
    const nodes = steps.filter((s) => s.uses?.startsWith('actions/setup-node@')).map((s) => s.with?.['node-version-file']);
    expect(nodes).toEqual(['production/.nvmrc', 'preview/.nvmrc']);
  });

  it('combines the two builds, the preview under next/, into one Pages artifact', () => {
    const combine = steps.find((s) => s.id === 'combine');
    expect(combine?.run).toContain('production/site/dist/.');
    expect(combine?.run).toContain('preview/site/dist');
    expect(combine?.run).toContain('pages/next');
    const upload = steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact@'));
    expect(upload?.with?.path).toBe('pages');
    expect(steps.indexOf(upload!)).toBeGreaterThan(steps.indexOf(combine!));
  });
});
