import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { deleteProduct, getProducts } from '../../api';
import { PlusIcon } from '../../components/Icons';
import { formatPrice, plural, thumb, totalStock } from '../../utils';
import { CATEGORIES } from '../../catalog';

export default function AdminProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [flash, setFlash] = useState(location.state?.flash || '');

  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true }); // don't show it again on refresh
    getProducts({ limit: 100, sort: 'newest' })
      .then((r) => setProducts(r.products))
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete “${product.name}”? Past orders keep their copy of it.`)) return;
    try {
      await deleteProduct(product._id);
      setProducts((list) => list.filter((p) => p._id !== product._id));
      setFlash(`Deleted ${product.name}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = (products || []).filter(
    (p) => (!category || p.category === category) && (!q || `${p.name} ${p.type} ${p.color}`.toLowerCase().includes(q))
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Products</h1>
          <p className="muted">{products ? `${plural(products.length, 'product')} in the shop` : 'Loading…'}</p>
        </div>
        <Link to="/admin/products/new" className="btn btn-dark"><PlusIcon size={18} /> Add product</Link>
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
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const stock = totalStock(p);
                const soldOutSizes = p.sizes.filter((s) => s.stock === 0).map((s) => s.size);
                return (
                  <tr key={p._id}>
                    <td>
                      <div className="table-product">
                        <img src={thumb(p.images[0], 100)} alt="" />
                        <div>
                          <Link to={`/product/${p.slug}`} className="table-product-name">{p.name}</Link>
                          <span className="muted">{p.color}{p.featured && ' · ★ Featured'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}<span className="muted block">{p.type}</span></td>
                    <td>{formatPrice(p.price)}</td>
                    <td>
                      <span className={stock === 0 ? 'text-danger' : stock <= 5 ? 'text-warn' : ''}>{stock} in stock</span>
                      {soldOutSizes.length > 0 && stock > 0 && <span className="muted block">Sold out: {soldOutSizes.join(', ')}</span>}
                    </td>
                    <td className="table-actions">
                      <Link to={`/admin/products/${p._id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                      <button className="btn btn-outline btn-sm btn-danger" onClick={() => handleDelete(p)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products && shown.length === 0 && <p className="empty-row">No products match.</p>}
        </div>
      </section>
    </>
  );
}
