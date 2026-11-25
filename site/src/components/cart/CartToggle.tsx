// The cart control (docs/site.md#gallery "Cart and set actions"): the shared checkbox, "In cart",
// checked while the entry is in the cart. Checking it adds the entry to the end of the cart, and
// unchecking it removes it. Its accessible name carries the entry's name.
import { Checkbox } from '../shared/Controls.tsx';
import './cart.css';

export interface CartToggleProps {
  /** The checkbox's id, unique on the page. */
  id: string;
  /** The entry's name, for the accessible name. */
  name: string;
  inCart: boolean;
  onChange?: (inCart: boolean) => void;
}

export default function CartToggle({ id, name, inCart, onChange }: CartToggleProps) {
  return (
    <span class="cart-toggle">
      <Checkbox id={id} checked={inCart} onChange={onChange}>
        In cart<span class="visually-hidden">: {name}</span>
      </Checkbox>
    </span>
  );
}
