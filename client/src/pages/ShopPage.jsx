import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getFilters, getProducts } from '../api';
import ProductCard from '../components/ProductCard';
import CheckboxFilter from '../components/CheckboxFilter';
import { CloseIcon, FilterIcon } from '../components/Icons';
import { CATEGORIES } from '../catalog';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];
const PAGE_SIZE = 12;
const FILTER_KEYS = ['category', 'type', 'size', 'color', 'minPrice', 'maxPrice', 'search'];

// /shop?category=Bags&type=Totes&size=M&color=Black&minPrice=20&maxPrice=100&sort=price_asc&page=2
// All filters live in the URL, so a filtered page can be shared, bookmarked or refreshed.
export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState({ products: [], total: 0, pages: 1 });
  const [options, setOptions] = useState(null); // what can be filtered on
  const [loadedKey, setLoadedKey] = useState(null); // which filters the shown results belong to
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile filter drawer

  const get = (key) => params.get(key) || '';
  const category = get('category');
  const page = Number(get('page')) || 1;
  const query = Object.fromEntries(
    [...FILTER_KEYS, 'sort'].map((k) => [k, get(k)]).concat([['page', page], ['limit', PAGE_SIZE]])
  );
  const queryKey = JSON.stringify(query);
  const loading = loadedKey !== queryKey;

  // Filter options (colours, sizes, price range) follow the chosen category
  useEffect(() => {
    getFilters(category).then(setOptions).catch(() => {});
  }, [category]);

  useEffect(() => {
    let current = true;
    getProducts(JSON.parse(queryKey))
      .then((data) => current && (setResult(data), setError('')))
      .catch((err) => current && setError(err.message))
      .finally(() => current && setLoadedKey(queryKey));
    return () => {
      current = false; // ignore answers that arrive after the filters changed again
    };
  }, [queryKey]);

  // Changes some filters and goes back to page 1
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  // Multi-select filters (size, colour, type) are stored comma-separated
  const listOf = (key) => get(key).split(',').filter(Boolean);
  const toggle = (key, value) => {
    const list = listOf(key);
    update({ [key]: (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]).join(',') });
  };

  const clearAll = () => setParams(get('sort') ? { sort: get('sort') } : {});
  const activeCount = FILTER_KEYS.filter((k) => get(k)).length;

  const types = category ? options?.types[category] || [] : [...new Set(Object.values(options?.types || {}).flat())].sort();
  const title = get('search') ? `Results for “${get('search')}”` : category || 'The collection';

  const filters = (
    <>
      <div className="filter-group">
        <h4>Category</h4>
        <div className="chip-row">
          <button className={`chip ${!category ? 'active' : ''}`} onClick={() => update({ category: '', type: '' })}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => update({ category: c, type: '' })}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {types.length > 0 && (
        <CheckboxFilter title="Type" options={types} selected={listOf('type')} onToggle={(t) => toggle('type', t)} />
      )}

      {options?.sizes?.length > 0 && (
        <div className="filter-group">
          <h4>Size <span className="filter-hint">(in stock)</span></h4>
          <div className="chip-row">
            {options.sizes.map((s) => (
              <button key={s} className={`chip chip-size ${listOf('size').includes(s) ? 'active' : ''}`} onClick={() => toggle('size', s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {options?.colors?.length > 0 && (
        <CheckboxFilter title="Colour" options={options.colors} selected={listOf('color')} onToggle={(c) => toggle('color', c)} />
      )}

      <div className="filter-group">
        <h4>Price (€)</h4>
        <form
          className="price-range"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            update({ minPrice: form.get('minPrice'), maxPrice: form.get('maxPrice') });
          }}
          key={`${get('minPrice')}-${get('maxPrice')}`}
        >
          <input name="minPrice" type="number" min="0" placeholder={options ? `${Math.floor(options.minPrice)}` : 'Min'} defaultValue={get('minPrice')} aria-label="Minimum price" />
          <span>–</span>
          <input name="maxPrice" type="number" min="0" placeholder={options ? `${Math.ceil(options.maxPrice)}` : 'Max'} defaultValue={get('maxPrice')} aria-label="Maximum price" />
          <button className="btn btn-outline btn-sm">Go</button>
        </form>
      </div>

      {activeCount > 0 && <button className="link-btn" onClick={clearAll}>Clear all filters</button>}
    </>
  );

  return (
    <div className="container shop">
      <div className="shop-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{loading ? 'Loading…' : `${result.total} ${result.total === 1 ? 'product' : 'products'}`}</p>
        </div>
        <div className="shop-tools">
          <button className="btn btn-outline btn-sm filter-toggle" onClick={() => setFiltersOpen(true)}>
            <FilterIcon size={16} /> Filters{activeCount > 0 && ` (${activeCount})`}
          </button>
          <select className="select" value={get('sort') || 'newest'} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="Sort by">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="shop-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <div className="filters-top">
            <h3>Filters</h3>
            <button className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><CloseIcon /></button>
          </div>
          {filters}
          <button className="btn btn-dark btn-block filters-done" onClick={() => setFiltersOpen(false)}>
            Show {result.total} {result.total === 1 ? 'product' : 'products'}
          </button>
        </aside>
        {filtersOpen && <div className="backdrop" onClick={() => setFiltersOpen(false)} />}

        <section>
          {error && <div className="alert alert-error">{error}</div>}
          {!loading && result.products.length === 0 && !error ? (
            <div className="empty-state">
              <h3>No products found</h3>
              <p>Try removing a filter or searching for something else.</p>
              {activeCount > 0 && <button className="btn btn-dark" onClick={clearAll}>Clear filters</button>}
            </div>
          ) : (
            <div className={`product-grid product-grid-3 ${loading ? 'is-loading' : ''}`}>
              {result.products.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          )}

          {result.pages > 1 && (
            <nav className="pagination" aria-label="Pages">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => update({ page: n })} aria-current={n === page ? 'page' : undefined}>
                  {n}
                </button>
              ))}
              <button className="btn btn-outline btn-sm" disabled={page >= result.pages} onClick={() => update({ page: page + 1 })}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
