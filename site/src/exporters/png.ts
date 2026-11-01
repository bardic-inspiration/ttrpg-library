// PNG export (SPEC.md §10.3, §10.5). Captures the detail page's capture
// source (the type template in `capture` mode, with the light tokens) at a
// fixed CSS width from config/export.json and the configured scale, and
// downloads it as `<id>.png`. Entry scope only.
import config from '../../../config/export.json' with { type: 'json' };
import type { Entry } from '../lib/library.ts';
import { resolveIO } from './io.ts';
import type { Exporter } from './types.ts';

export interface PngSettings {
  scale: number;
  width: number;
  wideWidth: number;
}

/** A creature with legendary actions or more than six actions captures at the wide width. */
export function isWide(entry: Entry): boolean {
  if (entry.type !== 'creature') return false;
  const stats = (entry.stats ?? {}) as { actions?: unknown[]; legendaryActions?: unknown };
  return stats.legendaryActions != null || (stats.actions?.length ?? 0) > 6;
}

/** The CSS width, in pixels, an entry is captured at. */
export const captureWidth = (entry: Entry, settings: PngSettings = config.png): number =>
  isWide(entry) ? settings.wideWidth : settings.width;

export const png: Exporter = {
  id: 'png',
  label: 'Download PNG',
  scopes: ['entry'],
  async run(items, options) {
    if (options.scope !== 'entry') throw new Error('PNG export offers entry scope only');
    const item = items[0];
    if (!item || items.length !== 1) throw new Error('Entry export takes exactly one entry');
    const io = resolveIO(options);
    const { entry } = item;
    const data = await io.capture({ id: entry.id, width: captureWidth(entry), scale: config.png.scale });
    io.download({ name: `${entry.id}.png`, type: 'image/png', data });
  },
};
