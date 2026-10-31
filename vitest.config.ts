/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig lets tests render .astro components with the container API.
export default getViteConfig(
  {
    test: {
      include: ['tests/**/*.test.ts'],
    },
  },
  { logLevel: 'error' },
);
