// Starts the API for the end-to-end browser tests (client: npm run test:e2e).
// It uses a fresh in-memory MongoDB filled with the 25 sample products and one admin account,
// so your real database is never touched. Everything is thrown away when it stops.
// Only the Stripe secret key is read from server/.env (if present), for the card payment test.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.E2E_API_PORT) || 5181;
const ADMIN = { name: 'Test Admin', email: 'admin@e2e.test', password: 'password123', role: 'admin' };

const envFile = path.join(__dirname, '..', '.env');
const stripeKey = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)).STRIPE_SECRET_KEY : '';
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.STRIPE_SECRET_KEY = stripeKey?.startsWith('sk_test_') ? stripeKey : ''; // never a live key
delete process.env.CLIENT_URL; // allow the test frontend's origin

const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const samples = require('../data/seed-products');

async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Product.init(), Order.init()]);

  for (const sample of samples) await Product.create(sample);
  await User.create(ADMIN);

  const server = app.listen(PORT, () => {
    console.log(`E2E API on http://localhost:${PORT} (${samples.length} products, card payments ${process.env.STRIPE_SECRET_KEY ? 'on' : 'off'})`);
  });

  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('E2E server failed to start:', err);
  process.exit(1);
});
