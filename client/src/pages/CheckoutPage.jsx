import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { placeOrder } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useShipping } from '../hooks/useShipping';
import { paymentsConfigured } from '../lib/stripe';
import PaymentForm from '../components/PaymentForm';
import { formatPrice, orderNumber, thumb } from '../utils';

const ADDRESS_KEY = 'shop_address'; // remembered for next time (on this device only)

const loadAddress = (name) => {
  try {
    return { fullName: name, phone: '', street: '', city: '', postalCode: '', country: '', ...JSON.parse(localStorage.getItem(ADDRESS_KEY)) };
  } catch {
    return { fullName: name, phone: '', street: '', city: '', postalCode: '', country: '' };
  }
};

// Step 1: shipping address + payment method → the order is created and the stock reserved.
// Step 2 (card only): card payment with Stripe → the order is marked as paid.
// Cash on delivery skips step 2: the order is placed and paid in cash when it arrives.
export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { shippingFor } = useShipping();
  const navigate = useNavigate();
  const [address, setAddress] = useState(() => loadAddress(user.name));
  const [paymentMethod, setPaymentMethod] = useState('card'); // "card" or "cod"
  const [placed, setPlaced] = useState(null); // { order, clientSecret } once step 1 is done (card)
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (items.length === 0 && !placed) {
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h3>Your cart is empty</h3>
          <Link to="/shop" className="btn btn-dark">Go to the shop</Link>
        </div>
      </div>
    );
  }

  const handleChange = (e) => setAddress((a) => ({ ...a, [e.target.name]: e.target.value }));

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await placeOrder(
        items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity })),
        address,
        paymentMethod
      );
      try {
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
      } catch {
        // not important
      }
      if (paymentMethod === 'cod') {
        // Nothing to pay now: the order is placed
        clear();
        navigate(`/orders/${result.order._id}`, { replace: true, state: { justPlaced: true } });
        return;
      }
      setPlaced(result);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePaid = (order) => {
    clear();
    navigate(`/orders/${order._id}`, { replace: true, state: { justPaid: true } });
  };

  // Totals: estimated before the order exists, then the server's numbers
  const lines = placed ? placed.order.items : items;
  const sub = placed ? placed.order.subtotal : subtotal;
  const shipping = placed ? placed.order.shippingFee : shippingFor(subtotal);
  const total = placed ? placed.order.total : subtotal + shipping;

  return (
    <div className="container checkout">
      <h1>Checkout</h1>
      <ol className="steps">
        <li className={placed ? 'done' : 'current'}>Shipping</li>
        {paymentMethod === 'card' && <li className={placed ? 'current' : ''}>Payment</li>}
      </ol>

      <div className="cart-layout">
        <section className="card">
          {!placed ? (
            <>
              <h2>Shipping address</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <form className="form" onSubmit={handlePlaceOrder}>
                <div className="row">
                  <label>Full name
                    <input name="fullName" value={address.fullName} onChange={handleChange} autoComplete="name" required />
                  </label>
                  <label>Phone
                    <input name="phone" type="tel" value={address.phone} onChange={handleChange} autoComplete="tel" required />
                  </label>
                </div>
                <label>Street address
                  <input name="street" value={address.street} onChange={handleChange} autoComplete="street-address" required />
                </label>
                <div className="row row-3">
                  <label>City
                    <input name="city" value={address.city} onChange={handleChange} autoComplete="address-level2" required />
                  </label>
                  <label><span>Postal code <span className="optional">(optional)</span></span>
                    <input name="postalCode" value={address.postalCode} onChange={handleChange} autoComplete="postal-code" />
                  </label>
                  <label>Country
                    <input name="country" value={address.country} onChange={handleChange} autoComplete="country-name" required />
                  </label>
                </div>
                <fieldset className="pay-options">
                  <legend>Payment method</legend>
                  <label className={`pay-option ${paymentMethod === 'card' ? 'active' : ''}`}>
                    <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                    <span className="pay-option-text">
                      <strong>Card</strong>
                      <span>Pay securely online now (Stripe)</span>
                    </span>
                  </label>
                  <label className={`pay-option ${paymentMethod === 'cod' ? 'active' : ''}`}>
                    <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    <span className="pay-option-text">
                      <strong>Cash on delivery</strong>
                      <span>Pay {formatPrice(total)} in cash when your order arrives</span>
                    </span>
                  </label>
                </fieldset>
                {paymentMethod === 'card' && !paymentsConfigured && (
                  <div className="alert alert-warn">
                    Card payments aren’t set up on this site yet (missing Stripe key). Choose cash on delivery instead.
                  </div>
                )}

                <button className="btn btn-dark btn-lg btn-block" disabled={saving || (paymentMethod === 'card' && !paymentsConfigured)}>
                  {saving ? 'Reserving your items…' : paymentMethod === 'cod' ? `Place order · ${formatPrice(total)}` : 'Continue to payment'}
                </button>
                <p className="form-hint">
                  {paymentMethod === 'cod'
                    ? 'Your order is placed straight away; you pay the delivery person.'
                    : 'Your items are reserved for you as soon as you continue.'}
                </p>
              </form>
            </>
          ) : (
            <>
              <h2>Payment</h2>
              <p className="muted">
                Order {orderNumber(placed.order._id)} is reserved. Shipping to {placed.order.shippingAddress.fullName},{' '}
                {placed.order.shippingAddress.city}.
              </p>
              <PaymentForm order={placed.order} clientSecret={placed.clientSecret} onPaid={handlePaid} />
              <p className="form-hint">
                Not ready to pay? You can finish later from <Link to={`/orders/${placed.order._id}`}>your order page</Link>.
              </p>
            </>
          )}
        </section>

        <aside className="summary">
          <h3>Your order</h3>
          <ul className="summary-items">
            {lines.map((i) => (
              <li key={`${i.productId || i.product}|${i.size}`}>
                <img src={thumb(i.image, 120)} alt="" />
                <div>
                  <p>{i.name}</p>
                  <span className="muted">Size {i.size} · Qty {i.quantity}</span>
                </div>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row"><span>Subtotal</span><span>{formatPrice(sub)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
          <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(total)}</span></div>
        </aside>
      </div>
    </div>
  );
}
