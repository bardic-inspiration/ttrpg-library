// One gallery card (SPEC.md §9.3 "Card grid"): art or the placeholder, name,
// type badge, the type's card fields, and the summary, with a selection
// checkbox. Accents come from data-type (and data-rarity), never per-type CSS.
import type { FilterDef, LibraryRecord } from '../../lib/gallery/config.ts';
import { displayValue, valueAt } from '../../lib/gallery/values.ts';
import ArtPlaceholder from './ArtPlaceholder.tsx';

export interface CardProps {
  record: LibraryRecord;
  typeLabel: string;
  cardFields: FilterDef[];
  /** The art's URL under the site base, when the entry has art. */
  imageSrc?: string;
  selected: boolean;
  onSelect?: (selected: boolean) => void;
}

interface Badge {
  text: string;
  rarity?: string;
}

/**
 * Splits card fields into lines and badges. Boolean fields read as badges when
 * true (concentration, ritual, attunement) and are left out when false. A
 * rarity reads as a badge carrying data-rarity, so it takes the rarity accent;
 * its text label means color is never the only signal (§9.7).
 */
function fields(record: LibraryRecord, cardFields: FilterDef[]) {
  const lines: { label: string; value: string }[] = [];
  const badges: Badge[] = [];
  for (const def of cardFields) {
    const value = valueAt(record, def.path);
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) badges.push({ text: def.label });
    } else if (def.format === 'rarity' && typeof value === 'string') {
      badges.push({ text: displayValue(def, value), rarity: value });
    } else {
      const text = Array.isArray(value) ? value.map((v) => displayValue(def, v)).join(', ') : displayValue(def, value);
      lines.push({ label: def.label, value: text });
    }
  }
  return { lines, badges };
}

export default function Card({ record, typeLabel, cardFields, imageSrc, selected, onSelect }: CardProps) {
  const { lines, badges } = fields(record, cardFields);
  const id = `card-${record.type}-${record.id}`;
  return (
    <article class="card" data-type={record.type} aria-labelledby={`${id}-name`}>
      {imageSrc ? (
        <img class="card__art" src={imageSrc} alt={record.name} loading="lazy" />
      ) : (
        <ArtPlaceholder typeLabel={typeLabel} />
      )}
      <div class="card__body">
        <h2 class="card__name" id={`${id}-name`}>
          <a href={record.url}>{record.name}</a>
        </h2>
        <ul class="card__badges">
          <li class="badge">{typeLabel}</li>
          {badges.map((badge) => (
            <li class="badge" key={badge.text} data-rarity={badge.rarity}>
              {badge.text}
            </li>
          ))}
        </ul>
        {lines.length > 0 && (
          <dl class="card__fields">
            {lines.map(({ label, value }) => (
              <div class="card__field" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p class="card__summary">{record.summary}</p>
        <label class="card__select">
          <input
            type="checkbox"
            checked={selected}
            disabled={!onSelect}
            onChange={(event) => onSelect?.((event.currentTarget as HTMLInputElement).checked)}
          />
          <span>
            Select<span class="visually-hidden"> {record.name}</span>
          </span>
        </label>
      </div>
    </article>
  );
}
