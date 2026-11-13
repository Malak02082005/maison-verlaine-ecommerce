import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getProduct } from '../api';
import { useCart } from '../context/CartContext';
import { MAX_PER_ITEM, itemKey } from '../context/cartItems';
import { useShipping } from '../hooks/useShipping';
import { ArrowRightIcon, MinusIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { formatPrice, thumb } from '../utils';

export default function CartPage() {
  const { items, subtotal, setQuantity, remove, refresh } = useCart();
  const { shippingFor, freeShippingFrom } = useShipping();
  const navigate = useNavigate();
  const [problems, setProblems] = useState({}); // itemKey → message

  // Reload the products in the cart, so prices and stock are up to date
  const productIds = [...new Set(items.map((i) => i.productId))].sort().join(',');
  useEffect(() => {
    if (!productIds) return;
    Promise.all(productIds.split(',').map((id) => getProduct(id).catch(() => null))).then((products) => {
      const byId = Object.fromEntries(products.filter(Boolean).map((p) => [p._id, p]));
      const updates = {};
      const found = {};
      for (const item of items) {
        const key = itemKey(item);
        const product = byId[item.productId];
        const stock = product?.sizes.find((s) => s.size === item.size)?.stock ?? 0;
        if (!product) found[key] = 'This product is no longer available';
        else if (stock === 0) found[key] = 'Sold out in this size';
        else if (stock < item.quantity) found[key] = `Only ${stock} left`;
        if (product) updates[key] = { price: product.price, stock, name: product.name, image: product.images[0] };
      }
      refresh(updates);
      setProblems(found);
    });
    // Only re-run when the set of products changes, not on every quantity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds]);

  if (items.length === 0) {
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h3>Your cart is empty</h3>
          <p>Find something you love in the shop.</p>
          <Link to="/shop" className="btn btn-dark">Start shopping</Link>
        </div>
      </div>
    );
  }

  const shipping = shippingFor(subtotal);
  const hasProblems = items.some((i) => problems[itemKey(i)]);
  const toFreeShipping = freeShippingFrom - subtotal;

  return (
    <div className="container cart-page">
      <h1>Your cart</h1>

      <div className="cart-layout">
        <ul className="cart-list">
          {items.map((item) => {
            const key = itemKey(item);
            const max = Math.min(item.stock ?? MAX_PER_ITEM, MAX_PER_ITEM);
            return (
              <li key={key} className="cart-item">
                <Link to={`/product/${item.slug}`} className="cart-item-image">
                  <img src={thumb(item.image, 240)} alt={item.name} />
                </Link>
                <div className="cart-item-info">
                  <Link to={`/product/${item.slug}`} className="cart-item-name">{item.name}</Link>
                  <p className="muted">{item.color} · Size {item.size}</p>
                  <p className="cart-item-price">{formatPrice(item.price)}</p>
                  {problems[key] && <p className="field-error">{problems[key]}</p>}
                </div>
                <div className="cart-item-actions">
                  <div className="qty qty-sm" aria-label="Quantity">
                    <button onClick={() => setQuantity(key, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Fewer"><MinusIcon size={14} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => setQuantity(key, item.quantity + 1)} disabled={item.quantity >= max} aria-label="More"><PlusIcon size={14} /></button>
                  </div>
                  <p className="cart-item-total">{formatPrice(item.price * item.quantity)}</p>
                  <button className="link-btn link-danger" onClick={() => remove(key)}>
                    <TrashIcon size={15} /> Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="summary">
          <h3>Order summary</h3>
          {toFreeShipping > 0 ? (
            <div className="free-ship">
              <p>Add <strong>{formatPrice(toFreeShipping)}</strong> more for free shipping</p>
              <div className="progress"><span style={{ width: `${Math.min(100, (subtotal / freeShippingFrom) * 100)}%` }} /></div>
            </div>
          ) : (
            <p className="free-ship free-ship-done">You’ve got free shipping!</p>
          )}
          <div className="summary-row"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
          <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(subtotal + shipping)}</span></div>
          {hasProblems && <p className="field-error">Please fix the items marked in red before checking out.</p>}
          <button className="btn btn-dark btn-lg btn-block" disabled={hasProblems} onClick={() => navigate('/checkout')}>
            Checkout <ArrowRightIcon size={18} />
          </button>
          <Link to="/shop" className="link-btn center">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
