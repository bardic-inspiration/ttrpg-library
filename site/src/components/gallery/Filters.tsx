// The filter tree (docs/site.md#gallery "Filters", docs/styling.md#accessibility): a nested
// accordion of disclosure buttons, with values as checkboxes that keep their counts and range
// facets as min and max inputs inside their node. The tree's shape comes from lib/gallery/tree.ts.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FilterDef } from '../../lib/gallery/config.ts';
import type { FilterValue } from '../../lib/gallery/state.ts';
import { openAtStart, valueId, type TreeNode, type ValueNode } from '../../lib/gallery/tree.ts';
import { parseNumber } from '../../lib/gallery/values.ts';
import { formatValue } from '../../lib/format.ts';
import { Checkbox } from '../shared/Controls.tsx';
import { DisclosureButton } from '../shared/Disclosure.tsx';

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
  isOpen: (id: string) => boolean;
  toggle: Toggle;
}

/**
 * The whole tree. Which nodes are open is the reader's: the nodes open by default when the tree first
 * shows (the view a link opens), and from then on only what each disclosure opens or closes. Checking
 * or clearing a filter never opens or closes a node.
 */
export function FilterTree(props: TreeProps) {
  const [opened, setOpened] = useState<Set<string>>(() => openAtStart(props.nodes));
  const shared: Shared = {
    ...props,
    isOpen: (id) => opened.has(id),
    toggle: (id, open) =>
      setOpened((current) => {
        const next = new Set(current);
        if (open) next.add(id);
        else next.delete(id);
        return next;
      }),
  };
  return (
    <ul class="tree">
      {props.nodes.map((node) => (
        <Node key={node.id} node={node} shared={shared} reserve={nodesReserve(props.nodes)} />
      ))}
    </ul>
  );
}

/**
 * A node's disclosure, naming it; its panel follows it. A checkable node's disclosure shows only its
 * chevron, named by `describe`, since the checkbox beside it carries the label.
 */
function Disclosure({ id, label, open, toggle, describe }: { id: string; label: string; open: boolean; toggle: Toggle; describe?: string }) {
  return (
    <DisclosureButton
      class="tree__toggle"
      id={`${idFor(id)}-toggle`}
      controls={`${idFor(id)}-panel`}
      open={open}
      onToggle={(next) => toggle(id, next)}
      label={describe ?? label}
      iconOnly={describe !== undefined}
    />
  );
}

/** Whether a list's checkable rows keep a chevron's slot, so their boxes align with a sibling's chevron. */
const nodesReserve = (nodes: TreeNode[]) => nodes.some((n) => n.kind === 'type' && n.children.length > 0);
const valuesReserve = (values: ValueNode[]) => values.some((v) => v.children.length > 0);

/** The empty slot a checkable row without a disclosure keeps where the chevron would be. */
const Slot = () => <span class="tree__slot" aria-hidden="true" />;

function Count({ n }: { n: number }) {
  return (
    <span class="tree__count">
      {n}
      <span class="visually-hidden"> {n === 1 ? 'entry' : 'entries'}</span>
    </span>
  );
}

/** A checkable value, with its nested values (a group's) behind its own disclosure. */
function Value({ id, value, onToggle, shared, reserve }: { id: string; value: ValueNode; onToggle: (key: string) => void; shared: Shared; reserve: boolean }) {
  const own = valueId(id, value.key);
  const open = value.children.length > 0 && shared.isOpen(own);
  return (
    <li class="tree__value">
      <div class="tree__row">
        {value.children.length > 0 ? (
          <Disclosure id={own} label={value.label} open={open} toggle={shared.toggle} describe={`Groups in ${value.label}`} />
        ) : (
          reserve && <Slot />
        )}
        <Checkbox id={idFor(own)} checked={value.selected} onChange={() => onToggle(value.key)}>
          {value.label} <Count n={value.count} />
        </Checkbox>
      </div>
      {value.children.length > 0 && (
        <ul class="tree__values" id={`${idFor(own)}-panel`} hidden={!open}>
          {value.children.map((child) => (
            <Value key={child.key} id={own} value={child} onToggle={onToggle} shared={shared} reserve={valuesReserve(value.children)} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Node({ node, shared, reserve = false }: { node: TreeNode; shared: Shared; reserve?: boolean }) {
  const open = shared.isOpen(node.id);
  const panel = `${idFor(node.id)}-panel`;
  if (node.kind === 'type') {
    const selected = shared.filters.get(node.path);
    const values = selected?.kind === 'enum' ? selected.values : [];
    const key = node.value.key;
    return (
      <li class="tree__node tree__node--type">
        <div class="tree__row">
          {node.children.length > 0 ? (
            <Disclosure id={node.id} label={node.value.label} open={open} toggle={shared.toggle} describe={`${node.value.label} filters`} />
          ) : (
            reserve && <Slot />
          )}
          <Checkbox
            id={idFor(node.id)}
            checked={node.value.selected}
            onChange={() => shared.onEnum(node.path, values.includes(key) ? values.filter((v) => v !== key) : [...values, key])}
          >
            {node.value.label} <Count n={node.value.count} />
          </Checkbox>
        </div>
        {node.children.length > 0 && (
          <ul class="tree__children" id={panel} hidden={!open}>
            {node.children.map((child) => (
              <Node key={child.id} node={child} shared={shared} reserve={nodesReserve(node.children)} />
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
            <Node key={child.id} node={child} shared={shared} reserve={nodesReserve(node.children)} />
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
      <ul class="tree__values" id={panel} hidden={!open} aria-labelledby={`${idFor(node.id)}-toggle`}>
        {node.values.map((value) => (
          <Value key={value.key} id={node.id} value={value} onToggle={onToggle} shared={shared} reserve={valuesReserve(node.values)} />
        ))}
      </ul>
    </li>
  );
}

/**
 * A range facet's min and max inputs, which accept fractions such as `1/8`. Each bound commits only
 * text that parses or is empty, so typing `1/8` or `1.5` passes through `1/` and `1.` without
 * clearing the filter, and keeps the other bound as the filter holds it.
 */
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
  const base = idFor(id);
  return (
    <div class="tree__range" role="group" aria-labelledby={`${base}-toggle`}>
      <Bound id={`${base}-min`} label="Min" value={current.min} placeholder={bounds ? show(bounds.min) : ''} show={show} onCommit={(min) => onChange(min, current.max)} />
      <Bound id={`${base}-max`} label="Max" value={current.max} placeholder={bounds ? show(bounds.max) : ''} show={show} onCommit={(max) => onChange(current.min, max)} />
    </div>
  );
}

/**
 * One bound's input. Its text is the reader's while it has focus; otherwise it shows the filter's
 * value, following it when the filter changes from outside (a cleared filter) and when focus leaves.
 */
function Bound({
  id,
  label,
  value,
  placeholder,
  show,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | undefined;
  placeholder: string;
  show: (n: number | undefined) => string;
  onCommit: (n: number | undefined) => void;
}) {
  const [text, setText] = useState(show(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current !== document.activeElement) setText(show(value));
  }, [value]);
  return (
    <span class="tree__bound">
      <label for={id}>{label}</label>
      <input
        ref={input}
        id={id}
        type="text"
        inputMode="decimal"
        size={4}
        value={text}
        placeholder={placeholder}
        onInput={(e) => {
          const next = (e.currentTarget as HTMLInputElement).value;
          setText(next);
          const n = parseNumber(next);
          if (n !== undefined || next.trim() === '') onCommit(n);
        }}
        onBlur={() => setText(show(value))}
      />
    </span>
  );
}
