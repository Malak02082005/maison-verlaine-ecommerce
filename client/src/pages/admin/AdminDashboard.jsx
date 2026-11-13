import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getAdminStats } from '../../api';
import StatusBadge from '../../components/StatusBadge';
import { ORDER_STATUS, formatDate, formatPrice, orderNumber, thumb } from '../../utils';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminStats().then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <p className="muted">Loading…</p>;

  // Ready to ship: paid card orders + cash-on-delivery orders
  const toShip = (stats.ordersByStatus.paid || 0) + (stats.ordersByStatus.placed || 0);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">How the shop is doing.</p>
        </div>
        <Link to="/admin/products/new" className="btn btn-dark">Add product</Link>
      </div>

      <div className="stat-grid">
        <div className="stat stat-dark">
          <span>Revenue</span>
          <strong>{formatPrice(stats.revenue)}</strong>
          <small>From {stats.paidOrders} paid {stats.paidOrders === 1 ? 'order' : 'orders'}</small>
        </div>
        <Link to="/admin/orders" className="stat">
          <span>Ready to ship</span>
          <strong>{toShip}</strong>
          <small>Paid and cash-on-delivery orders</small>
        </Link>
        <Link to="/admin/inventory" className="stat">
          <span>Products</span>
          <strong>{stats.productCount}</strong>
          <small>{stats.lowStock.length} running low</small>
        </Link>
        <Link to="/admin/customers" className="stat">
          <span>Customers</span>
          <strong>{stats.customerCount}</strong>
          <small>Registered accounts</small>
        </Link>
      </div>

      <div className="admin-grid">
        <section className="card">
          <div className="card-head">
            <h2>Recent orders</h2>
            <Link to="/admin/orders" className="link-btn">View all</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ul className="mini-list">
              {stats.recentOrders.map((o) => (
                <li key={o._id}>
                  <div>
                    <strong>{orderNumber(o._id)}</strong>
                    <span className="muted">{o.user?.name || 'Deleted account'} · {formatDate(o.createdAt)}</span>
                  </div>
                  <StatusBadge status={o.status} />
                  <strong>{formatPrice(o.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Orders by status</h2>
          <ul className="status-bars">
            {Object.keys(ORDER_STATUS).map((s) => {
              const n = stats.ordersByStatus[s] || 0;
              const max = Math.max(...Object.values(stats.ordersByStatus), 1);
              return (
                <li key={s}>
                  <Link to={`/admin/orders?status=${s}`} className="status-bar-row">
                    <span>{ORDER_STATUS[s].label}</span>
                    <span className="muted">{n}</span>
                  </Link>
                  <div className={`progress progress-${ORDER_STATUS[s].tone}`}><span style={{ width: `${(n / max) * 100}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2>Best sellers</h2>
          {stats.bestSellers.length === 0 ? (
            <p className="muted">Nothing sold yet.</p>
          ) : (
            <ul className="mini-list">
              {stats.bestSellers.map((p) => (
                <li key={p._id}>
                  <img src={thumb(p.image, 100)} alt="" className="mini-thumb" />
                  <div><strong>{p.name}</strong></div>
                  <span className="muted">{p.sold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Low stock <span className="muted">({stats.lowStockLimit} or fewer in a size)</span></h2>
          {stats.lowStock.length === 0 ? (
            <p className="muted">Everything is well stocked.</p>
          ) : (
            <ul className="mini-list">
              {stats.lowStock.map((p) => (
                <li key={p._id}>
                  <img src={thumb(p.images[0], 100)} alt="" className="mini-thumb" />
                  <div>
                    <Link to={`/admin/products/${p._id}/edit`}><strong>{p.name}</strong></Link>
                    <span className="muted">
                      {p.sizes.filter((s) => s.stock <= stats.lowStockLimit).map((s) => `${s.size}: ${s.stock}`).join(' · ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Why orders are cancelled</h2>
            <Link to="/admin/orders?status=cancelled" className="link-btn">See cancelled orders</Link>
          </div>
          {stats.cancelReasons.length === 0 ? (
            <p className="muted">No cancelled orders yet.</p>
          ) : (
            <ul className="status-bars">
              {stats.cancelReasons.map((r) => {
                const max = Math.max(...stats.cancelReasons.map((x) => x.count));
                return (
                  <li key={`${r.by}|${r.reason}`}>
                    <div className="status-bar-row">
                      <span>{r.reason} <span className="muted">· {r.by === 'admin' ? 'admin' : 'customer'}</span></span>
                      <span className="muted">{r.count}</span>
                    </div>
                    <div className="progress progress-muted"><span style={{ width: `${(r.count / max) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
