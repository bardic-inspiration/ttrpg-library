// Buttons (docs/styling.md#shared-components "Buttons"): the fixed set of variants, and the menu
// button that opens a small menu of choices. Primary is a place's one main action, first in its row;
// secondary is every other action; icon is an icon alone, named by `label`.
import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import './shared.css';

export type ButtonVariant = 'primary' | 'secondary' | 'icon';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'type' | 'label'> & {
  variant?: ButtonVariant;
  class?: string;
  /** The accessible name of an icon button, whose content is only an icon. */
  label?: string;
  children: ComponentChildren;
};

export const buttonClass = (variant: ButtonVariant, extra?: string) => ['button', `button--${variant}`, extra].filter(Boolean).join(' ');

export default function Button({ variant = 'secondary', class: extra, label, children, ...rest }: ButtonProps) {
  return (
    <button type="button" class={buttonClass(variant, extra)} {...(variant === 'icon' && label ? { 'aria-label': label } : {})} {...rest}>
      {children}
    </button>
  );
}

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
}

export interface MenuButtonProps {
  /** The menu's id, unique on the page. */
  id: string;
  /** The button's content. */
  children: ComponentChildren;
  /** The menu's accessible name. */
  menuLabel: string;
  items: MenuItem[];
  disabled?: boolean;
  /** Starts with the menu open; for tests and the style guide. */
  open?: boolean;
  class?: string;
}

/**
 * A secondary button that opens a menu below it. Choosing an item closes the menu, returns focus to
 * the button, and runs the item. Escape closes it and returns focus too, and it closes when focus
 * leaves it.
 */
export function MenuButton({ id, children, menuLabel, items, disabled = false, open: initial = false, class: extra }: MenuButtonProps) {
  const [open, setOpen] = useState(initial);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  };
  return (
    <div
      class={['menu-button', extra].filter(Boolean).join(' ')}
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
        class={buttonClass('secondary')}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      <ul id={id} class="menu-button__menu" aria-label={menuLabel} hidden={!open || disabled}>
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              class="menu-button__item"
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
