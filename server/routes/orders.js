const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const payments = require('../lib/payments');
const { takeFromStock, returnToStock } = require('../lib/stock');
const { FREE_SHIPPING_FROM, SHIPPING_FEE, CANCEL_REASONS } = require('../data/catalog');

const router = express.Router(); // every route here requires a logged-in user (see app.js)

const roundMoney = (n) => Math.round(n * 100) / 100;
const MAX_QUANTITY = 10; // per size, per order

// Accept only known address fields
const pickAddress = ({ fullName, phone, street, city, postalCode, country } = {}) => ({
  fullName, phone, street, city, postalCode, country,
});

// Loads the order from :id. Customers can only see their own orders; admins can see all.
async function findOrder(req, res) {
  const order = await Order.findById(req.params.id);
  const allowed = order && (order.user.equals(req.user._id) || req.user.role === 'admin');
  if (!allowed) {
    res.status(404).json({ message: 'Order not found' });
    return null;
  }
  return order;
}

// Turns the cart sent by the browser into clean order lines. Prices always come from the
// database, never from the browser. Returns { lines } or { error }.
async function buildLines(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: 'Your cart is empty' };
  if (rawItems.length > 50) return { error: 'Too many different items in one order' };

  // Merge duplicate lines (same product + size)
  const merged = new Map();
  for (const item of rawItems) {
    const productId = String(item?.productId ?? '');
    const size = String(item?.size ?? '');
    const quantity = Number(item?.quantity);
    if (!mongoose.isValidObjectId(productId) || !size || !Number.isInteger(quantity) || quantity < 1) {
      return { error: 'Your cart contains an invalid item' };
    }
    const key = `${productId}|${size}`;
    merged.set(key, { productId, size, quantity: (merged.get(key)?.quantity || 0) + quantity });
  }

  const products = await Product.find({ _id: { $in: [...merged.values()].map((l) => l.productId) } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = [];
  for (const { productId, size, quantity } of merged.values()) {
    const product = byId.get(productId);
    if (!product) return { error: 'An item in your cart is no longer available' };
    const sizeEntry = product.sizes.find((s) => s.size === size);
    if (!sizeEntry) return { error: `${product.name} isn’t available in size ${size}` };
    if (quantity > MAX_QUANTITY) return { error: `You can order at most ${MAX_QUANTITY} of ${product.name} (${size})` };
    if (sizeEntry.stock < quantity) {
      return {
        error: sizeEntry.stock === 0
          ? `${product.name} (${size}) is sold out`
          : `Only ${sizeEntry.stock} left of ${product.name} (${size})`,
      };
    }
    lines.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images[0],
      color: product.color,
      size,
      price: product.price,
      quantity,
    });
  }
  return { lines };
}

// PLACE AN ORDER  →  POST /api/orders
// body: { items: [{ productId, size, quantity }], shippingAddress, paymentMethod: "card" | "cod" }
// Reserves the stock and creates the order.
//   card → status "pending_payment" + a Stripe payment; returns { order, clientSecret } and the
//          browser then confirms the card payment with Stripe.
//   cod  → cash on delivery: status "placed", nothing to pay now; returns { order, clientSecret: null }.
router.post('/', async (req, res) => {
  const paymentMethod = req.body?.paymentMethod ?? 'card';
  if (!['card', 'cod'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Please choose card or cash on delivery' });
  }
  const { lines, error } = await buildLines(req.body?.items);
  if (error) return res.status(400).json({ message: error });

  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const shippingFee = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const isCash = paymentMethod === 'cod';
  const order = new Order({
    user: req.user._id,
    items: lines,
    shippingAddress: pickAddress(req.body?.shippingAddress),
    subtotal,
    shippingFee,
    total: roundMoney(subtotal + shippingFee),
    status: isCash ? 'placed' : 'pending_payment',
    payment: { provider: isCash ? 'cod' : 'stripe' },
  });
  await order.validate(); // report a missing address before touching any stock

  // Reserve the stock line by line; if one fails, put back what was already taken
  const reserved = [];
  for (const line of lines) {
    if (!(await takeFromStock(line.product, line.size, line.quantity))) {
      await returnToStock(reserved);
      return res.status(409).json({ message: `${line.name} (${line.size}) just sold out. Please update your cart.` });
    }
    reserved.push(line);
  }

  try {
    await order.save();
    if (isCash) return res.status(201).json({ order, clientSecret: null });

    const payment = await payments.createPayment(order.total, { orderId: order._id.toString() });
    order.payment.paymentIntentId = payment.id;
    await order.save();
    res.status(201).json({ order, clientSecret: payment.clientSecret });
  } catch (err) {
    // Payment couldn't be started (e.g. Stripe isn't set up): undo everything
    await returnToStock(reserved);
    await Order.deleteOne({ _id: order._id });
    throw err;
  }
});

// MY ORDERS  →  GET /api/orders/mine   (newest first)
router.get('/mine', async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 });
  res.json(orders);
});

// ONE ORDER  →  GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const order = await findOrder(req, res);
  if (order) res.json(order);
});

// RESUME PAYMENT  →  GET /api/orders/:id/payment
// For an order that is still waiting for payment (e.g. the customer left the checkout page)
router.get('/:id/payment', async (req, res) => {
  const order = await findOrder(req, res);
  if (!order) return;
  if (order.status !== 'pending_payment') {
    return res.status(400).json({ message: 'This order doesn’t need a payment' });
  }
  const payment = await payments.getPayment(order.payment.paymentIntentId);
  res.json({ clientSecret: payment.clientSecret });
});

// CONFIRM PAYMENT  →  POST /api/orders/:id/confirm-payment
// Called after the card payment; the server checks with Stripe itself instead of trusting the browser.
router.post('/:id/confirm-payment', async (req, res) => {
  const order = await findOrder(req, res);
  if (!order) return;
  if (order.status !== 'pending_payment') return res.json(order); // already confirmed

  const payment = await payments.getPayment(order.payment.paymentIntentId);
  if (payment.status !== 'succeeded') {
    return res.status(400).json({ message: 'The payment hasn’t gone through yet' });
  }
  if (roundMoney(payment.amount) !== order.total) {
    return res.status(400).json({ message: 'The amount paid doesn’t match the order total' });
  }

  order.status = 'paid';
  order.payment.paidAt = new Date();
  await order.save();
  res.json(order);
});

// CANCEL  →  POST /api/orders/:id/cancel   body: { reason, note }
// Customers can cancel an order until it's paid (card) or shipped (cash on delivery); admins can
// also cancel paid card orders, which are refunded. The items go back into stock.
// A reason is required (from CANCEL_REASONS); "Other" also needs a short note.
router.post('/:id/cancel', async (req, res) => {
  const order = await findOrder(req, res);
  if (!order) return;

  const isAdmin = req.user.role === 'admin';
  // An admin cancelling someone else's order uses the admin reasons; your own order, the customer ones
  const by = isAdmin && !order.user.equals(req.user._id) ? 'admin' : 'customer';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!CANCEL_REASONS[by].includes(reason)) {
    return res.status(400).json({ message: 'Please choose a reason for cancelling' });
  }
  if (reason === 'Other' && !note) {
    return res.status(400).json({ message: 'Please tell us a little more about why you are cancelling' });
  }
  const cancellable = ['pending_payment', 'placed'].includes(order.status) || (isAdmin && order.status === 'paid');
  if (!cancellable) {
    const message = order.status === 'paid'
      ? 'This order is already paid. Please contact us to cancel it.'
      : `A ${order.status} order can’t be cancelled`;
    return res.status(400).json({ message });
  }

  // Card orders: refund a completed payment, or cancel an unfinished one. Cash orders: nothing to undo.
  if (order.payment.provider === 'stripe') {
    if (order.status === 'paid') await payments.refundPayment(order.payment.paymentIntentId);
    else await payments.cancelPayment(order.payment.paymentIntentId);
  }

  await returnToStock(order.items);
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancellation = { reason, note: note || undefined, by };
  await order.save();
  res.json(order);
});

module.exports = router;
