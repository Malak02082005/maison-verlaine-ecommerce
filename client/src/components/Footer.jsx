import { Link } from 'react-router';
import Logo from './Logo';
import { CATEGORIES } from '../catalog';

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="footer-text">Leather bags, tailored coats and refined accessories, finished by hand in our atelier. Built as an internship project.</p>
        </div>
        <div>
          <h4>Shop</h4>
          {CATEGORIES.map((c) => <Link key={c} to={`/shop?category=${c}`}>{c}</Link>)}
        </div>
        <div>
          <h4>Account</h4>
          <Link to="/account">My account</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/login">Log in</Link>
        </div>
        <div>
          <h4>Help</h4>
          <span>Free shipping over €100</span>
          <span>30-day returns</span>
          <span>Card or cash on delivery</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {YEAR} Maison Verlaine</span>
        <span>Payments run in Stripe test mode: no real money is charged.</span>
      </div>
    </footer>
  );
}
