// What a download left out (docs/export.md#controls): after a format that can't carry everything,
// such as Open5e, a disclosure lists each skipped field or link by entry. The status line above
// it, in the caller's polite status region, says how many.
import type { ExportReport as Report } from '../../exporters/index.ts';
import './export-report.css';

export interface ExportReportProps {
  report: Report;
  /** `<type>/<id>` → entry name, for the entries in the scope. */
  names: Map<string, string>;
}

/** The status line for a report: how many things didn't carry over, or that nothing downloaded. */
export function reportStatus(label: string, report: Report): string {
  const n = report.skipped.length;
  if (!report.downloaded) return `Nothing here exports as ${label}.`;
  if (n === 0) return '';
  return `Downloaded ${label}. ${n} ${n === 1 ? 'thing' : 'things'} didn't carry over.`;
}

export default function ExportReport({ report, names }: ExportReportProps) {
  if (report.skipped.length === 0) return null;
  const byEntry = new Map<string, Report['skipped']>();
  for (const skip of report.skipped) byEntry.set(skip.entry, [...(byEntry.get(skip.entry) ?? []), skip]);
  return (
    <details class="export-report">
      <summary>What didn't carry over</summary>
      <ul class="export-report__entries">
        {[...byEntry].map(([entry, skips]) => (
          <li key={entry}>
            <span class="export-report__entry">{names.get(entry) ?? entry}</span>
            <ul class="export-report__skips">
              {skips.map((skip, i) => (
                <li key={i}>
                  {skip.path && <code>{skip.path}</code>} {skip.reason}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}
