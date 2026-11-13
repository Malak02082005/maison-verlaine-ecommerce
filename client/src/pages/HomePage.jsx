import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getProducts } from '../api';
import ProductCard from '../components/ProductCard';
import { ArrowRightIcon, RefreshIcon, ShieldIcon, TruckIcon } from '../components/Icons';

// Product photos from the Maison Verlaine package (client/public/products), used as delivered
const photo = (file) => `/products/${file}.jpg`;

const CATEGORY_TILES = [
  { name: 'Bags', text: 'Totes, clutches & mini bags', image: photo('mv-top-handle') },
  { name: 'Coats', text: 'Coats, jackets & blazers', image: photo('mv-trench') },
  { name: 'Accessories', text: 'Scarves, watches & leather goods', image: photo('mv-scarf') },
  { name: 'Jewelry', text: 'Rings & necklaces', image: photo('mv-signet-ring') },
];

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [newest, setNewest] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getProducts({ featured: 1, limit: 8 }), getProducts({ sort: 'newest', limit: 16 })])
      .then(([f, n]) => {
        setFeatured(f.products);
        // New arrivals: the newest products that aren't already shown as signature pieces
        setNewest(n.products.filter((p) => !p.featured).slice(0, 4));
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      {/* ----- hero ----- */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <p className="eyebrow">The atelier collection</p>
            <h1>Made to last.</h1>
            <p className="hero-sub">
              Leather bags, tailored coats and refined accessories, finished by hand in our atelier.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-dark btn-lg">Shop the collection <ArrowRightIcon size={18} /></Link>
            </div>
          </div>
          <div className="hero-image">
            <img src={photo('mv-top-handle')} alt="The Signature Top-Handle Bag in black leather" />
          </div>
        </div>
      </section>

      {/* ----- perks ----- */}
      <section className="container perks">
        <div className="perk"><TruckIcon /><div><strong>Free shipping</strong><span>On orders over €100</span></div></div>
        <div className="perk"><RefreshIcon /><div><strong>30-day returns</strong><span>Changed your mind? No problem</span></div></div>
        <div className="perk"><ShieldIcon /><div><strong>Secure checkout</strong><span>Pay by card or cash on delivery</span></div></div>
      </section>

      {/* ----- categories ----- */}
      <section className="container section">
        <div className="section-head">
          <h2>Shop by category</h2>
        </div>
        <div className="category-grid">
          {CATEGORY_TILES.map((c) => (
            <Link key={c.name} to={`/shop?category=${c.name}`} className="category-tile">
              <div className="category-tile-image"><img src={c.image} alt="" loading="lazy" /></div>
              <h3>{c.name}</h3>
              <p>{c.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {error && <div className="container"><div className="alert alert-error">{error}</div></div>}

      {/* ----- featured ----- */}
      {featured.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Signature pieces</h2>
            <Link to="/shop" className="link-arrow">View all <ArrowRightIcon size={16} /></Link>
          </div>
          <div className="product-grid">
            {featured.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      {/* ----- banner ----- */}
      <section className="container section">
        <div className="promo">
          <div className="promo-text">
            <p className="eyebrow">Accessories</p>
            <h2>The finishing touch.</h2>
            <p>Silk scarves, watches and small leather goods to complete every look.</p>
            <Link to="/shop?category=Accessories" className="btn btn-light">Shop accessories</Link>
          </div>
          <img src={photo('mv-watch-rosegold')} alt="" loading="lazy" />
        </div>
      </section>

      {/* ----- new arrivals ----- */}
      {newest.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>New arrivals</h2>
            <Link to="/shop?sort=newest" className="link-arrow">See more <ArrowRightIcon size={16} /></Link>
          </div>
          <div className="product-grid">
            {newest.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </>
  );
}
