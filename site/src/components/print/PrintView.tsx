// The print view island (SPEC.md §10.4) on `/print/`. It loads the entries
// the URL names as print fragments, injects the `@page` rules for the chosen
// size, and opens the print dialog once fonts load. A page-size selector and
// a "continuous" toggle let the reader adjust and print again. Any entry that
// can't be found or loaded fails the run with a message and no dialog.
import { useEffect, useRef, useState } from 'preact/hooks';
import registryJson from '../../../../config/types.json' with { type: 'json' };
import type { Registry } from '../../lib/gallery/config.ts';
import { pageName, pageRules, pageSizes, resolveSize } from '../../lib/print.ts';
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
  const [size, setSize] = useState(() => resolveSize(undefined));
  const [continuous, setContinuous] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    loadPrintRun(window.location.search, base, registry, (url) => fetch(url)).then((loaded) => {
      setSize(loaded.size);
      setRun(loaded);
    });
  }, [base]);

  const fragments = run?.ok ? run.fragments : [];

  // Page rules and density follow the size and the continuous toggle.
  useEffect(() => {
    if (!run?.ok) return;
    document.documentElement.dataset.pageSize = size.id;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.append(style);
    }
    style.textContent = pageRules(size, fragments.map((f) => f.record.name), continuous);
  }, [run, size, continuous]);

  // Open the print dialog once, when the entries are in and fonts have loaded.
  useEffect(() => {
    if (!run?.ok || printed.current) return;
    printed.current = true;
    document.fonts.ready.then(() => window.print());
  }, [run]);

  const chooseSize = (id: string) => {
    const next = resolveSize(id);
    setSize(next);
    const params = new URLSearchParams(window.location.search);
    params.set('size', next.id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  };

  return (
    <div class="print-view">
      <div class="print-view__controls">
        <label class="print-view__field">
          <span>Page size</span>
          <select value={size.id} onChange={(event) => chooseSize((event.target as HTMLSelectElement).value)}>
            {pageSizes.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label class="print-view__field">
          <input type="checkbox" checked={continuous} onChange={(event) => setContinuous((event.target as HTMLInputElement).checked)} />
          <span>Continuous (pack entries together)</span>
        </label>
        <button type="button" class="print-view__print" disabled={!run?.ok} onClick={() => window.print()}>
          <PrintIcon />
          Print
        </button>
      </div>
      <p class="print-view__status" role="status">
        {run === undefined ? 'Loading entries…' : run.ok ? `${fragments.length} ${fragments.length === 1 ? 'entry' : 'entries'} ready to print.` : run.message}
      </p>
      <div class="print-view__entries" data-continuous={continuous ? '' : undefined}>
        {fragments.map((fragment, i) => (
          <div
            key={fragment.record.id}
            class="print-view__entry"
            style={continuous ? undefined : { page: pageName(i) }}
            dangerouslySetInnerHTML={{ __html: fragment.html }}
          />
        ))}
      </div>
    </div>
  );
}
