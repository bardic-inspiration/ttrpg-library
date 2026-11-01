// The detail page's export controls (SPEC.md §9.4, §10.1): one button per
// configured exporter that offers entry scope. The controls need JavaScript,
// so they render only once the island hydrates; without it the page shows
// none. A failed export is reported in a polite status message.
import { useEffect, useState } from 'preact/hooks';
import { configuredExporters, type ExportItem, type Exporter } from '../../exporters/index.ts';
import DownloadIcon from '../../icons/Download.tsx';
import './export-controls.css';

export interface ExportControlsProps {
  item: ExportItem;
  /** The site base URL, ending in `/`. */
  base: string;
}

export default function ExportControls({ item, base }: ExportControlsProps) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const run = async (exporter: Exporter) => {
    setBusy(exporter.id);
    setStatus('');
    try {
      await exporter.run([item], { scope: 'entry', base });
    } catch {
      setStatus(`${exporter.label} failed. Try again.`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div class="export-controls">
      <ul class="export-controls__list" aria-label="Export">
        {configuredExporters('entry').map((exporter) => (
          <li key={exporter.id}>
            <button type="button" class="export-controls__button" disabled={busy !== undefined} onClick={() => run(exporter)}>
              <DownloadIcon />
              {exporter.label}
            </button>
          </li>
        ))}
      </ul>
      <p class="export-controls__status" role="status">{status}</p>
    </div>
  );
}
