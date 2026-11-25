// Print and Download (docs/export.md#controls): the controls every exporting place shares. Print
// runs the print exporter, as the place's primary button. Download is the shared menu button
// (docs/styling.md#shared-components "Buttons"), opening a small menu of the formats that offer
// the place's scope; choosing one closes the menu and runs it. The caller runs exporters and
// reports failures.
import type { ExportControlSet, Exporter } from '../../exporters/index.ts';
import DownloadIcon from '../../icons/Download.tsx';
import PrintIcon from '../../icons/Print.tsx';
import Button, { MenuButton } from '../shared/Button.tsx';
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

export default function ExportButtons({ controls, run, disabled = false, which, menuId, open }: ExportButtonsProps) {
  const hidden = which ? <span class="visually-hidden"> {which}</span> : null;
  return (
    <ul class="export-buttons" aria-label="Export">
      {controls.print && (
        <li class="export-buttons__item">
          <Button variant="primary" disabled={disabled} onClick={() => controls.print && run(controls.print)}>
            <PrintIcon />
            {controls.print.label}
            {hidden}
          </Button>
        </li>
      )}
      {controls.downloads.length > 0 && (
        <li class="export-buttons__item">
          <MenuButton
            id={menuId}
            menuLabel="Formats"
            disabled={disabled}
            open={open}
            items={controls.downloads.map((exporter) => ({ key: exporter.id, label: exporter.label, onSelect: () => run(exporter) }))}
          >
            <DownloadIcon />
            Download
            {hidden}
          </MenuButton>
        </li>
      )}
    </ul>
  );
}
