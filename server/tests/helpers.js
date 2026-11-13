// Shared test setup: an in-memory MongoDB (your real database is never touched), helpers to
// create users and products, and a fake Stripe so no real payment service is called.
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const payments = require('../lib/payments');

let mongo;

async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Product.init(), Order.init()]); // build unique indexes
}

async function stopDb() {
  await mongoose.disconnect();
  await mongo.stop();
}

async function clearDb() {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
  fakeStripe.reset();
}

// ----- Fake Stripe: remembers payments in memory; tests decide whether they "succeed" -----
const fakeStripe = {
  payments: new Map(),
  calls: [],
  reset() {
    this.payments.clear();
    this.calls = [];
  },
  // Pretend the customer paid with a card
  pay(id) {
    this.payments.get(id).status = 'succeeded';
  },
};
payments.createPayment = async (amount, metadata) => {
  const id = `pi_test_${fakeStripe.payments.size + 1}`;
  fakeStripe.payments.set(id, { status: 'requires_payment_method', amount, metadata });
  return { id, clientSecret: `${id}_secret` };
};
payments.getPayment = async (id) => ({ ...fakeStripe.payments.get(id), clientSecret: `${id}_secret` });
payments.cancelPayment = async (id) => fakeStripe.calls.push(['cancel', id]);
payments.refundPayment = async (id) => fakeStripe.calls.push(['refund', id]);

// ----- Users and requests -----
async function createUser({ role = 'customer', email = `${role}@shop.test`, name = 'Test User' } = {}) {
  const user = await User.create({ name, email, password: 'password123', role });
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

// api(token).get('/api/...') → a supertest request that carries the login token
const api = (token) => {
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (url) => withAuth(request(app).get(url)),
    post: (url, body) => withAuth(request(app).post(url)).send(body),
    put: (url, body) => withAuth(request(app).put(url)).send(body),
    patch: (url, body) => withAuth(request(app).patch(url)).send(body),
    delete: (url) => withAuth(request(app).delete(url)),
  };
};

// ----- Products -----
const sampleProduct = (overrides = {}) => ({
  name: 'Linen Summer Dress',
  description: 'A light linen dress for warm days.',
  category: 'Coats',
  type: 'Coats',
  color: 'Beige',
  price: 49.99,
  images: ['https://example.com/dress.jpg'],
  sizes: [{ size: 'S', stock: 5 }, { size: 'M', stock: 2 }],
  ...overrides,
});
const createProduct = (overrides) => Product.create(sampleProduct(overrides));

const address = {
  fullName: 'Sara Ali',
  phone: '+20 100 123 4567',
  street: '12 Nile Street',
  city: 'Cairo',
  postalCode: '11511',
  country: 'Egypt',
};

module.exports = {
  startDb, stopDb, clearDb, fakeStripe, createUser, api, sampleProduct, createProduct, address, Product, Order,
};
