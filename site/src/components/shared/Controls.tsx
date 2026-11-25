// The checkbox, chip, and toggle controls (docs/styling.md#shared-components "Controls"). A checkbox
// is one of a list of independent choices; a chip is one value of a small range, shown as the value
// alone; a toggle is one setting of the view, on or off by itself.
import type { ComponentChildren } from 'preact';
import './shared.css';

export interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** The label, beside the box. */
  children: ComponentChildren;
  class?: string;
}

/** A checkbox and its label, as siblings: the caller lays them out. */
export function Checkbox({ id, checked, onChange, disabled, children, class: extra }: CheckboxProps) {
  return (
    <>
      <input
        type="checkbox"
        id={id}
        class={extra}
        checked={checked}
        disabled={disabled ?? !onChange}
        onChange={(event) => onChange?.((event.currentTarget as HTMLInputElement).checked)}
      />
      <label for={id}>{children}</label>
    </>
  );
}

export interface ChipProps {
  pressed: boolean;
  onChange?: (pressed: boolean) => void;
  children: ComponentChildren;
}

/** A pressable chip, `aria-pressed` while it's on. */
export function Chip({ pressed, onChange, children }: ChipProps) {
  return (
    <button type="button" class="chip" aria-pressed={pressed} disabled={!onChange} onClick={() => onChange?.(!pressed)}>
      {children}
    </button>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  children: ComponentChildren;
}

/** A switch: its label, and a track that fills while it's on. */
export function Toggle({ checked, onChange, children }: ToggleProps) {
  return (
    <button type="button" role="switch" class="toggle" aria-checked={checked} disabled={!onChange} onClick={() => onChange?.(!checked)}>
      <span class="toggle__track" aria-hidden="true" />
      {children}
    </button>
  );
}
