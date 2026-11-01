// JSON export (SPEC.md §10.2). Entry scope downloads the entry's raw file
// unchanged as `<id>.json`: the native format, inputs only, no derived values.
// Set scope fetches each raw file and downloads one array as
// `library-<YYYYMMDD>.json`, dated by the reader's local clock.
import { rawFileUrl, resolveIO } from './io.ts';
import type { ExportIO, ExportItem, Exporter } from './types.ts';

async function rawFile(io: ExportIO, base: string, item: ExportItem): Promise<string> {
  const url = rawFileUrl(base, item.entry);
  const response = await io.fetch(url);
  if (!response.ok) throw new Error(`Fetching ${url} failed with status ${response.status}`);
  return response.text();
}

/** `YYYYMMDD` in local time. */
export function dateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export const json: Exporter = {
  id: 'json',
  label: 'Download JSON',
  scopes: ['entry', 'set'],
  async run(items, options) {
    const io = resolveIO(options);
    if (options.scope === 'entry') {
      const item = items[0];
      if (!item || items.length !== 1) throw new Error('Entry export takes exactly one entry');
      io.download({ name: `${item.entry.id}.json`, type: 'application/json', data: await rawFile(io, options.base, item) });
      return;
    }
    const texts = await Promise.all(items.map((item) => rawFile(io, options.base, item)));
    const array = texts.map((text) => JSON.parse(text) as unknown);
    io.download({
      name: `library-${dateStamp(io.now())}.json`,
      type: 'application/json',
      data: `${JSON.stringify(array, null, 2)}\n`,
    });
  },
};
