import { Link } from 'react-router';
import { formatPrice, thumb, totalStock } from '../utils';

// A product in a grid. If it has a second (detail) photo, that one fades in on hover.
export default function ProductCard({ product }) {
  const stock = totalStock(product);
  const [main, detail] = product.images;
  return (
    <Link to={`/product/${product.slug}`} className="product-card">
      <div className={`product-card-image ${detail ? 'has-detail' : ''}`}>
        <img src={thumb(main, 600)} alt={product.name} loading="lazy" />
        {detail && <img src={thumb(detail, 600)} alt="" loading="lazy" className="product-card-detail" aria-hidden="true" />}
        {stock === 0 && <span className="badge badge-dark">Sold out</span>}
        {stock > 0 && stock <= 5 && <span className="badge">Only {stock} left</span>}
      </div>
      <div className="product-card-body">
        <p className="product-card-meta">{product.type} · {product.color}</p>
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
