// Filter controls (SPEC.md §9.3 "Filters", §9.7): enum facets and tags as
// multi-select chips with counts, range facets as min and max inputs, each
// group a fieldset with a legend, and "Add filter" for everything else.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FilterDef } from '../../lib/gallery/config.ts';
import type { FilterValue } from '../../lib/gallery/state.ts';
import { displayValue, parseNumber } from '../../lib/gallery/values.ts';
import type { Chip } from '../../lib/gallery/view.ts';
import { formatValue } from '../../lib/format.ts';
import CloseIcon from '../../icons/Close.tsx';
import FilterIcon from '../../icons/Filter.tsx';

export const idFor = (path: string) => `filter-${path.replace(/[^a-z0-9-]/gi, '-')}`;

interface GroupProps {
  def: FilterDef;
  /** Shown when the filter isn't a default, so it can be put away again. */
  onRemove?: () => void;
}

export function EnumFilter({
  def,
  chips,
  value,
  onChange,
  onRemove,
}: GroupProps & { chips: Chip[]; value: FilterValue | undefined; onChange: (values: string[]) => void }) {
  const selected = value?.kind === 'enum' ? value.values : [];
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((v) => v !== key) : [...selected, key]);
  return (
    <fieldset class="filter" id={idFor(def.path)} data-active={selected.length > 0 || undefined}>
      <FilterLegend def={def} onRemove={onRemove} />
      {chips.length === 0 ? (
        <p class="filter__empty">No values in this view.</p>
      ) : (
        <ul class="filter__chips">
          {chips.map((chip) => {
            const pressed = selected.includes(chip.key);
            return (
              <li key={chip.key}>
                <button type="button" class="chip" aria-pressed={pressed} onClick={() => toggle(chip.key)}>
                  {displayValue(def, chip.stored)} <span class="chip__count">{chip.count}</span>
                  <span class="visually-hidden"> {chip.count === 1 ? 'entry' : 'entries'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

export function RangeFilter({
  def,
  bounds,
  value,
  onChange,
  onRemove,
}: GroupProps & {
  bounds: { min: number; max: number } | undefined;
  value: FilterValue | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const current = value?.kind === 'range' ? value : { min: undefined, max: undefined };
  const show = (n: number | undefined) => (n === undefined ? '' : formatValue(n, def.format === 'cr' ? 'cr' : undefined));
  const [min, setMin] = useState(show(current.min));
  const [max, setMax] = useState(show(current.max));
  // Follow the state when it changes from outside the inputs (a cleared filter).
  useEffect(() => setMin(show(current.min)), [current.min]);
  useEffect(() => setMax(show(current.max)), [current.max]);
  const commit = (nextMin: string, nextMax: string) => onChange(parseNumber(nextMin), parseNumber(nextMax));
  const id = idFor(def.path);
  return (
    <fieldset class="filter" id={id} data-active={current.min !== undefined || current.max !== undefined || undefined}>
      <FilterLegend def={def} onRemove={onRemove} />
      <div class="filter__range">
        <span class="filter__bound">
          <label for={`${id}-min`}>Min</label>
          <input
            id={`${id}-min`}
            type="text"
            inputMode="decimal"
            size={4}
            value={min}
            placeholder={bounds ? show(bounds.min) : ''}
            onInput={(e) => {
              const next = (e.currentTarget as HTMLInputElement).value;
              setMin(next);
              commit(next, max);
            }}
          />
        </span>
        <span class="filter__bound">
          <label for={`${id}-max`}>Max</label>
          <input
            id={`${id}-max`}
            type="text"
            inputMode="decimal"
            size={4}
            value={max}
            placeholder={bounds ? show(bounds.max) : ''}
            onInput={(e) => {
              const next = (e.currentTarget as HTMLInputElement).value;
              setMax(next);
              commit(min, next);
            }}
          />
        </span>
      </div>
    </fieldset>
  );
}

function FilterLegend({ def, onRemove }: GroupProps) {
  return (
    <legend class="filter__legend">
      <span class="filter__label">{def.label}</span>
      {onRemove && (
        <button type="button" class="filter__remove" onClick={onRemove} aria-label={`Remove the ${def.label} filter`}>
          <CloseIcon />
        </button>
      )}
    </legend>
  );
}

/**
 * The "Add filter" menu: a disclosure button and a list of filters. Escape
 * closes it and returns focus to the button (§9.7).
 */
export function AddFilter({ options, onAdd }: { options: FilterDef[]; onAdd: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (open) menu.current?.querySelector('button')?.focus();
  }, [open]);
  if (options.length === 0) return null;
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div
      class="add-filter"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={button}
        class="add-filter__button"
        aria-expanded={open}
        aria-controls="add-filter-menu"
        onClick={() => setOpen(!open)}
      >
        <FilterIcon /> Add filter
      </button>
      {open && (
        <ul class="add-filter__menu" id="add-filter-menu" ref={menu}>
          {options.map((def) => (
            <li key={def.path}>
              <button
                type="button"
                onClick={() => {
                  onAdd(def.path);
                  setOpen(false);
                }}
              >
                {def.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
