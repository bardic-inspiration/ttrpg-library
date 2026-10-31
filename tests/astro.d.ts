// Lets tsc type .astro imports in tests, which render components with the
// container API (vitest.config.ts). `astro check` types them in the site.
declare module '*.astro' {
  const Component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Component;
}
