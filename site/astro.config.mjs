// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { SITE_BASE } from '../lib/site.ts';

// SPEC.md §3.1: static output, Preact islands, served from the Pages project path.
export default defineConfig({
  site: 'https://bardic-inspiration.github.io',
  base: SITE_BASE,
  output: 'static',
  trailingSlash: 'always',
  integrations: [preact()],
});
