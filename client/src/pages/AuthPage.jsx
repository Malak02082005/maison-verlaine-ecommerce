import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// One page for both "Log in" (/login) and "Create account" (/register)
export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Coming from "Create account": the new email is filled in already
  const justRegistered = !isRegister && Boolean(location.state?.registered);
  const [form, setForm] = useState({ name: '', email: location.state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // After logging in, go back to where the customer came from (e.g. the checkout)
  const from = location.state?.from?.pathname || '/';

  // Already logged in: say so (instead of silently leaving the page), and offer to switch account
  if (user) {
    if (saving) return null; // just logged in: on our way to the next page
    return (
      <div className="container auth-page">
        <div className="auth-card">
          <h1>You’re logged in</h1>
          <p className="muted">
            As <strong>{user.name}</strong> ({user.email}){user.role === 'admin' && ', an admin account'}.
          </p>
          <div className="auth-actions">
            <Link to={user.role === 'admin' ? '/admin' : '/'} className="btn btn-dark btn-lg btn-block">
              {user.role === 'admin' ? 'Go to the admin panel' : 'Continue shopping'}
            </Link>
            <button className="btn btn-outline btn-lg btn-block" onClick={logout}>
              Log out to use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const emailError = form.email && !EMAIL_REGEX.test(form.email.trim()) ? 'Please enter a valid email' : '';
  const passwordError = isRegister && form.password && form.password.length < 8 ? 'At least 8 characters' : '';

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (emailError || passwordError) return;
    setSaving(true);
    setError('');
    try {
      if (isRegister) {
        // Account created → go to the login page (keeping where the customer was heading, e.g. checkout)
        const created = await register(form);
        navigate('/login', { replace: true, state: { ...location.state, registered: true, email: created.email } });
        return;
      }
      const loggedIn = await login(form.email, form.password);
      const target = loggedIn.role === 'admin' && from === '/' ? '/admin' : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {isRegister ? 'Sign up to check out faster and track your orders.' : 'Log in to check out and see your orders.'}
        </p>

        {justRegistered && !error && (
          <div className="alert alert-success">Your account has been created. Log in to start shopping.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <form className="form" onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <label>Full name
              <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required />
            </label>
          )}
          <label>Email
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" className={emailError ? 'invalid' : ''} required />
            {emailError && <span className="field-error">{emailError}</span>}
          </label>
          <label>Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className={passwordError ? 'invalid' : ''}
              required
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
          </label>
          <button className="btn btn-dark btn-lg btn-block" disabled={saving || !form.email || !form.password || (isRegister && !form.name)}>
            {saving ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New here?'}{' '}
          <Link to={isRegister ? '/login' : '/register'} state={location.state}>
            {isRegister ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  );
}
