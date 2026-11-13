import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createProduct, getCatalog, getProduct, updateProduct } from '../../api';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { formatPrice } from '../../utils';

const EMPTY = {
  name: '', description: '', category: '', type: '', color: '', price: '',
  images: [''], sizes: [{ size: '', stock: '' }], featured: false,
};

// Quick ways to fill in the size list
const PRESETS = {
  'Coats (XS–XL)': ['XS', 'S', 'M', 'L', 'XL'],
  'One size': ['One Size'],
};

// /admin/products/new and /admin/products/:id/edit
export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getCatalog(), isEdit ? getProduct(id) : null])
      .then(([c, p]) => {
        setCatalog(c);
        if (p) {
          setForm({
            name: p.name, description: p.description, category: p.category, type: p.type, color: p.color,
            price: String(p.price), images: p.images.length ? p.images : [''],
            sizes: p.sizes.map((s) => ({ size: s.size, stock: String(s.stock) })), featured: p.featured,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  if (loading) return <p className="muted">Loading…</p>;

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setListItem = (field, index, value) =>
    setForm((f) => ({ ...f, [field]: f[field].map((item, i) => (i === index ? value : item)) }));
  const removeListItem = (field, index) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }));

  const types = catalog?.types[form.category] || [];
  const usedSizes = form.sizes.map((s) => s.size);

  const applyPreset = (sizes) => {
    const existing = Object.fromEntries(form.sizes.map((s) => [s.size, s.stock]));
    set('sizes', sizes.map((size) => ({ size, stock: existing[size] ?? '0' })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const data = {
      ...form,
      price: Number(form.price),
      images: form.images.map((u) => u.trim()).filter(Boolean),
      sizes: form.sizes.filter((s) => s.size).map((s) => ({ size: s.size, stock: Number(s.stock) || 0 })),
    };
    try {
      const saved = isEdit ? await updateProduct(id, data) : await createProduct(data);
      navigate('/admin/products', { state: { flash: `${isEdit ? 'Updated' : 'Added'} ${saved.name}` } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
      window.scrollTo(0, 0);
    }
  };

  const preview = form.images.find((u) => u.trim());

  return (
    <>
      <Link to="/admin/products" className="back-link"><ArrowLeftIcon size={16} /> All products</Link>
      <div className="admin-head">
        <h1>{isEdit ? 'Edit product' : 'Add product'}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="product-form-main">
          <section className="card form">
            <h2>Details</h2>
            <label>Name
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
            </label>
            <label>Description
              <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} required maxLength={2000} />
            </label>
            <div className="row row-3">
              <label>Category
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, type: '' }))} required>
                  <option value="" disabled>Choose…</option>
                  {catalog?.categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Type
                <select value={form.type} onChange={(e) => set('type', e.target.value)} disabled={!form.category} required>
                  <option value="" disabled>{form.category ? 'Choose…' : 'Pick a category first'}</option>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Colour
                <input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. Navy" required maxLength={40} />
              </label>
            </div>
            <div className="row">
              <label>Price (EUR, incl. VAT)
                <input type="number" min="0.5" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} required />
              </label>
              <label className="check check-inline">
                <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                Show on the home page (featured)
              </label>
            </div>
          </section>

          <section className="card form">
            <div className="card-head">
              <h2>Sizes &amp; stock</h2>
              <div className="preset-row">
                {Object.entries(PRESETS).map(([label, sizes]) => (
                  <button key={label} type="button" className="chip" onClick={() => applyPreset(sizes)}>{label}</button>
                ))}
              </div>
            </div>
            {form.sizes.map((s, i) => (
              <div key={i} className="size-row">
                <select value={s.size} onChange={(e) => setListItem('sizes', i, { ...s, size: e.target.value })} aria-label="Size">
                  <option value="">Size…</option>
                  {catalog?.sizes.map((size) => (
                    <option key={size} value={size} disabled={usedSizes.includes(size) && size !== s.size}>{size}</option>
                  ))}
                </select>
                <input type="number" min="0" step="1" placeholder="Stock" value={s.stock} onChange={(e) => setListItem('sizes', i, { ...s, stock: e.target.value })} aria-label="Stock" />
                <button type="button" className="icon-btn" onClick={() => removeListItem('sizes', i)} disabled={form.sizes.length === 1} aria-label="Remove size"><TrashIcon size={17} /></button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => set('sizes', [...form.sizes, { size: '', stock: '' }])}>
              <PlusIcon size={15} /> Add a size
            </button>
          </section>

          <section className="card form">
            <h2>Photos</h2>
            <p className="form-hint">
              Paste image links (e.g. from Unsplash) or shop photos like <code>/products/name.jpg</code>. The first one is the main photo.
            </p>
            {form.images.map((url, i) => (
              <div key={i} className="size-row">
                <input type="text" placeholder="https://… or /products/….jpg" value={url} onChange={(e) => setListItem('images', i, e.target.value)} aria-label={`Image ${i + 1}`} />
                <button type="button" className="icon-btn" onClick={() => removeListItem('images', i)} disabled={form.images.length === 1} aria-label="Remove image"><TrashIcon size={17} /></button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => set('images', [...form.images, ''])}>
              <PlusIcon size={15} /> Add another photo
            </button>
          </section>
        </div>

        <aside className="product-form-side">
          <section className="card">
            <h3>Preview</h3>
            <div className="preview-image">
              {preview ? <img src={preview} alt="" /> : <span className="muted">No photo yet</span>}
            </div>
            <p className="preview-name">{form.name || 'Product name'}</p>
            <p className="muted">{[form.type, form.color].filter(Boolean).join(' · ') || 'Type · Colour'}</p>
            <p className="preview-price">{formatPrice(Number(form.price) || 0)}</p>
          </section>
          <button className="btn btn-dark btn-lg btn-block" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
          </button>
          <Link to="/admin/products" className="btn btn-outline btn-block">Cancel</Link>
        </aside>
      </form>
    </>
  );
}
