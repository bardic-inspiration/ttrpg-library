// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { SITE_BASE } from '../lib/site.ts';
import { LIBRARY_ALIAS, REPO_ROOT, libraryRoot, siteDirs } from '../lib/library-root.ts';

// docs/site.md#library-root: the library the site reads, and its own public and dist folders.
const root = libraryRoot();
const { publicDir, outDir } = siteDirs(root);

// docs/architecture.md#technology: static output, Preact islands, served from the site base
// (docs/workflow.md#deploy).
export default defineConfig({
  site: 'https://bardic-inspiration.github.io',
  base: SITE_BASE,
  output: 'static',
  trailingSlash: 'always',
  publicDir,
  outDir,
  vite: {
    resolve: { alias: { [LIBRARY_ALIAS]: root } },
    // lib/site.ts reads the base from the environment; browser bundles get this build's value.
    define: { 'process.env.SITE_BASE': JSON.stringify(SITE_BASE) },
  },
  integrations: [
    preact(),
    // The style guide renders the repo's example fixtures (docs/styling.md#refinement-workflow), so
    // only the repo's own library has it.
    {
      name: 'styleguide',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          if (root === REPO_ROOT) injectRoute({ pattern: '/styleguide', entrypoint: './src/styleguide/StyleGuide.astro' });
        },
      },
    },
  ],
});
