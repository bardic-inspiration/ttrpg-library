// The card link (docs/styling.md#shared-components "Click targets"): a card's title link, which
// covers the whole card so a click anywhere on it opens the entry. The card's root takes
// `linkedCard`, which lifts every other control on the card above the link.
import type { ComponentChildren } from 'preact';
import './shared.css';

/** The class a card's root element carries. */
export const linkedCard = 'linked-card';

export default function CardLink({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a class="card-link" href={href}>
      {children}
    </a>
  );
}
