const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const payments = require('../lib/payments');
const {
  startDb, stopDb, clearDb, fakeStripe, createUser, api, createProduct, address, Product,
} = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const stockOf = async (productId, size) =>
  (await Product.findById(productId)).sizes.find((s) => s.size === size).stock;

// A logged-in customer with a dress (S: 5, M: 2 in stock) to buy
async function setup() {
  const customer = await createUser();
  const dress = await createProduct();
  const order = (items, extra = {}) =>
    api(customer.token).post('/api/orders', { items, shippingAddress: address, ...extra });
  return { customer, dress, order };
}

describe('Placing an order (POST /api/orders)', () => {
  it('creates an order with prices from the database and reserves the stock', async () => {
    const { dress, order } = await setup();
    const res = await order([{ productId: dress._id, size: 'S', quantity: 2, price: 0.01 }]); // price is ignored

    assert.equal(res.status, 201);
    assert.equal(res.body.clientSecret, 'pi_test_1_secret');
    assert.equal(res.body.order.status, 'pending_payment');
    assert.equal(res.body.order.subtotal, 99.98);
    assert.equal(res.body.order.shippingFee, 5); // under $100
    assert.equal(res.body.order.total, 104.98);
    assert.equal(fakeStripe.payments.get('pi_test_1').amount, 104.98);
    assert.equal(await stockOf(dress._id, 'S'), 3);
  });

  it('gives free shipping from $100', async () => {
    const { dress, order } = await setup();
    const res = await order([{ productId: dress._id, size: 'S', quantity: 3 }]);
    assert.equal(res.body.order.shippingFee, 0);
    assert.equal(res.body.order.total, 149.97);
  });

  it('merges the same product and size into one line', async () => {
    const { dress, order } = await setup();
    const res = await order([
      { productId: dress._id, size: 'S', quantity: 1 },
      { productId: dress._id, size: 'S', quantity: 1 },
    ]);
    assert.equal(res.body.order.items.length, 1);
    assert.equal(res.body.order.items[0].quantity, 2);
  });

  it('refuses more than what’s in stock, and changes nothing', async () => {
    const { dress, order } = await setup();
    const res = await order([{ productId: dress._id, size: 'M', quantity: 3 }]);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Only 2 left/);
    assert.equal(await stockOf(dress._id, 'M'), 2);
  });

  it('rejects an empty cart, a size the product doesn’t have, and a missing address', async () => {
    const { dress, order } = await setup();
    assert.match((await order([])).body.message, /cart is empty/);
    assert.match((await order([{ productId: dress._id, size: 'XL', quantity: 1 }])).body.message, /isn’t available in size XL/);

    const noAddress = await order([{ productId: dress._id, size: 'S', quantity: 1 }], { shippingAddress: {} });
    assert.equal(noAddress.status, 400);
    assert.match(noAddress.body.message, /Street address is required/);
    assert.equal(await stockOf(dress._id, 'S'), 5); // nothing was reserved
  });

  it('undoes everything if the payment can’t be started', async () => {
    const { dress, order } = await setup();
    const original = payments.createPayment;
    payments.createPayment = async () => {
      throw Object.assign(new Error('Card payments aren’t set up yet'), { status: 503 });
    };
    try {
      const res = await order([{ productId: dress._id, size: 'S', quantity: 1 }]);
      assert.equal(res.status, 503);
      assert.equal(await stockOf(dress._id, 'S'), 5);
      const mine = await api((await createUser({ email: 'other@shop.test' })).token).get('/api/orders/mine');
      assert.deepEqual(mine.body, []);
    } finally {
      payments.createPayment = original;
    }
  });
});

describe('Paying (POST /api/orders/:id/confirm-payment)', () => {
  it('marks the order as paid once Stripe confirms the payment', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;

    const tooEarly = await api(customer.token).post(`/api/orders/${placed._id}/confirm-payment`);
    assert.equal(tooEarly.status, 400);
    assert.match(tooEarly.body.message, /hasn’t gone through/);

    fakeStripe.pay(placed.payment.paymentIntentId);
    const res = await api(customer.token).post(`/api/orders/${placed._id}/confirm-payment`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'paid');
    assert.ok(res.body.payment.paidAt);
  });

  it('refuses a payment for the wrong amount', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;
    const payment = fakeStripe.payments.get(placed.payment.paymentIntentId);
    payment.status = 'succeeded';
    payment.amount = 1;

    const res = await api(customer.token).post(`/api/orders/${placed._id}/confirm-payment`);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /doesn’t match/);
  });
});

describe('Viewing orders', () => {
  it('shows customers only their own orders', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;

    const mine = await api(customer.token).get('/api/orders/mine');
    assert.equal(mine.body.length, 1);

    const other = await createUser({ email: 'other@shop.test' });
    assert.deepEqual((await api(other.token).get('/api/orders/mine')).body, []);
    assert.equal((await api(other.token).get(`/api/orders/${placed._id}`)).status, 404);
  });

  it('lets the customer resume an unpaid order’s payment', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;
    const res = await api(customer.token).get(`/api/orders/${placed._id}/payment`);
    assert.equal(res.body.clientSecret, 'pi_test_1_secret');
  });
});

describe('Cancelling (POST /api/orders/:id/cancel)', () => {
  it('lets a customer cancel an unpaid order and puts the items back in stock', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'M', quantity: 2 }])).body.order;
    assert.equal(await stockOf(dress._id, 'M'), 0);

    const res = await api(customer.token).post(`/api/orders/${placed._id}/cancel`, { reason: 'Changed my mind' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
    assert.deepEqual(res.body.cancellation, { reason: 'Changed my mind', by: 'customer' });
    assert.equal(await stockOf(dress._id, 'M'), 2);
    assert.deepEqual(fakeStripe.calls, [['cancel', 'pi_test_1']]);
  });

  it('asks for a reason, and a note when the reason is "Other"', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;
    const cancel = (body) => api(customer.token).post(`/api/orders/${placed._id}/cancel`, body);

    assert.match((await cancel({})).body.message, /choose a reason/);
    assert.match((await cancel({ reason: 'Out of stock' })).body.message, /choose a reason/); // an admin reason
    assert.match((await cancel({ reason: 'Other' })).body.message, /tell us a little more/);
    assert.equal(await stockOf(dress._id, 'S'), 4); // nothing cancelled yet

    const res = await cancel({ reason: 'Other', note: 'Bought it in the shop instead' });
    assert.deepEqual(res.body.cancellation, { reason: 'Other', note: 'Bought it in the shop instead', by: 'customer' });
  });

  it('doesn’t let a customer cancel a paid order, but an admin can (with a refund)', async () => {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 1 }])).body.order;
    fakeStripe.pay(placed.payment.paymentIntentId);
    await api(customer.token).post(`/api/orders/${placed._id}/confirm-payment`);

    const byCustomer = await api(customer.token).post(`/api/orders/${placed._id}/cancel`, { reason: 'Changed my mind' });
    assert.equal(byCustomer.status, 400);

    const admin = await createUser({ role: 'admin' });
    const byAdmin = await api(admin.token).post(`/api/orders/${placed._id}/cancel`, { reason: 'Out of stock', note: 'Last one was damaged' });
    assert.equal(byAdmin.status, 200);
    assert.deepEqual(byAdmin.body.cancellation, { reason: 'Out of stock', note: 'Last one was damaged', by: 'admin' });
    assert.deepEqual(fakeStripe.calls, [['refund', 'pi_test_1']]);
    assert.equal(await stockOf(dress._id, 'S'), 5);

    // The admin dashboard counts the reasons
    const stats = await api(admin.token).get('/api/admin/stats');
    assert.deepEqual(stats.body.cancelReasons, [{ reason: 'Out of stock', by: 'admin', count: 1 }]);
  });
});

describe('Admin order management', () => {
  async function paidOrder() {
    const { customer, dress, order } = await setup();
    const placed = (await order([{ productId: dress._id, size: 'S', quantity: 2 }])).body.order;
    fakeStripe.pay(placed.payment.paymentIntentId);
    await api(customer.token).post(`/api/orders/${placed._id}/confirm-payment`);
    const admin = await createUser({ role: 'admin' });
    return { placed, admin };
  }

  it('moves an order from paid to shipped to delivered, in that order only', async () => {
    const { placed, admin } = await paidOrder();
    const url = `/api/admin/orders/${placed._id}/status`;

    const skip = await api(admin.token).patch(url, { status: 'delivered' });
    assert.equal(skip.status, 400);
    assert.match(skip.body.message, /can only be marked as shipped/);

    const shipped = await api(admin.token).patch(url, { status: 'shipped' });
    assert.equal(shipped.body.status, 'shipped');
    assert.ok(shipped.body.shippedAt);
    assert.equal(shipped.body.user.name, 'Test User'); // includes the customer

    const delivered = await api(admin.token).patch(url, { status: 'delivered' });
    assert.equal(delivered.body.status, 'delivered');
  });

  it('lists all orders, filtered by status', async () => {
    const { admin } = await paidOrder();
    assert.equal((await api(admin.token).get('/api/admin/orders')).body.length, 1);
    assert.equal((await api(admin.token).get('/api/admin/orders?status=paid')).body.length, 1);
    assert.equal((await api(admin.token).get('/api/admin/orders?status=shipped')).body.length, 0);
  });

  it('reports revenue, best sellers and low stock on the dashboard', async () => {
    const { admin } = await paidOrder();
    const res = await api(admin.token).get('/api/admin/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.revenue, 104.98);
    assert.equal(res.body.paidOrders, 1);
    assert.equal(res.body.customerCount, 1);
    assert.equal(res.body.bestSellers[0].sold, 2);
    assert.equal(res.body.lowStock.length, 1); // size S now has 3 left
  });
});

describe('Cash on delivery', () => {
  async function cashOrder() {
    const { customer, dress, order } = await setup();
    const res = await order([{ productId: dress._id, size: 'S', quantity: 2 }], { paymentMethod: 'cod' });
    return { customer, dress, res, placed: res.body.order };
  }

  it('places the order straight away, reserves the stock and doesn’t touch Stripe', async () => {
    const { res, dress } = await cashOrder();
    assert.equal(res.status, 201);
    assert.equal(res.body.clientSecret, null);
    assert.equal(res.body.order.status, 'placed');
    assert.equal(res.body.order.payment.provider, 'cod');
    assert.equal(res.body.order.payment.paidAt, undefined);
    assert.equal(fakeStripe.payments.size, 0);
    assert.equal(await stockOf(dress._id, 'S'), 3);
  });

  it('rejects an unknown payment method', async () => {
    const { dress, order } = await setup();
    const res = await order([{ productId: dress._id, size: 'S', quantity: 1 }], { paymentMethod: 'bitcoin' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /card or cash on delivery/);
  });

  it('lets the customer cancel until it ships; the items go back into stock', async () => {
    const { customer, dress, placed } = await cashOrder();
    const res = await api(customer.token).post(`/api/orders/${placed._id}/cancel`, { reason: 'Ordered by mistake' });
    assert.equal(res.body.status, 'cancelled');
    assert.equal(await stockOf(dress._id, 'S'), 5);
    assert.deepEqual(fakeStripe.calls, []);
  });

  it('is shipped and delivered by the admin, and counts as revenue once delivered (cash received)', async () => {
    const { customer, placed } = await cashOrder();
    const admin = await createUser({ role: 'admin' });
    const url = `/api/admin/orders/${placed._id}/status`;

    const shipped = await api(admin.token).patch(url, { status: 'shipped' });
    assert.equal(shipped.body.status, 'shipped');
    assert.equal((await api(customer.token).post(`/api/orders/${placed._id}/cancel`, { reason: 'Changed my mind' })).status, 400); // too late
    assert.equal((await api(admin.token).get('/api/admin/stats')).body.revenue, 0); // not paid yet

    const delivered = await api(admin.token).patch(url, { status: 'delivered' });
    assert.equal(delivered.body.status, 'delivered');
    assert.ok(delivered.body.payment.paidAt);
    const stats = (await api(admin.token).get('/api/admin/stats')).body;
    assert.equal(stats.revenue, 104.98);
    assert.equal(stats.bestSellers[0].sold, 2);
  });
});
