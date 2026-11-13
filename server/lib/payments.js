// Card payments through Stripe (TEST mode: fake cards only, no real money).
// Everything Stripe-related lives here, so the rest of the app doesn't depend on Stripe directly
// and the tests can swap these functions for fakes.
const Stripe = require('stripe');

let client = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error('Card payments aren’t set up yet: add STRIPE_SECRET_KEY to server/.env');
    err.status = 503;
    throw err;
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

const payments = {
  // Starts a payment for `amount` euros. Returns { id, clientSecret }: the browser uses the
  // client secret to show Stripe's card form and confirm the payment.
  async createPayment(amount, metadata) {
    const intent = await stripe().paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe works in cents
      currency: 'eur',
      metadata,
      // Which methods appear (card, MB WAY, …) is set in the Stripe Dashboard:
      // Settings → Payments → Payment methods. Stripe no longer allows choosing them in code.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    return { id: intent.id, clientSecret: intent.client_secret };
  },

  // Asks Stripe whether the payment went through. Returns { status, amount } (amount in euros).
  async getPayment(id) {
    const intent = await stripe().paymentIntents.retrieve(id);
    return { status: intent.status, amount: intent.amount / 100, clientSecret: intent.client_secret };
  },

  // Cancels a payment that hasn't been completed (e.g. the customer cancelled the order)
  async cancelPayment(id) {
    try {
      await stripe().paymentIntents.cancel(id);
    } catch {
      // already cancelled or completed: nothing to do
    }
  },

  // Gives the money back for a completed payment (an admin cancelled a paid order)
  async refundPayment(id) {
    await stripe().refunds.create({ payment_intent: id });
  },
};

module.exports = payments;
