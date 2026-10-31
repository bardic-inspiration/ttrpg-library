// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// SPEC.md §3.1: static output, Preact islands, served from the Pages project path.
export default defineConfig({
  site: 'https://bardic-inspiration.github.io',
  base: '/ttrpg-library/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [preact()],
});
