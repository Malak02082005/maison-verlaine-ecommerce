import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { confirmPayment } from '../api';
import { stripeAppearance, stripePromise } from '../lib/stripe';
import { LockIcon } from './Icons';
import { formatPrice } from '../utils';

// Stripe's card form for one order. When the payment succeeds, the server double-checks it
// with Stripe and marks the order as paid; then onPaid(order) is called.
export default function PaymentForm({ order, clientSecret, onPaid }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
      <CardForm order={order} onPaid={onPaid} />
    </Elements>
  );
}

function CardForm({ order, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError('');

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // cards are handled on this page; only redirect if a bank requires it
      confirmParams: { return_url: `${window.location.origin}/orders/${order._id}` },
    });

    if (result.error) {
      setError(result.error.message || 'The payment didn’t go through. Please try again.');
      setPaying(false);
      return;
    }
    try {
      onPaid(await confirmPayment(order._id));
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <div className="test-card">
        <strong>Test mode:</strong> use card <code>4242 4242 4242 4242</code>, any future date and any 3-digit CVC.
        No real money is charged.
      </div>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-dark btn-lg btn-block" disabled={!stripe || paying}>
        <LockIcon size={17} /> {paying ? 'Processing…' : `Pay ${formatPrice(order.total)}`}
      </button>
    </form>
  );
}
