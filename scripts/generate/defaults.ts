// Generation defaults (docs/generation.md#defaults): config/defaults.json, its checks, and
// how a request takes them.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../validate/schema.ts';
import { PUBLISHER } from '../../rulesets/module.ts';

/** A tag value (docs/content-model.md#tags). */
export type TagValue = string | number | boolean | string[];
export type Tags = Record<string, TagValue>;

/** config/defaults.json (docs/generation.md#defaults). */
export type Defaults = {
  ruleset: string;
  count: number;
  /** A custom entry's `author` and `source` (docs/content-model.md#source-and-author); `source` is optional. */
  author: string;
  source?: string;
  tags: Tags;
  gapFill: { enabled: boolean; count: number };
  validateRetries: number;
};

/** A content request as parsed from an issue or an inline request (docs/generation.md#requests, docs/generation.md#run-order). */
export interface Request {
  type?: string;
  count?: number;
  brief?: string;
  /** From the form's tags field, a `source:` or `author:` line is the entry's field, not a tag. */
  tags?: Tags;
  ruleset?: string;
  author?: string;
  source?: string;
}

/** A request with every defaultable field filled. */
export type ResolvedRequest = Request & { ruleset: string; count: number; author: string; tags: Tags };

const KEYS = ['ruleset', 'count', 'author', 'tags', 'gapFill', 'validateRetries'] as const;
const OPTIONAL = ['source'] as const;
const TAG_KEY = /^[a-z][a-z0-9-]*$/;
/** Envelope fields, never tags (docs/content-model.md#tags). */
const RESERVED_TAGS = ['source', 'author'];

const isWhole = (value: unknown, min: number): value is number => Number.isInteger(value) && (value as number) >= min;

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
    if (![...KEYS, ...OPTIONAL].includes(key as never)) problems.push(`${key}: unknown key`);
  }

  const { ruleset, count, author, source, tags, gapFill, validateRetries } = defaults;
  if ('ruleset' in defaults && (typeof ruleset !== 'string' || !(ruleset in registry))) {
    problems.push(`ruleset: "${String(ruleset)}" is not a ruleset in config/types.json`);
  }
  if ('count' in defaults && !isWhole(count, 1)) problems.push('count: must be a whole number of at least 1');
  if ('author' in defaults && (typeof author !== 'string' || author === '' || author === PUBLISHER)) {
    problems.push(`author: must be a name; "${PUBLISHER}" marks official content, which is never generated as custom (docs/content-model.md#source-and-author)`);
  }
  if ('source' in defaults && (typeof source !== 'string' || source === '')) problems.push('source: must be a non-empty string, or left out');
  if ('validateRetries' in defaults && !isWhole(validateRetries, 0)) {
    problems.push('validateRetries: must be a whole number of at least 0');
  }
  if ('gapFill' in defaults) {
    const gap = gapFill as Record<string, unknown> | null;
    if (typeof gap !== 'object' || gap === null || Array.isArray(gap)) {
      problems.push('gapFill: must be an object with enabled and count');
    } else {
      if (typeof gap.enabled !== 'boolean') problems.push('gapFill.enabled: must be true or false');
      if (!isWhole(gap.count, 1)) problems.push('gapFill.count: must be a whole number of at least 1');
    }
  }
  if ('tags' in defaults) {
    if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
      problems.push('tags: must be a flat map');
    } else {
      for (const [key, value] of Object.entries(tags)) {
        if (!TAG_KEY.test(key)) problems.push(`tags.${key}: keys must match ${TAG_KEY.source} (docs/content-model.md#tags)`);
        if (RESERVED_TAGS.includes(key)) problems.push(`tags.${key}: is an envelope field, not a tag; set the top-level "${key}" (docs/content-model.md#source-and-author)`);
        if (!isTagValue(value)) problems.push(`tags.${key}: must be a string, number, boolean, or array of strings (docs/content-model.md#tags)`);
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
 * Fills the fields a request leaves out from the defaults and merges request
 * tags over default tags. A `source` or `author` among the request's tags is
 * lifted out as the field. A request's count is taken as given: no batch has a
 * size limit (docs/generation.md#defaults).
 */
export function applyDefaults(request: Request, defaults: Defaults): ResolvedRequest {
  const { source: tagSource, author: tagAuthor, ...tags } = request.tags ?? {};
  const text = (value: TagValue | undefined) => (value === undefined ? undefined : Array.isArray(value) ? value.join(', ') : String(value));
  const source = request.source ?? text(tagSource) ?? defaults.source;
  return {
    ...request,
    ruleset: request.ruleset ?? defaults.ruleset,
    count: request.count ?? defaults.count,
    author: request.author ?? text(tagAuthor) ?? defaults.author,
    ...(source === undefined ? {} : { source }),
    tags: { ...defaults.tags, ...tags },
  };
}
