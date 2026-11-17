// Reads the design-token files (docs/styling.md#tokens) so the contrast tests (docs/styling.md#accessibility)
// and the style guide (docs/styling.md#refinement-workflow) see exactly what the browser sees. Each custom
// property is classified by the block it sits in, and var() references
// resolve through the primitives to a literal value.

import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

/**
 * Where a declaration applies:
 * - `base`: plain `:root`, the site's one palette and its roles
 * - `reduced-motion`: the `prefers-reduced-motion: reduce` block
 * - `other`: anything else (attribute mappings, page sizes)
 */
export type TokenScope = 'base' | 'reduced-motion' | 'other';

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
  if (media.some((m) => m.includes('prefers-reduced-motion: reduce'))) return 'reduced-motion';
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

/** Follows var(--x) references until a literal value. Throws on a missing or circular token. */
export function resolveToken(tokens: Map<string, string>, name: string, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`Circular token: ${[...seen, name].join(' → ')}`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Unknown token: ${name}`);
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, ref: string) => resolveToken(tokens, ref, [...seen, name]));
}
