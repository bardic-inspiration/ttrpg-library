/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { LIBRARY_ALIAS, REPO_ROOT } from './lib/library-root.ts';

// `npm run test:originals`: the original-ruleset fixtures' own tests (docs/rulesets.md#fixture-rulesets),
// which `npm test` leaves out.
export default getViteConfig(
  {
    // Site code reads the library through the alias (docs/site.md#library-root); tests read the repo's.
    resolve: { alias: { [LIBRARY_ALIAS]: REPO_ROOT } },
    test: {
      include: ['tests/originals/**/*.test.ts'],
    },
  },
  { logLevel: 'error' },
);
