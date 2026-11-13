const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, clearDb, fakeStripe, createUser, api, createProduct, address } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('My account (PUT /api/auth/me)', () => {
  it('updates the name and email, but not the role', async () => {
    const { token } = await createUser();
    const res = await api(token).put('/api/auth/me', { name: 'Sara Ali', email: 'SARA@example.com', role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Sara Ali');
    assert.equal(res.body.email, 'sara@example.com');
    assert.equal(res.body.role, 'customer');
  });

  it('rejects an invalid email and an email another account uses', async () => {
    const { token } = await createUser();
    await createUser({ email: 'taken@shop.test' });
    assert.match((await api(token).put('/api/auth/me', { email: 'nope' })).body.message, /Email is invalid/);
    const taken = await api(token).put('/api/auth/me', { email: 'taken@shop.test' });
    assert.equal(taken.status, 409);
  });
});

describe('Change password (PUT /api/auth/me/password)', () => {
  it('changes the password when the current one is right', async () => {
    const { token } = await createUser({ email: 'sara@shop.test' });
    const res = await api(token).put('/api/auth/me/password', { currentPassword: 'password123', newPassword: 'newpassword456' });
    assert.equal(res.status, 200);

    assert.equal((await api().post('/api/auth/login', { email: 'sara@shop.test', password: 'password123' })).status, 401);
    assert.equal((await api().post('/api/auth/login', { email: 'sara@shop.test', password: 'newpassword456' })).status, 200);
  });

  it('refuses a wrong current password, a short new one, or the same one again', async () => {
    const { token } = await createUser();
    const change = (body) => api(token).put('/api/auth/me/password', body);
    assert.match((await change({ currentPassword: 'wrong-pass', newPassword: 'newpassword456' })).body.message, /current password is incorrect/);
    assert.match((await change({ currentPassword: 'password123', newPassword: 'short' })).body.message, /at least 8 characters/);
    assert.match((await change({ currentPassword: 'password123', newPassword: 'password123' })).body.message, /must be different/);
  });
});

describe('Admin: stock (/api/admin/inventory)', () => {
  it('shows stock per size with units sold and reserved', async () => {
    const admin = await createUser({ role: 'admin', email: 'admin@shop.test' });
    const customer = await createUser();
    const product = await createProduct(); // S: 5, M: 2
    const order = () => api(customer.token).post('/api/orders', { items: [{ productId: product._id, size: 'S', quantity: 2 }], shippingAddress: address });
    await order(); // waiting for payment → reserved
    await api(customer.token).post('/api/orders', { items: [{ productId: product._id, size: 'S', quantity: 1 }], shippingAddress: address, paymentMethod: 'cod' }); // sold

    const res = await api(admin.token).get('/api/admin/inventory');
    assert.equal(res.status, 200);
    const row = res.body.products[0];
    assert.deepEqual(row.sizes, [
      { size: 'S', stock: 2, sold: 1, reserved: 2 },
      { size: 'M', stock: 2, sold: 0, reserved: 0 },
    ]);
    assert.equal(row.totalStock, 4);
    assert.equal(row.status, 'low'); // a size with 3 or fewer left
    assert.deepEqual(res.body.totals, { units: 4, value: 199.96, low: 1, soldOut: 0 });
  });

  it('lets the admin restock sizes', async () => {
    const admin = await createUser({ role: 'admin', email: 'admin@shop.test' });
    const product = await createProduct();
    const url = `/api/admin/products/${product._id}/stock`;

    const res = await api(admin.token).patch(url, { sizes: [{ size: 'M', stock: 20 }] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.sizes.map((s) => s.stock), [5, 20]);
    assert.equal(res.body.status, 'in_stock');

    assert.match((await api(admin.token).patch(url, { sizes: [{ size: 'XL', stock: 1 }] })).body.message, /no size "XL"/);
    assert.match((await api(admin.token).patch(url, { sizes: [{ size: 'S', stock: -1 }] })).body.message, /whole number/);
    const customer = await createUser();
    assert.equal((await api(customer.token).patch(url, { sizes: [{ size: 'S', stock: 99 }] })).status, 403);
  });
});

describe('Admin: customers (/api/admin/users)', () => {
  async function setup() {
    const admin = await createUser({ role: 'admin', name: 'Admin', email: 'admin@shop.test' });
    const sara = await createUser({ name: 'Sara Ali', email: 'sara@shop.test' });
    await createUser({ name: 'Omar Hassan', email: 'omar@shop.test' });
    // Sara places one paid card order and one cancelled order
    const product = await createProduct();
    const order = () => api(sara.token).post('/api/orders', { items: [{ productId: product._id, size: 'S', quantity: 1 }], shippingAddress: address });
    const paid = (await order()).body.order;
    fakeStripe.pay(paid.payment.paymentIntentId);
    await api(sara.token).post(`/api/orders/${paid._id}/confirm-payment`);
    const cancelled = (await order()).body.order;
    await api(sara.token).post(`/api/orders/${cancelled._id}/cancel`, { reason: 'Changed my mind' });
    return { admin, sara };
  }

  it('lists users with their order count and money spent', async () => {
    const { admin } = await setup();
    const res = await api(admin.token).get('/api/admin/users');
    assert.equal(res.status, 200);
    const sara = res.body.find((u) => u.email === 'sara@shop.test');
    assert.equal(sara.orderCount, 1); // cancelled orders don't count
    assert.equal(sara.totalSpent, 54.99); // 49.99 + 5 shipping
    assert.equal(sara.password, undefined);
    assert.equal(res.body.find((u) => u.email === 'omar@shop.test').orderCount, 0);
  });

  it('searches by name or email', async () => {
    const { admin } = await setup();
    const res = await api(admin.token).get('/api/admin/users?search=omar');
    assert.deepEqual(res.body.map((u) => u.name), ['Omar Hassan']);
  });

  it('shows one customer with all of their orders', async () => {
    const { admin, sara } = await setup();
    const res = await api(admin.token).get(`/api/admin/users/${sara.user._id}`);
    assert.equal(res.body.name, 'Sara Ali');
    assert.equal(res.body.orders.length, 2);
    assert.equal((await api(admin.token).get('/api/admin/users/64b7f0c2a1b2c3d4e5f60718')).status, 404);
  });

  it('makes a customer an admin and back, but never changes your own role', async () => {
    const { admin, sara } = await setup();
    const url = `/api/admin/users/${sara.user._id}/role`;
    assert.equal((await api(admin.token).patch(url, { role: 'admin' })).body.role, 'admin');
    assert.equal((await api(sara.token).get('/api/admin/stats')).status, 200); // Sara can use the admin now
    assert.equal((await api(admin.token).patch(url, { role: 'customer' })).body.role, 'customer');

    const self = await api(admin.token).patch(`/api/admin/users/${admin.user._id}/role`, { role: 'customer' });
    assert.equal(self.status, 400);
    assert.match(self.body.message, /your own role/);
    assert.equal((await api(admin.token).patch(url, { role: 'boss' })).status, 400);
  });

  it('is admin-only', async () => {
    const { sara } = await setup();
    assert.equal((await api(sara.token).get('/api/admin/users')).status, 403);
  });
});
