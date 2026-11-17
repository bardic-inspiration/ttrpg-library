// The gallery's set actions (docs/site.md#gallery "Selection", docs/export.md#controls): Print and
// Download, built from the configured set-scope exporters. Each runs on the
// selection, or on the whole filtered set when nothing is selected. The
// entries' export bundles are fetched first; if any fails, nothing runs and the
// status message says so.
import { useState } from 'preact/hooks';
import { configuredControls, type Exporter } from '../../exporters/index.ts';
import { loadExportItems } from '../../exporters/io.ts';
import { targetText, type SetTarget } from '../../lib/gallery/selection.ts';
import ExportButtons from '../export/ExportButtons.tsx';

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
  const empty = target.records.length === 0;

  const run = async (exporter: Exporter) => {
    setBusy(true);
    setStatus('');
    try {
      const items = await loadExportItems(base, target.records);
      await exporter.run(items, { scope: 'set', base });
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
    </div>
  );
}
