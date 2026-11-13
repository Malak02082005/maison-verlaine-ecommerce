import { useState } from 'react';
import { Link } from 'react-router';
import { changePassword, updateMe } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// /account: edit your name and email, and change your password
export default function AccountPage() {
  const { user, updateUser } = useAuth();

  return (
    <div className="container account-page">
      <h1>My account</h1>
      <p className="muted">
        Member since {formatDate(user.createdAt)} · <Link to="/orders" className="link-btn">View my orders</Link>
      </p>
      <div className="account-grid">
        <DetailsForm user={user} onSaved={updateUser} />
        <PasswordForm />
      </div>
    </div>
  );
}

function DetailsForm({ user, onSaved }) {
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [message, setMessage] = useState(null); // { type, text }
  const [saving, setSaving] = useState(false);

  const emailError = form.email && !EMAIL_REGEX.test(form.email.trim()) ? 'Please enter a valid email' : '';
  const unchanged = form.name.trim() === user.name && form.email.trim().toLowerCase() === user.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (emailError) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateMe({ name: form.name, email: form.email });
      onSaved(saved);
      setForm({ name: saved.name, email: saved.email });
      setMessage({ type: 'success', text: 'Your details have been saved' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Your details</h2>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label>Full name
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" required />
        </label>
        <label>Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            className={emailError ? 'invalid' : ''}
            required
          />
          {emailError && <span className="field-error">{emailError}</span>}
        </label>
        <button className="btn btn-dark" disabled={saving || unchanged || !form.name.trim() || !!emailError}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const tooShort = form.next && form.next.length < 8 ? 'At least 8 characters' : '';
  const mismatch = form.repeat && form.repeat !== form.next ? 'The passwords don’t match' : '';
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tooShort || mismatch) return;
    setSaving(true);
    setMessage(null);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', repeat: '' });
      setMessage({ type: 'success', text: 'Your password has been changed' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Change password</h2>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label>Current password
          <input type="password" value={form.current} onChange={set('current')} autoComplete="current-password" required />
        </label>
        <label>New password
          <input type="password" value={form.next} onChange={set('next')} autoComplete="new-password" className={tooShort ? 'invalid' : ''} required />
          {tooShort && <span className="field-error">{tooShort}</span>}
        </label>
        <label>Repeat new password
          <input type="password" value={form.repeat} onChange={set('repeat')} autoComplete="new-password" className={mismatch ? 'invalid' : ''} required />
          {mismatch && <span className="field-error">{mismatch}</span>}
        </label>
        <button className="btn btn-dark" disabled={saving || !form.current || !form.next || form.repeat !== form.next || !!tooShort}>
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}
