import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

// Wrap pages that need a logged-in user (or an admin). Not allowed → login page / home page.
export default function RequireAuth({ admin = false, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
