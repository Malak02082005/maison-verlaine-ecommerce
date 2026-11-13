import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { cancelOrder, confirmPayment, getOrder, getOrderPayment } from '../api';
import { paymentsConfigured } from '../lib/stripe';
import PaymentForm from '../components/PaymentForm';
import CancelDialog from '../components/CancelDialog';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeftIcon, CheckIcon } from '../components/Icons';
import { formatDate, formatPrice, orderNumber, thumb } from '../utils';

// Progress steps: card orders start at "Paid", cash-on-delivery orders at "Placed"
const CARD_STEPS = [
  { status: 'paid', label: 'Paid', date: (o) => o.payment?.paidAt },
  { status: 'shipped', label: 'Shipped', date: (o) => o.shippedAt },
  { status: 'delivered', label: 'Delivered', date: (o) => o.deliveredAt },
];
const CASH_STEPS = [
  { status: 'placed', label: 'Placed', date: (o) => o.createdAt },
  { status: 'shipped', label: 'Shipped', date: (o) => o.shippedAt },
  { status: 'delivered', label: 'Delivered & paid', date: (o) => o.deliveredAt },
];

export default function OrderPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [clientSecret, setClientSecret] = useState(null); // set when "Complete payment" is clicked
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState(Boolean(location.state?.justPaid));
  const justPlaced = Boolean(location.state?.justPlaced); // cash-on-delivery order just placed
  const [cancelling, setCancelling] = useState(false); // the "why are you cancelling?" dialog is open
  const checkedRedirect = useRef(false);

  useEffect(() => {
    getOrder(id)
      .then(async (o) => {
        // Coming back from a bank's page after paying (Stripe redirect): confirm the payment
        if (o.status === 'pending_payment' && searchParams.get('redirect_status') === 'succeeded' && !checkedRedirect.current) {
          checkedRedirect.current = true;
          try {
            o = await confirmPayment(id);
            setJustPaid(true);
          } catch {
            // still pending; the customer can try again below
          }
        }
        setOrder(o);
      })
      .catch((err) => setError(err.message));
  }, [id, searchParams]);

  if (error) {
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h3>{error}</h3>
          <Link to="/orders" className="btn btn-dark">Back to my orders</Link>
        </div>
      </div>
    );
  }
  if (!order) return <div className="page-loading">Loading…</div>;

  const startPayment = async () => {
    setBusy(true);
    setActionError('');
    try {
      setClientSecret((await getOrderPayment(order._id)).clientSecret);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // "Cancel order" opens a dialog that asks for the reason first
  const handleCancel = () => setCancelling(true);
  const confirmCancel = async (reason, note) => {
    const cancelled = await cancelOrder(order._id, reason, note); // errors are shown in the dialog
    setOrder(cancelled);
    setClientSecret(null);
    setCancelling(false);
  };

  const handlePaid = (paid) => {
    setOrder(paid);
    setClientSecret(null);
    setJustPaid(true);
    navigate(location.pathname, { replace: true }); // drop Stripe's ?payment_intent=… from the URL
  };

  const a = order.shippingAddress;
  const isCash = order.payment?.provider === 'cod';
  const STEPS = isCash ? CASH_STEPS : CARD_STEPS;
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="container order-page">
      <Link to="/orders" className="back-link"><ArrowLeftIcon size={16} /> My orders</Link>

      {justPaid && order.status === 'paid' && (
        <div className="thank-you">
          <span className="thank-you-icon"><CheckIcon size={26} /></span>
          <div>
            <h2>Thank you for your order!</h2>
            <p>Your payment went through. We’ll let you know when your order ships.</p>
          </div>
        </div>
      )}
      {justPlaced && order.status === 'placed' && (
        <div className="thank-you">
          <span className="thank-you-icon"><CheckIcon size={26} /></span>
          <div>
            <h2>Thank you for your order!</h2>
            <p>Your order is placed. Please have {formatPrice(order.total)} in cash ready when it arrives.</p>
          </div>
        </div>
      )}

      <div className="order-head">
        <div>
          <h1>Order {orderNumber(order._id)}</h1>
          <p className="muted">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {/* ----- unpaid: finish paying or cancel ----- */}
      {order.status === 'pending_payment' && (
        <section className="card pay-card">
          <h2>This order is waiting for payment</h2>
          <p className="muted">Your items are reserved. Complete the payment to confirm the order.</p>
          {clientSecret ? (
            <PaymentForm order={order} clientSecret={clientSecret} onPaid={handlePaid} />
          ) : (
            <div className="btn-row">
              <button className="btn btn-dark" onClick={startPayment} disabled={busy || !paymentsConfigured}>
                Complete payment · {formatPrice(order.total)}
              </button>
              <button className="btn btn-outline btn-danger" onClick={handleCancel} disabled={busy}>Cancel order</button>
            </div>
          )}
        </section>
      )}

      {/* ----- progress ----- */}
      {stepIndex >= 0 && (
        <ol className="timeline">
          {STEPS.map((s, i) => (
            <li key={s.status} className={i <= stepIndex ? 'done' : ''}>
              <span className="timeline-dot">{i <= stepIndex && <CheckIcon size={14} />}</span>
              <strong>{s.label}</strong>
              <span className="muted">{s.date(order) ? formatDate(s.date(order)) : '—'}</span>
            </li>
          ))}
        </ol>
      )}
      {order.status === 'cancelled' && (
        <div className="alert alert-muted">
          This order was cancelled{order.cancelledAt && ` on ${formatDate(order.cancelledAt)}`}
          {order.cancellation?.reason && ` · Reason: ${order.cancellation.reason}`}
          {order.cancellation?.note && ` (“${order.cancellation.note}”)`}.
        </div>
      )}
      {cancelling && (
        <CancelDialog order={order} who="customer" onConfirm={confirmCancel} onClose={() => setCancelling(false)} />
      )}
      {/* Cash orders can be cancelled until they ship */}
      {order.status === 'placed' && (
        <div className="btn-row order-actions">
          <button className="btn btn-outline btn-danger btn-sm" onClick={handleCancel} disabled={busy}>Cancel order</button>
        </div>
      )}

      <div className="cart-layout">
        <section className="card">
          <h2>Items</h2>
          <ul className="order-items">
            {order.items.map((i) => (
              <li key={`${i.product}|${i.size}`}>
                <img src={thumb(i.image, 160)} alt="" />
                <div>
                  {i.slug ? <Link to={`/product/${i.slug}`} className="cart-item-name">{i.name}</Link> : <span className="cart-item-name">{i.name}</span>}
                  <p className="muted">{i.color} · Size {i.size} · Qty {i.quantity}</p>
                </div>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="summary">
          <h3>Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</span></div>
          <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          <h3 className="summary-sub">Payment</h3>
          <p className="address">
            {isCash
              ? (order.payment.paidAt ? 'Cash on delivery · paid' : `Cash on delivery · ${formatPrice(order.total)} due on delivery`)
              : (order.payment?.paidAt ? 'Card · paid online' : 'Card · not paid yet')}
          </p>
          <h3 className="summary-sub">Shipping to</h3>
          <address className="address">
            {a.fullName}<br />{a.street}<br />{a.city}{a.postalCode && ` ${a.postalCode}`}<br />{a.country}<br />{a.phone}
          </address>
        </aside>
      </div>
    </div>
  );
}
