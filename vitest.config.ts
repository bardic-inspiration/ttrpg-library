/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { LIBRARY_ALIAS, REPO_ROOT } from './lib/library-root.ts';
import { configDefaults } from 'vitest/config';

// getViteConfig lets tests render .astro components with the container API. The original-ruleset
// fixtures' own tests run apart, in `npm run test:originals` (docs/rulesets.md#fixture-rulesets).
export default getViteConfig(
  {
    // Site code reads the library through the alias (docs/site.md#library-root); tests read the repo's.
    resolve: { alias: { [LIBRARY_ALIAS]: REPO_ROOT } },
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'tests/originals/**'],
    },
  },
  { logLevel: 'error' },
);
