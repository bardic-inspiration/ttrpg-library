// What a gallery set action runs on (docs/site.md#gallery "Cart and set actions",
// docs/export.md#exporter-interface): the print cart when it holds anything, otherwise the whole
// filtered set.
import { cartKey } from '../cart.ts';
import type { LibraryRecord } from './config.ts';

export interface SetTarget {
  /** The entries the action receives, in order. */
  records: LibraryRecord[];
  /** Whether they are the cart (true) or the filtered set (false). */
  cart: boolean;
}

/**
 * The entries a set action receives. With anything in the cart: the cart's entries in the order
 * they were added, whatever the filters show, leaving out keys the library doesn't have. With an
 * empty cart: every result, in the gallery's current order.
 */
export function setTarget(all: LibraryRecord[], results: LibraryRecord[], cart: readonly string[]): SetTarget {
  if (cart.length === 0) return { records: results, cart: false };
  const byKey = new Map(all.map((record) => [cartKey(record), record]));
  const records = cart.flatMap((key) => byKey.get(key) ?? []);
  return { records, cart: true };
}

/** Says what a set action targets: "3 in cart", "1 entry", "12 entries". */
export function targetText({ records, cart }: SetTarget): string {
  const n = records.length;
  if (cart) return `${n} in cart`;
  return n === 1 ? '1 entry' : `${n} entries`;
}
