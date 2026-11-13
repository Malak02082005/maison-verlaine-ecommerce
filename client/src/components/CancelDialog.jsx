import { useEffect, useState } from 'react';
import { getCatalog } from '../api';
import { formatPrice, orderNumber } from '../utils';

// The reasons come from the server (GET /api/catalog), so they're defined in one place
let cachedReasons = null;

// Asks why an order is being cancelled before cancelling it.
//   who: "customer" (cancelling your own order) or "admin" (cancelling a customer's order)
//   onConfirm(reason, note) → Promise; throw to show an error in the dialog
export default function CancelDialog({ order, who, onConfirm, onClose }) {
  const [reasons, setReasons] = useState(cachedReasons);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cachedReasons) return;
    getCatalog()
      .then((c) => {
        cachedReasons = c.cancelReasons;
        setReasons(c.cancelReasons);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const needsNote = reason === 'Other';
  const refund = who === 'admin' && order.status === 'paid';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onConfirm(reason, note.trim());
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <form
        className="modal-card"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
      >
        <h2 id="cancel-title">Cancel order {orderNumber(order._id)}?</h2>
        <p className="muted">
          {who === 'customer' ? 'Please tell us why you’re cancelling. It helps us improve.' : 'Why is this order being cancelled?'}{' '}
          The items go back into stock{refund && `, and ${formatPrice(order.total)} is refunded to the customer`}.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {!reasons ? (
          <p className="muted">Loading…</p>
        ) : (
          <fieldset className="reason-list">
            <legend className="sr-only">Reason</legend>
            {reasons[who].map((r) => (
              <label key={r} className={`reason ${reason === r ? 'active' : ''}`}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                {r}
              </label>
            ))}
          </fieldset>
        )}

        <label className="reason-note">
          {needsNote ? 'Tell us a little more' : 'Anything else? (optional)'}
          <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Keep order
          </button>
          <button className="btn btn-dark btn-danger-fill" disabled={saving || !reason || (needsNote && !note.trim())}>
            {saving ? 'Cancelling…' : refund ? 'Cancel & refund' : 'Cancel order'}
          </button>
        </div>
      </form>
    </div>
  );
}
