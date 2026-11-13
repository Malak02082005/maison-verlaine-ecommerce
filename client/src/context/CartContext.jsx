import { createContext, useContext, useEffect, useState } from 'react';
import { MAX_PER_ITEM, itemKey } from './cartItems';

const CartContext = createContext(null);
const CART_KEY = 'shop_cart';

// The cart lives in the browser (localStorage), so it works before logging in and survives a
// refresh. Prices here are only for display: the server recalculates everything at checkout.
//
// Each item: { productId, slug, name, image, color, price, size, quantity, stock }
const loadCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // storage full or blocked: the cart still works until the page is closed
    }
  }, [items]);

  const limitFor = (stock) => Math.min(stock ?? MAX_PER_ITEM, MAX_PER_ITEM);

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

  const clear = () => setItems([]);

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
