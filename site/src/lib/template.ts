// What every type template shares (docs/site.md#templates): the props it takes, its
// render modes, and which component the registry's `template` name selects.

import type { Entry } from './library.ts';

/** `screen` for gallery detail, `capture` for PNG, `print` for the print view. */
export type TemplateMode = 'screen' | 'capture' | 'print';

/** A labeled stat-block line. */
export interface PropertyLine {
  label: string;
  value: string;
  /** `value` is markdown (it carries a `Text` field), rendered inline. */
  markdown?: boolean;
}

/** Props every type template takes. Templates format these; they never compute rules values. */
export interface TemplateProps {
  entry: Entry;
  /** The ruleset module's derived values for `entry` (docs/rulesets.md#inputs-and-derived-values). */
  derived: Record<string, unknown>;
  /** `<type>/<id>` → entry name, for rendering refs as names. */
  names: Map<string, string>;
  mode?: TemplateMode;
  /** Heading level of the entry name; section headings sit one below it. Default 2. */
  level?: number;
}

/** Template names (`config/types.json` `template`) that have their own component; others use `generic`. */
export const TEMPLATES = ['creature-stat-block', 'item-card', 'spell-card'] as const;

export type TemplateName = (typeof TEMPLATES)[number] | 'generic';

/** The component name for a registry `template`, falling back to `generic`. */
export const templateFor = (name: string | undefined): TemplateName =>
  (TEMPLATES as readonly string[]).includes(name ?? '') ? (name as TemplateName) : 'generic';
