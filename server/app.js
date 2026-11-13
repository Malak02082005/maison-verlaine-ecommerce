// The Express app (routes + middleware), without starting the server or connecting
// to the database. index.js starts it for real; the tests import it directly.
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { CATEGORIES, TYPES, SIZES, FREE_SHIPPING_FROM, SHIPPING_FEE, CANCEL_REASONS } = require('./data/catalog');

const app = express();

// In production, only the deployed frontend may call the API
// (CLIENT_URL can be a comma-separated list). Locally every origin is allowed.
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: '100kb' })); // parse JSON request bodies

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// The fixed lists (categories, product types, sizes) and shipping rules
app.get('/api/catalog', (req, res) =>
  res.json({
    categories: CATEGORIES,
    types: TYPES,
    sizes: SIZES,
    freeShippingFrom: FREE_SHIPPING_FROM,
    shippingFee: SHIPPING_FEE,
    cancelReasons: CANCEL_REASONS, // { customer: [...], admin: [...] }
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); // browsing is public; changes are admin-only
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

// Unknown routes
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Central error handler: turns errors into clean JSON responses
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const label = field === 'email' ? 'An account with this email' : `A record with this ${field || 'value'}`;
    return res.status(409).json({ message: `${label} already exists` });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message }); // e.g. Stripe not set up (503)
  }
  if (err.type?.startsWith('Stripe')) {
    console.error('Stripe error:', err.message);
    return res.status(502).json({ message: 'The payment service had a problem. Please try again.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

module.exports = app;
