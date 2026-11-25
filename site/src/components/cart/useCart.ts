// The cart as Preact state (docs/site.md#gallery "Cart and set actions"): read from the browser
// once the island mounts, and kept in step with every change, in this page or another tab.
import { useEffect, useState } from 'preact/hooks';
import { onCartChange, readCart } from '../../lib/cart.ts';

/** The cart's keys, in the order they were added; empty until the island mounts. */
export function useCart(): string[] {
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    setKeys(readCart());
    return onCartChange(() => setKeys(readCart()));
  }, []);
  return keys;
}
