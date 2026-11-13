import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProduct, getProducts } from '../api';
import { useCart } from '../context/CartContext';
import { MAX_PER_ITEM, itemKey } from '../context/cartItems';
import ProductCard from '../components/ProductCard';
import { CheckIcon, MinusIcon, PlusIcon, RefreshIcon, TruckIcon } from '../components/Icons';
import { formatPrice, thumb } from '../utils';

export default function ProductPage() {
  const { slug } = useParams();
  const { add, items } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState(null); // { type, text }

  useEffect(() => {
    getProduct(slug)
      .then((p) => {
        setProduct(p);
        // One-size products (and products with a single size in stock) are pre-selected
        const inStock = p.sizes.filter((s) => s.stock > 0);
        if (inStock.length === 1) setSize(inStock[0].size);
        return getProducts({ category: p.category, type: p.type, limit: 5 });
      })
      .then((r) => setRelated(r.products.filter((p) => p.slug !== slug).slice(0, 4)))
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h3>{error === 'Product not found' ? 'This product doesn’t exist' : error}</h3>
          <Link to="/shop" className="btn btn-dark">Back to the shop</Link>
        </div>
      </div>
    );
  }
  if (!product) return <div className="page-loading">Loading…</div>;

  const selected = product.sizes.find((s) => s.size === size);
  const inCart = items.find((i) => itemKey(i) === `${product._id}|${size}`)?.quantity || 0;
  const canAdd = selected ? Math.min(selected.stock, MAX_PER_ITEM) - inCart : 0;
  const soldOut = product.sizes.every((s) => s.stock === 0);

  const handleAdd = () => {
    if (!size) return setMessage({ type: 'error', text: 'Please choose a size' });
    const added = add(product, size, Math.min(quantity, canAdd));
    if (added > 0) {
      setMessage({ type: 'success', text: `Added ${added} × ${product.name} (${size}) to your cart` });
      setQuantity(1);
    } else {
      setMessage({ type: 'error', text: 'You already have all the available stock of this size in your cart' });
    }
  };

  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link> / <Link to={`/shop?category=${product.category}`}>{product.category}</Link> /{' '}
        <Link to={`/shop?category=${product.category}&type=${encodeURIComponent(product.type)}`}>{product.type}</Link>
      </nav>

      <div className="product-layout">
        {/* ----- photos ----- */}
        <div className="gallery">
          <div className="gallery-main">
            <img src={product.images[imageIndex]} alt={product.name} />
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbs">
              {product.images.map((img, i) => (
                <button key={img} className={`gallery-thumb ${i === imageIndex ? 'active' : ''}`} onClick={() => setImageIndex(i)} aria-label={`Photo ${i + 1}`}>
                  <img src={thumb(img, 200)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ----- details ----- */}
        <div className="product-info">
          <p className="eyebrow">{product.category} · {product.type}</p>
          <h1>{product.name}</h1>
          <p className="product-price">{formatPrice(product.price)}</p>
          <p className="product-desc">{product.description}</p>

          <div className="product-option">
            <span className="option-label">Colour: <strong>{product.color}</strong></span>
          </div>

          <div className="product-option">
            <span className="option-label">
              Size{size && <>: <strong>{size}</strong></>}
            </span>
            <div className="size-grid">
              {product.sizes.map((s) => (
                <button
                  key={s.size}
                  className={`size-btn ${size === s.size ? 'active' : ''}`}
                  disabled={s.stock === 0}
                  onClick={() => { setSize(s.size); setQuantity(1); setMessage(null); }}
                  title={s.stock === 0 ? 'Sold out' : `${s.stock} in stock`}
                >
                  {s.size}
                </button>
              ))}
            </div>
            {selected && selected.stock > 0 && selected.stock <= 5 && (
              <p className="stock-warning">
                Hurry, only {selected.stock} left{selected.size !== 'One Size' && ` in ${selected.size}`}
              </p>
            )}
          </div>

          {soldOut ? (
            <button className="btn btn-dark btn-lg btn-block" disabled>Sold out</button>
          ) : (
            <div className="buy-row">
              <div className="qty" aria-label="Quantity">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Fewer"><MinusIcon size={16} /></button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} disabled={!size || quantity >= canAdd} aria-label="More"><PlusIcon size={16} /></button>
              </div>
              <button className="btn btn-dark btn-lg buy-btn" onClick={handleAdd} disabled={Boolean(size) && canAdd <= 0}>
                {size && canAdd <= 0 ? 'All in your cart' : 'Add to cart'}
              </button>
            </div>
          )}

          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.type === 'success' && <CheckIcon size={16} />} {message.text}
              {message.type === 'success' && <Link to="/cart" className="alert-link">View cart</Link>}
            </div>
          )}

          <ul className="product-perks">
            <li><TruckIcon size={18} /> Free shipping on orders over €100</li>
            <li><RefreshIcon size={18} /> Free returns within 30 days</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>You may also like</h2></div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
