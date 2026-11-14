import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { MAX_PER_ITEM, itemKey } from './cartItems';

const CartContext = createContext(null);

// The cart lives in the browser (localStorage), so it works before logging in and survives a
// refresh. Prices here are only for display: the server recalculates everything at checkout.
//
// Every account has its own cart on this device ("shop_cart:<user id>"), and so does a visitor
// who isn't logged in ("shop_cart:guest"):
//   - logging in moves the guest's items into that account's cart (so "add to cart, then log
//     in at checkout" keeps the items)
//   - logging out switches to the (empty) guest cart; the account's cart is kept for next time
//
// Each item: { productId, slug, name, image, color, price, size, quantity, stock }
const GUEST = 'guest';
const LEGACY_KEY = 'shop_cart'; // the single shared cart used before carts were per account
const keyFor = (owner) => `shop_cart:${owner}`;

const limitFor = (stock) => Math.min(stock ?? MAX_PER_ITEM, MAX_PER_ITEM);

const read = (key) => {
  try {
    const items = JSON.parse(localStorage.getItem(key));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const readGuest = () => {
  const guest = read(keyFor(GUEST));
  return guest.length ? guest : read(LEGACY_KEY);
};

// Adds the guest's items to an account's cart (same product and size: quantities add up, within the limit)
const mergeInto = (items, extra) => {
  const list = items.map((i) => ({ ...i }));
  for (const e of extra) {
    const existing = list.find((i) => itemKey(i) === itemKey(e));
    if (existing) existing.quantity = Math.min(existing.quantity + e.quantity, limitFor(existing.stock));
    else list.push(e);
  }
  return list;
};

// The cart to show for an owner: nothing while the login is still being checked (null)
const loadFor = (owner) => {
  if (!owner) return [];
  if (owner === GUEST) return readGuest();
  return mergeInto(read(keyFor(owner)), readGuest());
};

export function CartProvider({ children }) {
  const { user, checking } = useAuth();
  const owner = checking ? null : user?._id || GUEST;
  const [cart, setCart] = useState(() => ({ owner, items: loadFor(owner) }));

  // Someone logged in or out: switch to their cart right away (during render, so the
  // previous person's cart is never shown)
  if (cart.owner !== owner) setCart({ owner, items: loadFor(owner) });
  const { items } = cart;

  useEffect(() => {
    if (!cart.owner) return;
    try {
      localStorage.setItem(keyFor(cart.owner), JSON.stringify(cart.items));
      // The guest's items now belong to this account, so the guest cart starts empty again
      if (cart.owner !== GUEST) localStorage.removeItem(keyFor(GUEST));
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // storage full or blocked: the cart still works until the page is closed
    }
  }, [cart]);

  const setItems = (update) => setCart((c) => ({ ...c, items: update(c.items) }));

  // Adds `quantity` of a product in `size`. Returns how many were actually added (stock limit).
  const add = (product, size, quantity = 1) => {
    const stock = product.sizes.find((s) => s.size === size)?.stock ?? 0;
    const key = `${product._id}|${size}`;
    const already = items.find((i) => itemKey(i) === key)?.quantity || 0;
    const added = Math.max(Math.min(quantity, limitFor(stock) - already), 0);
    if (added === 0) return 0;

    setItems((list) => {
      const existing = list.find((i) => itemKey(i) === key);
      if (existing) {
        return list.map((i) => (i === existing ? { ...i, quantity: i.quantity + added, stock, price: product.price } : i));
      }
      return [
        ...list,
        {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: product.images[0],
          color: product.color,
          price: product.price,
          size,
          quantity: added,
          stock,
        },
      ];
    });
    return added;
  };

  const setQuantity = (key, quantity) =>
    setItems((list) =>
      list.map((i) => (itemKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(quantity, limitFor(i.stock))) } : i))
    );

  const remove = (key) => setItems((list) => list.filter((i) => itemKey(i) !== key));

  // Updates price/stock/name from fresh product data (the cart page reloads products)
  const refresh = (updates) =>
    setItems((list) =>
      list.map((i) => {
        const u = updates[itemKey(i)];
        return u ? { ...i, ...u } : i;
      })
    );

  const clear = () => setItems(() => []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;

  return (
    <CartContext.Provider value={{ items, count, subtotal, add, setQuantity, remove, refresh, clear }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
