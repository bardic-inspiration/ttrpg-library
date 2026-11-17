// The detail page's export controls (docs/site.md#detail-page, docs/export.md#controls): Print
// and Download, built from the configured entry-scope exporters. A page type's
// page has Print only. The controls need JavaScript, so they render only once
// the island hydrates; without it the page shows none. A failed export is
// reported in a polite status message, as is what a format left out, listed below it.
import { useEffect, useState } from 'preact/hooks';
import { configuredControls, type ExportItem, type ExportReport as Report, type Exporter } from '../../exporters/index.ts';
import ExportButtons from '../export/ExportButtons.tsx';
import ExportReport, { reportStatus } from '../export/ExportReport.tsx';
import './export-controls.css';

export interface ExportControlsProps {
  item: ExportItem;
  /** The site base URL, ending in `/`. */
  base: string;
  /** The entry is a page type: Print, and no Download. */
  page?: boolean;
  /** Renders before hydration; for tests. */
  ready?: boolean;
}

export default function ExportControls({ item, base, page = false, ready: initial = false }: ExportControlsProps) {
  const [ready, setReady] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<Report | undefined>();
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const run = async (exporter: Exporter) => {
    setBusy(true);
    setStatus('');
    setReport(undefined);
    try {
      const result = await exporter.run([item], { scope: 'entry', base });
      if (result) {
        setReport(result);
        setStatus(reportStatus(exporter.label, result));
      }
    } catch {
      setStatus(`${exporter.label} failed. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="export-controls">
      <ExportButtons
        controls={configuredControls('entry', { download: !page, type: item.entry.type })}
        run={run}
        disabled={busy}
        menuId={`export-formats-${item.entry.id}`}
      />
      <p class="export-controls__status" role="status">{status}</p>
      {report && <ExportReport report={report} names={new Map([[`${item.entry.type}/${item.entry.id}`, item.entry.name]])} />}
    </div>
  );
}
