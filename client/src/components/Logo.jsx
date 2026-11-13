import { Link } from 'react-router';

export default function Logo({ to = '/', small = false }) {
  return (
    <Link to={to} className={`logo ${small ? 'logo-sm' : ''}`} aria-label="Maison Verlaine home">
      Maison Verlaine
    </Link>
  );
}
