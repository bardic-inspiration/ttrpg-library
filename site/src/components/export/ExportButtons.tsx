// Print and Download (docs/export.md#controls): the controls every exporting place shares. Print
// runs the print exporter. Download opens a small menu of the formats that offer
// the place's scope; choosing one closes the menu and runs it. The menu is a
// disclosure: Escape closes it and returns focus to Download, and it closes when
// focus leaves it. The caller runs exporters and reports failures.
import { useRef, useState } from 'preact/hooks';
import type { ExportControlSet, Exporter } from '../../exporters/index.ts';
import DownloadIcon from '../../icons/Download.tsx';
import PrintIcon from '../../icons/Print.tsx';
import './export-buttons.css';

export interface ExportButtonsProps {
  controls: ExportControlSet;
  run: (exporter: Exporter) => void;
  disabled?: boolean;
  /** Visually hidden text after each button's label, naming its target (" 3 selected"). */
  which?: string;
  /** The id of the Download menu, unique on the page. */
  menuId: string;
  /** Starts with the menu open; for tests and the style guide. */
  open?: boolean;
}

export default function ExportButtons({ controls, run, disabled = false, which, menuId, open: initial = false }: ExportButtonsProps) {
  const [open, setOpen] = useState(initial);
  const toggle = useRef<HTMLButtonElement>(null);
  const hidden = which ? <span class="visually-hidden"> {which}</span> : null;
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  };
  const choose = (exporter: Exporter) => {
    close(true);
    run(exporter);
  };

  return (
    <ul class="export-buttons" aria-label="Export">
      {controls.print && (
        <li class="export-buttons__item">
          <button type="button" class="export-buttons__button" disabled={disabled} onClick={() => controls.print && run(controls.print)}>
            <PrintIcon />
            {controls.print.label}
            {hidden}
          </button>
        </li>
      )}
      {controls.downloads.length > 0 && (
        <li
          class="export-buttons__item export-buttons__download"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.stopPropagation();
              close(true);
            }
          }}
          onFocusOut={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || !(event.currentTarget as HTMLElement).contains(next)) setOpen(false);
          }}
        >
          <button
            type="button"
            ref={toggle}
            class="export-buttons__button"
            aria-expanded={open}
            aria-controls={menuId}
            disabled={disabled}
            onClick={() => setOpen(!open)}
          >
            <DownloadIcon />
            Download
            {hidden}
          </button>
          <ul id={menuId} class="export-buttons__menu" aria-label="Formats" hidden={!open || disabled}>
            {controls.downloads.map((exporter) => (
              <li key={exporter.id}>
                <button type="button" class="export-buttons__format" onClick={() => choose(exporter)}>
                  {exporter.label}
                </button>
              </li>
            ))}
          </ul>
        </li>
      )}
    </ul>
  );
}
