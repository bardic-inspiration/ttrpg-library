// The filter tree (docs/site.md#gallery "Filters", docs/styling.md#accessibility): a nested
// accordion of disclosure buttons, with values as checkboxes that keep their counts and range
// facets as min and max inputs inside their node. The tree's shape comes from lib/gallery/tree.ts.
import { useEffect, useState } from 'preact/hooks';
import type { FilterDef } from '../../lib/gallery/config.ts';
import type { FilterValue } from '../../lib/gallery/state.ts';
import type { TreeNode, ValueNode } from '../../lib/gallery/tree.ts';
import { parseNumber } from '../../lib/gallery/values.ts';
import { formatValue } from '../../lib/format.ts';

export const idFor = (path: string) => `filter-${path.replace(/[^a-z0-9-]/gi, '-')}`;

export interface TreeProps {
  nodes: TreeNode[];
  filters: Map<string, FilterValue>;
  /** Sets an enum filter's values; the type filter's path is `type`. */
  onEnum: (path: string, values: string[]) => void;
  onRange: (path: string, min: number | undefined, max: number | undefined) => void;
}

type Toggle = (id: string, open: boolean) => void;

interface Shared extends TreeProps {
  isOpen: (id: string, byDefault: boolean) => boolean;
  toggle: Toggle;
}

/** The whole tree. Which nodes are open is the reader's, starting from each node's default. */
export function FilterTree(props: TreeProps) {
  const [opened, setOpened] = useState<Map<string, boolean>>(new Map());
  const shared: Shared = {
    ...props,
    isOpen: (id, byDefault) => opened.get(id) ?? byDefault,
    toggle: (id, open) => setOpened(new Map(opened).set(id, open)),
  };
  return (
    <ul class="tree">
      {props.nodes.map((node) => (
        <Node key={node.id} node={node} shared={shared} />
      ))}
    </ul>
  );
}

/** A disclosure button for a node, naming it; its panel follows it. */
function Disclosure({ id, label, open, toggle, describe }: { id: string; label: string; open: boolean; toggle: Toggle; describe?: string }) {
  return (
    <button
      type="button"
      class="tree__toggle"
      id={`${idFor(id)}-toggle`}
      aria-expanded={open}
      aria-controls={`${idFor(id)}-panel`}
      {...(describe ? { 'aria-label': describe } : {})}
      onClick={() => toggle(id, !open)}
    >
      <span class="tree__chevron" aria-hidden="true" />
      {describe ? null : label}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span class="tree__count">
      {n}
      <span class="visually-hidden"> {n === 1 ? 'entry' : 'entries'}</span>
    </span>
  );
}

/** A checkable value, with its nested values (a group's) behind its own disclosure. */
function Value({ id, value, onToggle, shared }: { id: string; value: ValueNode; onToggle: (key: string) => void; shared: Shared }) {
  const own = `${id}-${value.key}`;
  const open = value.children.length > 0 && shared.isOpen(own, value.open);
  return (
    <li class="tree__value">
      <div class="tree__row">
        <input type="checkbox" id={idFor(own)} checked={value.selected} onChange={() => onToggle(value.key)} />
        <label for={idFor(own)}>
          {value.label} <Count n={value.count} />
        </label>
        {value.children.length > 0 && (
          <Disclosure id={own} label={value.label} open={open} toggle={shared.toggle} describe={`Groups in ${value.label}`} />
        )}
      </div>
      {value.children.length > 0 && (
        <ul class="tree__values" id={`${idFor(own)}-panel`} hidden={!open}>
          {value.children.map((child) => (
            <Value key={child.key} id={own} value={child} onToggle={onToggle} shared={shared} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Node({ node, shared }: { node: TreeNode; shared: Shared }) {
  const open = shared.isOpen(node.id, node.open);
  const panel = `${idFor(node.id)}-panel`;
  if (node.kind === 'type') {
    const selected = shared.filters.get('type');
    const values = selected?.kind === 'enum' ? selected.values : [];
    const key = node.value.key;
    return (
      <li class="tree__node tree__node--type">
        <div class="tree__row">
          <input
            type="checkbox"
            id={idFor(node.id)}
            checked={node.value.selected}
            onChange={() => shared.onEnum('type', values.includes(key) ? values.filter((v) => v !== key) : [...values, key])}
          />
          <label for={idFor(node.id)}>
            {node.value.label} <Count n={node.value.count} />
          </label>
          {node.children.length > 0 && (
            <Disclosure id={node.id} label={node.value.label} open={open} toggle={shared.toggle} describe={`${node.value.label} filters`} />
          )}
        </div>
        {node.children.length > 0 && (
          <ul class="tree__children" id={panel} hidden={!open}>
            {node.children.map((child) => (
              <Node key={child.id} node={child} shared={shared} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  if (node.kind === 'field') {
    return (
      <li class="tree__node">
        <Disclosure id={node.id} label={node.label} open={open} toggle={shared.toggle} />
        <ul class="tree__children" id={panel} hidden={!open}>
          {node.children.map((child) => (
            <Node key={child.id} node={child} shared={shared} />
          ))}
        </ul>
      </li>
    );
  }
  const active = shared.filters.get(node.def.path) !== undefined;
  if (node.kind === 'range') {
    return (
      <li class="tree__node" data-active={active || undefined}>
        <Disclosure id={node.id} label={node.def.label} open={open} toggle={shared.toggle} />
        <div class="tree__panel" id={panel} hidden={!open}>
          <Range id={node.id} def={node.def} bounds={node.bounds} value={shared.filters.get(node.def.path)} onChange={(min, max) => shared.onRange(node.def.path, min, max)} />
        </div>
      </li>
    );
  }
  const current = shared.filters.get(node.def.path);
  const selected = current?.kind === 'enum' ? current.values : [];
  const onToggle = (key: string) =>
    shared.onEnum(node.def.path, selected.includes(key) ? selected.filter((v) => v !== key) : [...selected, key]);
  return (
    <li class="tree__node" data-active={active || undefined}>
      <Disclosure id={node.id} label={node.def.label} open={open} toggle={shared.toggle} />
      <ul class="tree__values" id={panel} hidden={!open} role="group" aria-labelledby={`${idFor(node.id)}-toggle`}>
        {node.values.map((value) => (
          <Value key={value.key} id={node.id} value={value} onToggle={onToggle} shared={shared} />
        ))}
      </ul>
    </li>
  );
}

/** A range facet's min and max inputs, which accept fractions such as `1/8`. */
function Range({
  id,
  def,
  bounds,
  value,
  onChange,
}: {
  id: string;
  def: FilterDef;
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
  const base = idFor(id);
  return (
    <div class="tree__range" role="group" aria-labelledby={`${base}-toggle`}>
      <span class="tree__bound">
        <label for={`${base}-min`}>Min</label>
        <input
          id={`${base}-min`}
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
      <span class="tree__bound">
        <label for={`${base}-max`}>Max</label>
        <input
          id={`${base}-max`}
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
  );
}
