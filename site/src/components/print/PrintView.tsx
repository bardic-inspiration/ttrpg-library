// The print view island (docs/export.md#print) on `/print/`. It loads the entries
// the URL names as print fragments, injects the `@page` footer, and opens the
// print dialog once fonts load. The reader picks the paper there, and the
// layout follows its width (docs/export.md#print-layout). Entries stack onto
// shared pages. A Print button prints again. Any entry that can't be found or
// loaded fails the run with a message and no dialog.
import { useEffect, useRef, useState } from 'preact/hooks';
import registryJson from '../../../../config/types.json' with { type: 'json' };
import type { Registry } from '../../lib/gallery/config.ts';
import { pageRules } from '../../lib/print.ts';
import { fetchFresh } from '../../lib/fetch-fresh.ts';
import { loadPrintRun, type PrintRun } from '../../lib/print-run.ts';
import PrintIcon from '../../icons/Print.tsx';
import './print-view.css';

export interface PrintViewProps {
  /** The site base URL, ending in `/`. */
  base: string;
}

const registry = registryJson as unknown as Registry;
const STYLE_ID = 'print-page-rules';

export default function PrintView({ base }: PrintViewProps) {
  const [run, setRun] = useState<PrintRun | undefined>();
  const printed = useRef(false);

  useEffect(() => {
    loadPrintRun(window.location.search, base, registry, fetchFresh).then(setRun);
  }, [base]);

  const fragments = run?.ok ? run.fragments : [];

  // The page footer, once the entries are in.
  useEffect(() => {
    if (!run?.ok) return;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.append(style);
    }
    style.textContent = pageRules();
  }, [run]);

  // Open the print dialog once, when the entries are in and fonts have loaded.
  useEffect(() => {
    if (!run?.ok || printed.current) return;
    printed.current = true;
    document.fonts.ready.then(() => window.print());
  }, [run]);

  return (
    <div class="print-view">
      <div class="print-view__controls">
        <button type="button" class="print-view__print" disabled={!run?.ok} onClick={() => window.print()}>
          <PrintIcon />
          Print
        </button>
      </div>
      <p class="print-view__status" role="status">
        {run === undefined ? 'Loading entries…' : run.ok ? `${fragments.length} ${fragments.length === 1 ? 'entry' : 'entries'} ready to print.` : run.message}
      </p>
      <div class="print-view__entries">
        {fragments.map((fragment) => (
          <div
            key={fragment.record.url}
            class="print-view__entry"
            dangerouslySetInnerHTML={{ __html: fragment.html }}
          />
        ))}
      </div>
    </div>
  );
}
