// The disclosure (docs/styling.md#shared-components "Disclosure"): one toggle, its chevron on the
// left, turning down when open. A button disclosure opens a panel the caller renders and names with
// `controls`; a details disclosure holds its own panel. Disclosure.astro renders the same details
// markup for Astro pages.
import type { ComponentChildren } from 'preact';
import './shared.css';

/** The chevron every disclosure shows, on its left. */
export function Chevron() {
  return <span class="chevron" aria-hidden="true" />;
}

export interface DisclosureButtonProps {
  id?: string;
  /** The id of the panel it opens. */
  controls: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Its name. With `iconOnly`, the name is the button's accessible name and only the chevron shows. */
  label: ComponentChildren;
  iconOnly?: boolean;
  class?: string;
}

export function DisclosureButton({ id, controls, open, onToggle, label, iconOnly = false, class: extra }: DisclosureButtonProps) {
  return (
    <button
      type="button"
      class={['disclosure', iconOnly && 'disclosure--icon', extra].filter(Boolean).join(' ')}
      id={id}
      aria-expanded={open}
      aria-controls={controls}
      {...(iconOnly && typeof label === 'string' ? { 'aria-label': label } : {})}
      onClick={() => onToggle(!open)}
    >
      <Chevron />
      {iconOnly ? null : label}
    </button>
  );
}

export interface DetailsProps {
  summary: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  open?: boolean;
}

/** A disclosure that holds its panel: a `<details>` whose summary is the toggle. */
export function Details({ summary, children, class: extra, open }: DetailsProps) {
  return (
    <details class={extra} open={open}>
      <summary class="disclosure">
        <Chevron />
        {summary}
      </summary>
      {children}
    </details>
  );
}
