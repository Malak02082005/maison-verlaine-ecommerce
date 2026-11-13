import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import { BoxIcon, ChartIcon, GridIcon, LogoutIcon, StoreIcon, TagIcon, UserIcon } from '../../components/Icons';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="admin">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo to="/admin" small />
          <span className="admin-tag">Admin</span>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin" end className="admin-link"><GridIcon size={18} /> Dashboard</NavLink>
          <NavLink to="/admin/products" className="admin-link"><TagIcon size={18} /> Products</NavLink>
          <NavLink to="/admin/inventory" className="admin-link"><ChartIcon size={18} /> Stock</NavLink>
          <NavLink to="/admin/orders" className="admin-link"><BoxIcon size={18} /> Orders</NavLink>
          <NavLink to="/admin/customers" className="admin-link"><UserIcon size={18} /> Customers</NavLink>
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-link"><StoreIcon size={18} /> View shop</Link>
          <button className="admin-link" onClick={() => { logout(); navigate('/'); }}><LogoutIcon size={18} /> Log out</button>
          <p className="admin-user">{user.name}<span>{user.email}</span></p>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
