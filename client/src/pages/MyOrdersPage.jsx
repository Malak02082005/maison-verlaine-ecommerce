import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getMyOrders } from '../api';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatPrice, orderNumber, thumb } from '../utils';

export default function MyOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyOrders().then(setOrders).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="container orders-page">
      <h1>My orders</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {!orders && !error && <p className="muted">Loading…</p>}

      {orders?.length === 0 && (
        <div className="empty-state">
          <h3>No orders yet</h3>
          <p>When you place an order, you’ll be able to follow it here.</p>
          <Link to="/shop" className="btn btn-dark">Start shopping</Link>
        </div>
      )}

      <ul className="order-list">
        {orders?.map((o) => (
          <li key={o._id}>
            <Link to={`/orders/${o._id}`} className="order-row">
              <div className="order-thumbs">
                {o.items.slice(0, 3).map((i) => <img key={`${i.product}|${i.size}`} src={thumb(i.image, 120)} alt="" />)}
                {o.items.length > 3 && <span className="order-more">+{o.items.length - 3}</span>}
              </div>
              <div className="order-row-info">
                <strong>Order {orderNumber(o._id)}</strong>
                <span className="muted">
                  {formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                </span>
              </div>
              <StatusBadge status={o.status} />
              <strong className="order-row-total">{formatPrice(o.total)}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
