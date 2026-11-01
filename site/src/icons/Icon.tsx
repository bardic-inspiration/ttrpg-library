// Shared frame for the inlined Lucide icons (SPEC.md §9.6 "Icons"; ISC
// license, credited in ATTRIBUTION.md). Icons are decorative: they inherit
// the text color through currentColor, size to the --icon-size token through
// the .icon class, and are hidden from assistive technology, so the control
// they sit in carries the accessible name.
import type { ComponentChildren } from 'preact';

export interface IconProps {
  class?: string;
}

export function Icon({ class: className, children }: IconProps & { children: ComponentChildren }) {
  return (
    <svg
      class={className ? `icon ${className}` : 'icon'}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
