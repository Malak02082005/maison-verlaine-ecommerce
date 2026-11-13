import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getInventory, updateStock } from '../../api';
import { CATEGORIES } from '../../catalog';
import { formatPrice, plural, thumb } from '../../utils';

const STATUS = {
  in_stock: { label: 'In stock', tone: 'success' },
  low: { label: 'Low stock', tone: 'warn' },
  sold_out: { label: 'Sold out', tone: 'muted' },
};

// /admin/inventory: how much is left of every product (per size), what sold, and quick restocking
export default function AdminInventory() {
  const [data, setData] = useState(null); // { products, totals, lowStockLimit }
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState(''); // '' | 'low' | 'sold_out'
  const [edits, setEdits] = useState({}); // productId → { size: "new stock" }
  const [savingId, setSavingId] = useState(null);

  const load = () => getInventory().then(setData).catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  const setEdit = (productId, size, value) =>
    setEdits((e) => ({ ...e, [productId]: { ...e[productId], [size]: value } }));
  const resetEdits = (productId) =>
    setEdits((e) => {
      const next = { ...e };
      delete next[productId];
      return next;
    });

  // Sizes whose number was changed (and is a valid whole number)
  const changesFor = (row) =>
    row.sizes
      .filter((s) => edits[row._id]?.[s.size] !== undefined && edits[row._id][s.size] !== String(s.stock))
      .map((s) => ({ size: s.size, stock: Number(edits[row._id][s.size]) }));
  const invalid = (row) => changesFor(row).some((c) => !Number.isInteger(c.stock) || c.stock < 0);

  const save = async (row) => {
    setSavingId(row._id);
    setError('');
    try {
      await updateStock(row._id, changesFor(row));
      resetEdits(row._id);
      await load(); // refresh the row, the totals and the statuses
      setFlash(`Stock updated for ${row.name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const q = search.trim().toLowerCase();
  const shown = data.products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!status || p.status === status) &&
      (!q || `${p.name} ${p.type} ${p.color}`.toLowerCase().includes(q))
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Stock</h1>
          <p className="muted">How much is left of every product, size by size. Change a number and save to restock.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat stat-dark">
          <span>Units in stock</span>
          <strong>{data.totals.units}</strong>
          <small>Across {plural(data.products.length, 'product')}</small>
        </div>
        <div className="stat">
          <span>Stock value</span>
          <strong>{formatPrice(data.totals.value)}</strong>
          <small>At selling price</small>
        </div>
        <button type="button" className={`stat stat-button ${status === 'low' ? 'active' : ''}`} onClick={() => setStatus(status === 'low' ? '' : 'low')}>
          <span>Low stock</span>
          <strong>{data.totals.low}</strong>
          <small>A size with {data.lowStockLimit} or fewer left</small>
        </button>
        <button type="button" className={`stat stat-button ${status === 'sold_out' ? 'active' : ''}`} onClick={() => setStatus(status === 'sold_out' ? '' : 'sold_out')}>
          <span>Sold out</span>
          <strong>{data.totals.soldOut}</strong>
          <small>Nothing left in any size</small>
        </button>
      </div>

      {flash && <div className="alert alert-success">{flash}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="table-tools">
          <input className="input" type="search" placeholder="Search name, type or colour…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Stock status">
            <option value="">Any stock level</option>
            <option value="low">Low stock</option>
            <option value="sold_out">Sold out</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="table inventory-table">
            <thead>
              <tr><th>Product</th><th>Stock per size</th><th>In stock</th><th>Sold</th><th>Reserved</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const changed = changesFor(p).length > 0;
                return (
                  <tr key={p._id}>
                    <td>
                      <div className="table-product">
                        <img src={thumb(p.image, 100)} alt="" />
                        <div>
                          <Link to={`/admin/products/${p._id}/edit`} className="table-product-name">{p.name}</Link>
                          <span className="muted">{p.type} · {formatPrice(p.price)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stock-sizes">
                        {p.sizes.map((s) => {
                          const value = edits[p._id]?.[s.size] ?? String(s.stock);
                          const level = s.stock === 0 ? 'out' : s.stock <= data.lowStockLimit ? 'low' : '';
                          return (
                            <label key={s.size} className={`stock-size ${level}`} title={`${s.sold} sold · ${s.reserved} reserved`}>
                              <span>{s.size === 'One Size' ? 'Qty' : s.size}</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={value}
                                onChange={(e) => setEdit(p._id, s.size, e.target.value)}
                                aria-label={`${p.name}, size ${s.size}, stock`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <strong>{p.totalStock}</strong>
                      <span className={`status status-${STATUS[p.status].tone} block-status`}>{STATUS[p.status].label}</span>
                    </td>
                    <td>{p.sold}</td>
                    <td>{p.reserved > 0 ? p.reserved : <span className="muted">0</span>}</td>
                    <td className="table-actions">
                      {changed && (
                        <>
                          <button className="btn btn-dark btn-sm" disabled={savingId === p._id || invalid(p)} onClick={() => save(p)}>
                            {savingId === p._id ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => resetEdits(p._id)}>Undo</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="empty-row">No products match.</p>}
        </div>
        <p className="form-hint inventory-hint">
          <strong>Sold</strong> = units in orders that weren’t cancelled. <strong>Reserved</strong> = units held by orders
          still waiting for a card payment (they return to stock if the order is cancelled). Hover a size to see its numbers.
        </p>
      </section>
    </>
  );
}
