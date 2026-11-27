// One gallery card (docs/site.md#gallery "Cards"): art when the entry has it, or a map's diagram as a thumbnail,
// name with a star slot, the type badge, the type's card fields, the summary (a primitive has none), and
// the source on a smaller line below it, with the cart control. The whole card opens its entry, through the shared card link,
// and the cart control sits above that link (docs/styling.md#shared-components "Click targets"). Accents come from data-type (and data-rarity),
// never per-type CSS.
import { isOfficial } from '../../../../rulesets/module.ts';
import type { FilterDef, LibraryRecord } from '../../lib/gallery/config.ts';
import { displayValue, valueAt } from '../../lib/gallery/values.ts';
import StarIcon from '../../icons/Star.tsx';
import CardLink, { linkedCard } from '../shared/CardLink.tsx';
import CartToggle from '../cart/CartToggle.tsx';

export interface CardProps {
  record: LibraryRecord;
  typeLabel: string;
  cardFields: FilterDef[];
  /** The art's URL under the site base, when the entry has art. */
  imageSrc?: string;
  /** Whether the entry is in the print cart. */
  inCart: boolean;
  onCart?: (inCart: boolean) => void;
}

interface Badge {
  text: string;
  rarity?: string;
}

/**
 * Splits card fields into lines and badges. Boolean fields read as badges when
 * true (concentration, ritual, attunement) and are left out when false. A
 * rarity reads as a badge carrying data-rarity, so it takes the rarity accent;
 * its text label means color is never the only signal (docs/styling.md#accessibility).
 * A chip field (docs/content-model.md#display) reads as its label and value, a badge per value.
 */
function fields(record: LibraryRecord, cardFields: FilterDef[]) {
  const lines: { label: string; value: string }[] = [];
  const badges: Badge[] = [];
  for (const def of cardFields) {
    const value = valueAt(record, def.path);
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) badges.push({ text: def.label });
    } else if (def.vocabulary === 'rarity' && typeof value === 'string') {
      badges.push({ text: displayValue(def, value), rarity: value });
    } else if (def.display === 'chip') {
      for (const v of Array.isArray(value) ? value : [value]) badges.push({ text: `${def.label}: ${displayValue(def, v)}` });
    } else {
      const text = Array.isArray(value) ? value.map((v) => displayValue(def, v)).join(', ') : displayValue(def, value);
      lines.push({ label: def.label, value: text });
    }
  }
  return { lines, badges };
}

export default function Card({ record, typeLabel, cardFields, imageSrc, inCart, onCart }: CardProps) {
  const { lines, badges } = fields(record, cardFields);
  const id = `card-${record.type}-${record.id}`;
  return (
    <article class={`card ${linkedCard}`} data-type={record.type} aria-labelledby={`${id}-name`}>
      {imageSrc && <img class="card__art" src={imageSrc} alt={record.name} loading="lazy" />}
      {/* The build checked and rewrote the diagram (lib/diagram.ts), so it holds only shapes and text. */}
      {!imageSrc && record.diagram && <div class="card__thumbnail" dangerouslySetInnerHTML={{ __html: record.diagram }} />}
      <div class="card__body">
        {/* The star's slot is on every card, so the name wraps the same with or without it. */}
        <div class="card__head">
          <h2 class="card__name" id={`${id}-name`}>
            <CardLink href={record.url}>{record.name}</CardLink>
          </h2>
          <span class="card__official">
            {isOfficial(record) && (
              <span role="img" aria-label="Official" title="Official">
                <StarIcon />
              </span>
            )}
          </span>
        </div>
        <ul class="card__badges">
          <li class="badge">{typeLabel}</li>
          {badges.map((badge, i) => (
            <li class="badge" key={i} data-rarity={badge.rarity}>
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
        {record.summary && <p class="card__summary">{record.summary}</p>}
        {record.source && <p class="card__source">{record.source}</p>}
        <CartToggle id={`${id}-cart`} name={record.name} inCart={inCart} onChange={onCart} />
      </div>
    </article>
  );
}
