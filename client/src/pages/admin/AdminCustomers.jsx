import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getAdminUser, getAdminUsers, setUserRole } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatPrice, orderNumber, plural } from '../../utils';

// /admin/customers: every account, with orders and money spent; click a row to see their orders
export default function AdminCustomers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(''); // '' | 'customer' | 'admin'
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({}); // userId → { orders }
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getAdminUsers().then(setUsers).catch((err) => setError(err.message));
  }, []);

  const toggle = async (u) => {
    if (openId === u._id) return setOpenId(null);
    setOpenId(u._id);
    if (!details[u._id]) {
      try {
        const full = await getAdminUser(u._id);
        setDetails((d) => ({ ...d, [u._id]: full }));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const changeRole = async (u) => {
    const next = u.role === 'admin' ? 'customer' : 'admin';
    const question = next === 'admin'
      ? `Make ${u.name} an admin? They will be able to manage products, orders and customers.`
      : `Remove admin rights from ${u.name}?`;
    if (!window.confirm(question)) return;
    setBusyId(u._id);
    setError('');
    try {
      const updated = await setUserRole(u._id, next);
      setUsers((list) => list.map((x) => (x._id === u._id ? updated : x)));
      setFlash(next === 'admin' ? `${u.name} is now an admin` : `${u.name} is now a customer`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = (users || []).filter(
    (u) => (!role || u.role === role) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q))
  );
  const customers = (users || []).filter((u) => u.role === 'customer').length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Customers</h1>
          <p className="muted">{users ? `${plural(customers, 'customer')} · ${plural(users.length - customers, 'admin')}` : 'Loading…'}</p>
        </div>
      </div>

      {flash && <div className="alert alert-success">{flash}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="table-tools">
          <input className="input" type="search" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="">Everyone</option>
            <option value="customer">Customers</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Role</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const open = openId === u._id;
                const isMe = u._id === me._id;
                return (
                  <Fragment key={u._id}>
                    <tr className={open ? 'row-open' : ''}>
                      <td>
                        <button className="link-btn" onClick={() => toggle(u)} aria-expanded={open}>{u.name}</button>
                        {isMe && <span className="muted"> (you)</span>}
                        <span className="muted block">{u.email}</span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>{u.orderCount}<span className="muted block">{u.lastOrderAt ? `Last ${formatDate(u.lastOrderAt)}` : 'No orders'}</span></td>
                      <td>{formatPrice(u.totalSpent)}</td>
                      <td><span className={`status ${u.role === 'admin' ? 'status-accent' : 'status-muted'}`}>{u.role === 'admin' ? 'Admin' : 'Customer'}</span></td>
                      <td className="table-actions">
                        {!isMe && (
                          <button className="btn btn-outline btn-sm" disabled={busyId === u._id} onClick={() => changeRole(u)}>
                            {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="row-details">
                        <td colSpan={6}>
                          {!details[u._id] ? (
                            <p className="muted">Loading orders…</p>
                          ) : details[u._id].orders.length === 0 ? (
                            <p className="muted">{u.name} hasn’t ordered anything yet.</p>
                          ) : (
                            <ul className="mini-list customer-orders">
                              {details[u._id].orders.map((o) => (
                                <li key={o._id}>
                                  <div>
                                    <strong>{orderNumber(o._id)}</strong>
                                    <span className="muted">
                                      {formatDate(o.createdAt)} · {plural(o.items.reduce((n, i) => n + i.quantity, 0), 'item')} ·{' '}
                                      {o.payment?.provider === 'cod' ? 'Cash on delivery' : 'Card'}
                                    </span>
                                  </div>
                                  <StatusBadge status={o.status} />
                                  <strong>{formatPrice(o.total)}</strong>
                                </li>
                              ))}
                            </ul>
                          )}
                          <Link to="/admin/orders" className="link-btn">Manage orders</Link>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {users && shown.length === 0 && <p className="empty-row">No accounts match.</p>}
        </div>
      </section>
    </>
  );
}
