import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { cancelOrder, getAdminOrders, setOrderStatus } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import CancelDialog from '../../components/CancelDialog';
import { ORDER_STATUS, formatDate, formatPrice, orderNumber, thumb } from '../../utils';

// "Changed my mind (customer)" / "Out of stock (admin): note"
const cancelSummary = (c) => (c?.reason ? `${c.reason} · by ${c.by === 'admin' ? 'admin' : 'customer'}` : '');

export default function AdminOrders() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null); // order whose details are shown
  const [busyId, setBusyId] = useState(null);
  const [cancelling, setCancelling] = useState(null); // order in the "why cancel?" dialog

  // All orders are loaded once; the status tabs just filter them
  useEffect(() => {
    getAdminOrders().then(setOrders).catch((err) => setError(err.message));
  }, []);

  const replace = (updated) => setOrders((list) => list.map((o) => (o._id === updated._id ? { ...updated, user: updated.user?.name ? updated.user : o.user } : o)));

  const run = async (order, action) => {
    setBusyId(order._id);
    setError('');
    try {
      replace(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Opens the dialog that asks why; the order is cancelled once a reason is chosen
  const cancel = (order) => setCancelling(order);
  const confirmCancel = async (reason, note) => {
    replace(await cancelOrder(cancelling._id, reason, note)); // errors are shown in the dialog
    setCancelling(null);
  };

  const counts = (orders || []).reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  const shown = (orders || []).filter((o) => !status || o.status === status);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Orders</h1>
          <p className="muted">Ship paid orders and keep customers up to date.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={!status} className={`tab ${!status ? 'active' : ''}`} onClick={() => setParams({})}>
          All <span className="tab-count">{orders?.length || 0}</span>
        </button>
        {Object.entries(ORDER_STATUS).map(([s, { label }]) => (
          <button key={s} role="tab" aria-selected={status === s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setParams({ status: s })}>
            {label} <span className="tab-count">{counts[s] || 0}</span>
          </button>
        ))}
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const busy = busyId === o._id;
                const open = openId === o._id;
                return (
                  <Fragment key={o._id}>
                    <tr className={open ? 'row-open' : ''}>
                      <td>
                        <button className="link-btn" onClick={() => setOpenId(open ? null : o._id)} aria-expanded={open}>
                          {orderNumber(o._id)}
                        </button>
                        <span className="muted block">{formatDate(o.createdAt)}</span>
                      </td>
                      <td>{o.user?.name || 'Deleted account'}<span className="muted block">{o.user?.email}</span></td>
                      <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                      <td>
                        {formatPrice(o.total)}
                        <span className="muted block">{o.payment?.provider === 'cod' ? 'Cash on delivery' : 'Card'}</span>
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                        {o.status === 'cancelled' && o.cancellation?.reason && (
                          <span className="muted block cancel-reason" title={o.cancellation.note || ''}>{cancelSummary(o.cancellation)}</span>
                        )}
                      </td>
                      <td className="table-actions">
                        {(o.status === 'paid' || o.status === 'placed') && (
                          <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => run(o, () => setOrderStatus(o._id, 'shipped'))}>Mark shipped</button>
                        )}
                        {o.status === 'shipped' && (
                          <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => run(o, () => setOrderStatus(o._id, 'delivered'))}>
                            {o.payment?.provider === 'cod' ? 'Delivered & cash received' : 'Mark delivered'}
                          </button>
                        )}
                        {['paid', 'placed', 'pending_payment'].includes(o.status) && (
                          <button className="btn btn-outline btn-sm btn-danger" disabled={busy} onClick={() => cancel(o)}>
                            {o.status === 'paid' ? 'Cancel & refund' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="row-details">
                        <td colSpan={6}>
                          <div className="order-details">
                            <ul className="order-items order-items-sm">
                              {o.items.map((i) => (
                                <li key={`${i.product}|${i.size}`}>
                                  <img src={thumb(i.image, 100)} alt="" />
                                  <div><strong>{i.name}</strong><span className="muted block">{i.color} · Size {i.size} · Qty {i.quantity}</span></div>
                                  <span>{formatPrice(i.price * i.quantity)}</span>
                                </li>
                              ))}
                            </ul>
                            <address className="address">
                              <strong>Ship to</strong><br />
                              {o.shippingAddress.fullName}<br />{o.shippingAddress.street}<br />
                              {o.shippingAddress.city} {o.shippingAddress.postalCode}<br />{o.shippingAddress.country}<br />{o.shippingAddress.phone}
                            </address>
                          </div>
                          {o.status === 'cancelled' && o.cancellation?.reason && (
                            <div className="cancel-box">
                              <strong>Cancelled by {o.cancellation.by === 'admin' ? 'an admin' : 'the customer'}</strong>
                              {o.cancelledAt && ` on ${formatDate(o.cancelledAt)}`}
                              <span className="block">Reason: {o.cancellation.reason}</span>
                              {o.cancellation.note && <span className="block">“{o.cancellation.note}”</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {orders && shown.length === 0 && <p className="empty-row">No orders here yet.</p>}
          {!orders && !error && <p className="empty-row">Loading…</p>}
        </div>
      </section>

      {cancelling && (
        <CancelDialog
          order={cancelling}
          // your own order → customer reasons; someone else's → admin reasons (same rule as the server)
          who={cancelling.user?._id === me._id ? 'customer' : 'admin'}
          onConfirm={confirmCancel}
          onClose={() => setCancelling(null)}
        />
      )}
    </>
  );
}
