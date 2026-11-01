// Generation defaults (SPEC.md §8.3): config/defaults.json, its checks, and
// how a request takes them.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../validate/schema.ts';

/** A tag value (§5.3). */
export type TagValue = string | number | boolean | string[];
export type Tags = Record<string, TagValue>;

/** config/defaults.json (§8.3). */
export type Defaults = {
  ruleset: string;
  count: number;
  maxBatch: number;
  tags: Tags;
  gapFill: { enabled: boolean; count: number };
  validateRetries: number;
};

/** A content request as parsed from an issue or an inline request (§8.1, §8.2). */
export interface Request {
  type?: string;
  count?: number;
  brief?: string;
  tags?: Tags;
  ruleset?: string;
}

/** A request with every defaultable field filled. */
export type ResolvedRequest = Request & { ruleset: string; count: number; tags: Tags };

const KEYS = ['ruleset', 'count', 'maxBatch', 'tags', 'gapFill', 'validateRetries'] as const;
const TAG_KEY = /^[a-z][a-z0-9-]*$/;

const isWhole = (value: unknown, min: number, max = Infinity): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const isTagValue = (value: unknown): value is TagValue =>
  ['string', 'number', 'boolean'].includes(typeof value) ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'));

/**
 * Problems with a defaults object, one message per problem; empty when it is
 * valid. `registry` is config/types.json, which names the known rulesets.
 */
export function checkDefaults(defaults: Record<string, unknown>, registry: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const key of KEYS) if (!(key in defaults)) problems.push(`${key}: missing`);
  for (const key of Object.keys(defaults)) {
    if (!(KEYS as readonly string[]).includes(key)) problems.push(`${key}: unknown key`);
  }

  const { ruleset, count, maxBatch, tags, gapFill, validateRetries } = defaults;
  if ('ruleset' in defaults && (typeof ruleset !== 'string' || !(ruleset in registry))) {
    problems.push(`ruleset: "${String(ruleset)}" is not a ruleset in config/types.json`);
  }
  const batch = isWhole(maxBatch, 1) ? maxBatch : undefined;
  if ('maxBatch' in defaults && batch === undefined) problems.push('maxBatch: must be a whole number of at least 1');
  if ('count' in defaults && !isWhole(count, 1, batch)) problems.push('count: must be a whole number from 1 to maxBatch');
  if ('validateRetries' in defaults && !isWhole(validateRetries, 0)) {
    problems.push('validateRetries: must be a whole number of at least 0');
  }
  if ('gapFill' in defaults) {
    const gap = gapFill as Record<string, unknown> | null;
    if (typeof gap !== 'object' || gap === null || Array.isArray(gap)) {
      problems.push('gapFill: must be an object with enabled and count');
    } else {
      if (typeof gap.enabled !== 'boolean') problems.push('gapFill.enabled: must be true or false');
      if (!isWhole(gap.count, 1, batch)) problems.push('gapFill.count: must be a whole number from 1 to maxBatch');
    }
  }
  if ('tags' in defaults) {
    if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
      problems.push('tags: must be a flat map');
    } else {
      for (const [key, value] of Object.entries(tags)) {
        if (!TAG_KEY.test(key)) problems.push(`tags.${key}: keys must match ${TAG_KEY.source} (§5.3)`);
        if (!isTagValue(value)) problems.push(`tags.${key}: must be a string, number, boolean, or array of strings (§5.3)`);
      }
    }
  }
  return problems;
}

/** Reads and checks config/defaults.json; throws listing every problem. */
export async function loadDefaults(root = PROJECT_ROOT): Promise<Defaults> {
  const defaults = JSON.parse(await readFile(join(root, 'config/defaults.json'), 'utf8')) as Record<string, unknown>;
  const registry = JSON.parse(await readFile(join(root, 'config/types.json'), 'utf8')) as Record<string, unknown>;
  const problems = checkDefaults(defaults, registry);
  if (problems.length > 0) throw new Error(`config/defaults.json:\n  ${problems.join('\n  ')}`);
  return defaults as unknown as Defaults;
}

/**
 * Fills the fields a request leaves out from the defaults, merges request tags
 * over default tags, and reduces a count above `maxBatch` to `maxBatch` (§8.3).
 */
export function applyDefaults(request: Request, defaults: Defaults): ResolvedRequest {
  return {
    ...request,
    ruleset: request.ruleset ?? defaults.ruleset,
    count: Math.min(request.count ?? defaults.count, defaults.maxBatch),
    tags: { ...defaults.tags, ...request.tags },
  };
}
