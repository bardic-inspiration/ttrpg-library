/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// `npm run test:originals`: the original-ruleset fixtures' own tests (docs/rulesets.md#fixture-rulesets),
// which `npm test` leaves out.
export default getViteConfig(
  {
    test: {
      include: ['tests/originals/**/*.test.ts'],
    },
  },
  { logLevel: 'error' },
);
