// The set export (docs/site.md#page-header, docs/export.md#controls): Print and Download, built
// from the configured set-scope exporters, in the page header. Each runs on the cart, or, on the
// Library, on the whole filtered set when the cart is empty. Where the target holds only cart
// keys, `resolve` turns them into the library's entries first. Unless the exporter reads only the
// entries' keys, their export bundles are fetched first; if any fails, nothing runs and the status
// message says so. What a format left out is listed below the status.
import { useState } from 'preact/hooks';
import { configuredControls, type ExportReport as Report, type Exporter } from '../../exporters/index.ts';
import { runSetExport } from '../../exporters/io.ts';
import { targetText, type SetTarget, type TargetEntry } from '../../lib/gallery/selection.ts';
import ExportButtons from './ExportButtons.tsx';
import ExportReport, { reportStatus } from './ExportReport.tsx';

export interface SetActionsProps {
  target: SetTarget;
  /** The site base URL, ending in `/`. */
  base: string;
  /** Turns the target's entries into the library's, with their names, before an action runs. */
  resolve?: (records: TargetEntry[]) => Promise<TargetEntry[]>;
  /** Starts with the Download menu open; for tests. */
  open?: boolean;
}

export default function SetActions({ target, base, resolve, open }: SetActionsProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<Report | undefined>();
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const empty = target.records.length === 0;

  const run = async (exporter: Exporter) => {
    setBusy(true);
    setStatus('');
    setReport(undefined);
    try {
      const records = resolve ? await resolve(target.records) : target.records;
      if (records.length === 0) return;
      setNames(new Map(records.flatMap((r) => (r.name === undefined ? [] : [[`${r.type}/${r.id}`, r.name] as const]))));
      const result = await runSetExport(exporter, records, { scope: 'set', base });
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
      {report && <ExportReport report={report} names={names} />}
    </div>
  );
}
