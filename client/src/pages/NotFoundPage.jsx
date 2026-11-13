import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="container narrow-page">
      <div className="empty-state">
        <p className="eyebrow">404</p>
        <h3>This page doesn’t exist</h3>
        <p>It may have moved, or the link might be wrong.</p>
        <Link to="/" className="btn btn-dark">Go to the home page</Link>
      </div>
    </div>
  );
}
