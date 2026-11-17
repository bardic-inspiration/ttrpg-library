// Open5e export (docs/export.md#open5e): the Open5e translator's export side as a Download
// format, for the types it covers. Entry scope downloads `<id>.open5e.json`, set scope
// `library-<YYYYMMDD>.open5e.json`; both resolve with the translator's skip report, which the
// site shows after the download. When nothing in the scope exports, nothing downloads. The
// translator loads only when a download runs.
import { OPEN5E } from '../translators/open5e/meta.ts';
import type { TranslatorItem } from '../translators/types.ts';
import { resolveIO } from './io.ts';
import { dateStamp } from './json.ts';
import type { Exporter } from './types.ts';

export const open5e: Exporter = {
  id: 'open5e',
  kind: 'download',
  label: OPEN5E.label,
  scopes: ['entry', 'set'],
  types: [...OPEN5E.types],
  async run(items, options) {
    const io = resolveIO(options);
    const { open5e: translator } = await import('../translators/open5e/index.ts');
    const result = translator.export(items.map((item) => ({ ...item, names: item.names ?? {} }) as TranslatorItem));
    if (result.exported.length > 0) {
      const stem = options.scope === 'entry' ? items[0]!.entry.id : `library-${dateStamp(io.now())}`;
      io.download({ name: `${stem}.${translator.extension}`, type: 'application/json', data: result.data });
    }
    return { downloaded: result.exported.length > 0, skipped: result.skipped };
  },
};
