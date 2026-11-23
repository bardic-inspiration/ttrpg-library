/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

// getViteConfig lets tests render .astro components with the container API. The original-ruleset
// fixtures' own tests run apart, in `npm run test:originals` (docs/rulesets.md#fixture-rulesets).
export default getViteConfig(
  {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'tests/originals/**'],
    },
  },
  { logLevel: 'error' },
);
