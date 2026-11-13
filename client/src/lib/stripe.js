import { loadStripe } from '@stripe/stripe-js';

// Stripe's publishable key (pk_test_...) is safe to have in the browser; the secret key never is.
const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const paymentsConfigured = Boolean(key);
export const stripePromise = key ? loadStripe(key) : null;

// Matches Stripe's card form to the shop's look
export const stripeAppearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#1c1917',
    colorText: '#1c1917',
    borderRadius: '10px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
};
