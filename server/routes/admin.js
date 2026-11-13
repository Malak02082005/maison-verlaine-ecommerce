const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const router = express.Router(); // admin only (see app.js)

// Orders an admin can move forward, and the date field set at each step
// ("placed" = cash on delivery: ready to ship, paid when delivered)
const NEXT_STEP = {
  paid: { status: 'shipped', dateField: 'shippedAt' },
  placed: { status: 'shipped', dateField: 'shippedAt' },
  shipped: { status: 'delivered', dateField: 'deliveredAt' },
};

// ALL ORDERS  →  GET /api/admin/orders?status=paid   (newest first, with the customer's name/email)
router.get('/orders', async (req, res) => {
  const filter = {};
  if (typeof req.query.status === 'string' && Order.STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const orders = await Order.find(filter).sort({ createdAt: -1, _id: -1 }).populate('user', 'name email');
  res.json(orders);
});

// MOVE AN ORDER FORWARD  →  PATCH /api/admin/orders/:id/status   body: { status }
// paid / placed → shipped → delivered (cancelling is POST /api/orders/:id/cancel)
// Delivering a cash-on-delivery order also records the cash as received.
router.patch('/orders/:id/status', async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const step = NEXT_STEP[order.status];
  if (!step || req.body?.status !== step.status) {
    const allowed = step ? `It can only be marked as ${step.status}.` : 'Its status can’t be changed.';
    return res.status(400).json({ message: `This order is ${order.status.replace('_', ' ')}. ${allowed}` });
  }

  order.status = step.status;
  order[step.dateField] = new Date();
  if (order.status === 'delivered' && order.payment.provider === 'cod') order.payment.paidAt = order.deliveredAt;
  await order.save();
  await order.populate('user', 'name email');
  res.json(order);
});

// ---------------- Stock (inventory) ----------------

const LOW_STOCK_LIMIT = 3; // a size with this many or fewer left counts as "low"

// Stock per product and size, plus how many were sold and how many are reserved
// (sold = in orders that weren't cancelled; reserved = in orders still waiting for a card payment)
async function inventoryRows(productFilter = {}) {
  const products = await Product.find(productFilter).sort({ category: 1, name: 1 });
  const counts = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' }, 'items.product': { $in: products.map((p) => p._id) } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { product: '$items.product', size: '$items.size' },
        sold: { $sum: { $cond: [{ $eq: ['$status', 'pending_payment'] }, 0, '$items.quantity'] } },
        reserved: { $sum: { $cond: [{ $eq: ['$status', 'pending_payment'] }, '$items.quantity', 0] } },
      },
    },
  ]);
  const bySize = new Map(counts.map((c) => [`${c._id.product}|${c._id.size}`, c]));

  return products.map((p) => {
    const sizes = p.sizes.map((s) => {
      const c = bySize.get(`${p._id}|${s.size}`);
      return { size: s.size, stock: s.stock, sold: c?.sold || 0, reserved: c?.reserved || 0 };
    });
    const sum = (field) => sizes.reduce((n, s) => n + s[field], 0);
    const totalStock = sum('stock');
    let status = 'in_stock';
    if (totalStock === 0) status = 'sold_out';
    else if (sizes.some((s) => s.stock <= LOW_STOCK_LIMIT)) status = 'low';
    return {
      _id: p._id,
      name: p.name,
      slug: p.slug,
      image: p.images[0],
      category: p.category,
      type: p.type,
      color: p.color,
      price: p.price,
      sizes,
      totalStock,
      sold: sum('sold'),
      reserved: sum('reserved'),
      status,
    };
  });
}

// STOCK OVERVIEW  →  GET /api/admin/inventory
router.get('/inventory', async (req, res) => {
  const rows = await inventoryRows();
  res.json({
    lowStockLimit: LOW_STOCK_LIMIT,
    products: rows,
    totals: {
      units: rows.reduce((n, r) => n + r.totalStock, 0),
      value: Math.round(rows.reduce((n, r) => n + r.totalStock * r.price, 0) * 100) / 100,
      low: rows.filter((r) => r.status === 'low').length,
      soldOut: rows.filter((r) => r.status === 'sold_out').length,
    },
  });
});

// RESTOCK  →  PATCH /api/admin/products/:id/stock   body: { sizes: [{ size, stock }] }
// Sets the stock of existing sizes (adding or removing sizes is done in the product form)
router.patch('/products/:id/stock', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const changes = Array.isArray(req.body?.sizes) ? req.body.sizes : [];
  for (const change of changes) {
    const entry = product.sizes.find((s) => s.size === change?.size);
    if (!entry) return res.status(400).json({ message: `${product.name} has no size "${change?.size}"` });
    const stock = Number(change.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 10000) {
      return res.status(400).json({ message: 'Stock must be a whole number from 0 to 10,000' });
    }
    entry.stock = stock;
  }
  await product.save();
  const [row] = await inventoryRows({ _id: product._id });
  res.json(row);
});

// ---------------- Customers (user accounts) ----------------

// Per user: number of orders, money spent (orders actually paid) and last order date
async function orderSummaries(userIds) {
  const rows = await Order.aggregate([
    { $match: { user: { $in: userIds } } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
        spent: {
          $sum: {
            $cond: [{ $and: [{ $ne: ['$status', 'cancelled'] }, { $gt: ['$payment.paidAt', null] }] }, '$total', 0],
          },
        },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r]));
}

const withSummary = (user, summaries) => {
  const s = summaries.get(user._id.toString());
  return {
    ...user.toJSON(),
    orderCount: s?.orders || 0,
    totalSpent: Math.round((s?.spent || 0) * 100) / 100,
    lastOrderAt: s?.lastOrderAt || null,
  };
};

// ALL USERS  →  GET /api/admin/users?search=sara   (newest first)
router.get('/users', async (req, res) => {
  const filter = {};
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const users = await User.find(filter).sort({ createdAt: -1, _id: -1 });
  const summaries = await orderSummaries(users.map((u) => u._id));
  res.json(users.map((u) => withSummary(u, summaries)));
});

// ONE USER WITH THEIR ORDERS  →  GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const [summaries, orders] = await Promise.all([
    orderSummaries([user._id]),
    Order.find({ user: user._id }).sort({ createdAt: -1, _id: -1 }),
  ]);
  res.json({ ...withSummary(user, summaries), orders });
});

// MAKE / REMOVE ADMIN  →  PATCH /api/admin/users/:id/role   body: { role: "admin" | "customer" }
router.patch('/users/:id/role', async (req, res) => {
  const role = req.body?.role;
  if (!['admin', 'customer'].includes(role)) {
    return res.status(400).json({ message: 'Role must be "admin" or "customer"' });
  }
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ message: 'You can’t change your own role' }); // no locking yourself out
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.role = role;
  await user.save();
  const summaries = await orderSummaries([user._id]);
  res.json(withSummary(user, summaries));
});

// DASHBOARD NUMBERS  →  GET /api/admin/stats
router.get('/stats', async (req, res) => {
  // Revenue = money actually received: card orders once paid, cash orders once delivered
  const PAID = { status: { $ne: 'cancelled' }, 'payment.paidAt': { $exists: true } };
  // Sold = every order that wasn't cancelled and isn't still waiting for a card payment
  const SOLD = ['placed', 'paid', 'shipped', 'delivered'];
  const LOW_STOCK = 3;

  const [revenue, ordersByStatus, productCount, customerCount, lowStock, recentOrders, bestSellers, cancelReasons] =
    await Promise.all([
      Order.aggregate([
        { $match: PAID },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Product.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      // Products with a size that is (almost) sold out
      Product.find({ 'sizes.stock': { $lte: LOW_STOCK } }).sort({ updatedAt: -1 }).limit(8),
      Order.find().sort({ createdAt: -1, _id: -1 }).limit(5).populate('user', 'name email'),
      Order.aggregate([
        { $match: { status: { $in: SOLD } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, image: { $first: '$items.image' }, sold: { $sum: '$items.quantity' } } },
        { $sort: { sold: -1 } },
        { $limit: 5 },
      ]),
      // Why orders were cancelled: how often each reason was given (customers and admins separately)
      Order.aggregate([
        { $match: { status: 'cancelled', 'cancellation.reason': { $exists: true } } },
        { $group: { _id: { reason: '$cancellation.reason', by: '$cancellation.by' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

  res.json({
    revenue: Math.round((revenue[0]?.total || 0) * 100) / 100,
    paidOrders: revenue[0]?.count || 0,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((s) => [s._id, s.count])),
    productCount,
    customerCount,
    lowStockLimit: LOW_STOCK,
    lowStock,
    recentOrders,
    bestSellers,
    cancelReasons: cancelReasons.map((r) => ({ reason: r._id.reason, by: r._id.by, count: r.count })),
  });
});

module.exports = router;
