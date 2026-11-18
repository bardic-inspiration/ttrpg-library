// The gallery's set actions (docs/site.md#gallery "Selection", docs/export.md#controls): Print and
// Download, built from the configured set-scope exporters. Each runs on the
// selection, or on the whole filtered set when nothing is selected. Unless the
// exporter reads only the entries' keys, their export bundles are fetched first;
// if any fails, nothing runs and the status message says so. What a format left
// out is listed below the status.
import { useState } from 'preact/hooks';
import { configuredControls, type ExportReport as Report, type Exporter } from '../../exporters/index.ts';
import { runSetExport } from '../../exporters/io.ts';
import { targetText, type SetTarget } from '../../lib/gallery/selection.ts';
import ExportButtons from '../export/ExportButtons.tsx';
import ExportReport, { reportStatus } from '../export/ExportReport.tsx';

export interface SetActionsProps {
  target: SetTarget;
  /** The site base URL, ending in `/`. */
  base: string;
  /** Starts with the Download menu open; for tests. */
  open?: boolean;
}

export default function SetActions({ target, base, open }: SetActionsProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<Report | undefined>();
  const empty = target.records.length === 0;

  const run = async (exporter: Exporter) => {
    setBusy(true);
    setStatus('');
    setReport(undefined);
    try {
      const result = await runSetExport(exporter, target.records, { scope: 'set', base });
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
    <div class="set-actions">
      <ExportButtons
        controls={configuredControls('set')}
        run={run}
        disabled={empty || busy}
        which={targetText(target)}
        menuId="set-actions-formats"
        open={open}
      />
      <p class="set-actions__status" role="status">
        {status}
      </p>
      {report && <ExportReport report={report} names={new Map(target.records.map((r) => [`${r.type}/${r.id}`, r.name]))} />}
    </div>
  );
}
