import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from './Icons';
import Logo from './Logo';
import { CATEGORIES } from '../catalog';

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Menus remember the page they were opened on, so they close by themselves when the page changes
  const [menuAt, setMenuAt] = useState(null);
  const [accountAt, setAccountAt] = useState(null);
  const menuOpen = menuAt === location.key;
  const accountOpen = accountAt === location.key;
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const accountRef = useRef(null);

  // Close the account menu when clicking anywhere else
  useEffect(() => {
    if (!accountOpen) return undefined;
    const close = (e) => !accountRef.current?.contains(e.target) && setAccountAt(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [accountOpen]);

  const activeCategory = location.pathname === '/shop' ? searchParams.get('category') : null;

  const submitSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  return (
    <header className="site-header">
      <div className="announcement">Free shipping on orders over €100 · Easy 30-day returns</div>
      <div className="container header-inner">
        <button className="icon-btn menu-toggle" onClick={() => setMenuAt(location.key)} aria-label="Open menu">
          <MenuIcon />
        </button>

        <Logo />

        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
          <div className="main-nav-top">
            <Logo />
            <button className="icon-btn" onClick={() => setMenuAt(null)} aria-label="Close menu">
              <CloseIcon />
            </button>
          </div>
          <NavLink to="/shop" end className={() => `nav-link ${location.pathname === '/shop' && !activeCategory ? 'active' : ''}`}>
            New in
          </NavLink>
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/shop?category=${c}`} className={`nav-link ${activeCategory === c ? 'active' : ''}`}>
              {c}
            </Link>
          ))}
          {isAdmin && <Link to="/admin" className="nav-link nav-admin">Admin</Link>}
        </nav>
        {menuOpen && <div className="backdrop" onClick={() => setMenuAt(null)} />}

        <div className="header-actions">
          <form className="header-search" onSubmit={submitSearch} role="search">
            <SearchIcon size={18} />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </form>

          <div className="account" ref={accountRef}>
            {user ? (
              <button className="icon-btn" onClick={() => setAccountAt(accountOpen ? null : location.key)} aria-label="Account menu" aria-expanded={accountOpen}>
                <UserIcon />
              </button>
            ) : (
              <Link to="/login" className="icon-btn" aria-label="Log in"><UserIcon /></Link>
            )}
            {accountOpen && user && (
              <div className="dropdown">
                <p className="dropdown-name">{user.name}</p>
                <p className="dropdown-email">{user.email}</p>
                <Link to="/account" className="dropdown-item">My account</Link>
                <Link to="/orders" className="dropdown-item">My orders</Link>
                {isAdmin && <Link to="/admin" className="dropdown-item">Admin panel</Link>}
                <button className="dropdown-item" onClick={() => { logout(); navigate('/'); }}>Log out</button>
              </div>
            )}
          </div>

          <Link to="/cart" className="icon-btn cart-btn" aria-label={`Cart, ${count} items`}>
            <BagIcon />
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
