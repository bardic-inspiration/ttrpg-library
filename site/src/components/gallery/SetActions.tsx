// The gallery's set actions (SPEC.md §9.3 "Selection", §10.1): one button per
// configured exporter that offers set scope, with a page size selector beside
// any exporter that takes one (Print). Each runs on the selection, or on the
// whole filtered set when nothing is selected. The entries' export bundles are
// fetched first; if any fails, nothing runs and the status message says so.
import { useState } from 'preact/hooks';
import { configuredExporters, type Exporter } from '../../exporters/index.ts';
import { loadExportItems } from '../../exporters/io.ts';
import DownloadIcon from '../../icons/Download.tsx';
import PrintIcon from '../../icons/Print.tsx';
import { targetText, type SetTarget } from '../../lib/gallery/selection.ts';
import { pageSizes, resolveSize } from '../../lib/print.ts';

export interface SetActionsProps {
  target: SetTarget;
  /** The site base URL, ending in `/`. */
  base: string;
}

export default function SetActions({ target, base }: SetActionsProps) {
  const [busy, setBusy] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(() => resolveSize(undefined).id);
  const empty = target.records.length === 0;
  const which = targetText(target);

  const run = async (exporter: Exporter) => {
    setBusy(exporter.id);
    setStatus('');
    try {
      const items = await loadExportItems(base, target.records);
      await exporter.run(items, { scope: 'set', base, ...(exporter.pageSize && { pageSize }) });
    } catch {
      setStatus(`${exporter.label} failed. Try again.`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div class="set-actions">
      <ul class="set-actions__list" aria-label="Export">
        {configuredExporters('set').map((exporter) => (
          <li key={exporter.id} class="set-actions__item">
            <button
              type="button"
              class="set-actions__button"
              disabled={empty || busy !== undefined}
              onClick={() => run(exporter)}
            >
              {exporter.pageSize ? <PrintIcon /> : <DownloadIcon />}
              {exporter.label}
              <span class="visually-hidden"> {which}</span>
            </button>
            {exporter.pageSize && (
              <label class="set-actions__size">
                <span class="visually-hidden">Page size for {exporter.label}</span>
                <select value={pageSize} onChange={(event) => setPageSize((event.target as HTMLSelectElement).value)}>
                  {pageSizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>
      <p class="set-actions__status" role="status">
        {status}
      </p>
    </div>
  );
}
