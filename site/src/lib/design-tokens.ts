// Reads the design-token files (SPEC.md §9.6) so the contrast tests (§9.7)
// and the style guide (§9.8) see exactly what the browser sees. Each custom
// property is classified by the theme block it sits in, and var() references
// resolve through the primitives to a literal value.

import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

/**
 * Where a declaration applies:
 * - `base`: plain `:root` (shared by both themes; for theme-colored tokens, the light default)
 * - `light` / `dark`: a `[data-theme='…']` block
 * - `system-dark`: the `prefers-color-scheme: dark` block
 * - `reduced-motion`: the `prefers-reduced-motion: reduce` block
 * - `other`: anything else (attribute mappings, page sizes)
 */
export type TokenScope = 'base' | 'light' | 'dark' | 'system-dark' | 'reduced-motion' | 'other';
export type Theme = 'light' | 'dark';

export interface TokenDecl {
  name: string;
  value: string;
  scope: TokenScope;
}

function scopeOf(decl: Declaration): TokenScope {
  const rule = decl.parent as Rule;
  const media: string[] = [];
  for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type === 'atrule' && (node as AtRule).name === 'media') media.push((node as AtRule).params);
  }
  const selector = rule.selector.replace(/"/g, "'");
  if (media.some((m) => m.includes('prefers-color-scheme: dark'))) return 'system-dark';
  if (media.some((m) => m.includes('prefers-reduced-motion: reduce'))) return 'reduced-motion';
  if (selector.includes("[data-theme='dark']")) return 'dark';
  if (selector.includes("[data-theme='light']")) return 'light';
  if (rule.selectors.includes(':root')) return 'base';
  return 'other';
}

/** Every custom property declared in a CSS file, in source order. */
export function readTokens(css: string): TokenDecl[] {
  const decls: TokenDecl[] = [];
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    decls.push({ name: decl.prop, value: decl.value.trim(), scope: scopeOf(decl) });
  });
  return decls;
}

/** The tokens in one scope, as a name → value map (later declarations win). */
export function tokensIn(decls: TokenDecl[], scope: TokenScope): Map<string, string> {
  return new Map(decls.filter((d) => d.scope === scope).map((d) => [d.name, d.value]));
}

/** What every token resolves to in a theme: the base values, overlaid with the theme block. */
export function themeTokens(decls: TokenDecl[], theme: Theme): Map<string, string> {
  return new Map([...tokensIn(decls, 'base'), ...tokensIn(decls, theme)]);
}

/** Follows var(--x) references until a literal value. Throws on a missing or circular token. */
export function resolveToken(tokens: Map<string, string>, name: string, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`Circular token: ${[...seen, name].join(' → ')}`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Unknown token: ${name}`);
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, ref: string) => resolveToken(tokens, ref, [...seen, name]));
}
